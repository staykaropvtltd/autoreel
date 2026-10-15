from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.auth_dependencies import get_current_user, get_db
from app.main import app
from app.models.database_models import Base, EditorProject, ReelHistory, ReelJob, User
from app.services import template_service


@pytest.fixture
def editor_api(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'editor.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    from app.core import job_store
    monkeypatch.setattr(job_store, "SessionLocal", sessions)
    with sessions() as db:
        db.add_all([User(id=101, email="editor1@example.test", name="One"), User(id=202, email="editor2@example.test", name="Two")])
        db.commit()
    active = {"id": 101}

    def override_db():
        with sessions() as db:
            yield db

    def override_user():
        return User(id=active["id"], email=f"{active['id']}@example.test", name="Tester")

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    monkeypatch.setattr("app.services.reel_history_service.SessionLocal", sessions)
    objects = {}

    def storage(method, path, body=None, content_type=None):
        if method == "POST": objects[path] = body; return b"{}"
        if method == "GET":
            if path not in objects: raise template_service.TemplateObjectNotFound("missing")
            return objects[path]
        if method == "DELETE": objects.pop(path, None); return b"{}"
        raise AssertionError(method)

    monkeypatch.setattr(template_service, "_storage_request", storage)
    outputs = tmp_path / "outputs"
    monkeypatch.setattr("app.api.editor_projects.OUTPUTS_DIR", outputs)
    monkeypatch.setattr("app.api.reels.OUTPUTS_DIR", outputs)
    with TestClient(app) as client:
        yield client, active, objects, sessions, outputs
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def image_bytes():
    data = BytesIO()
    Image.new("RGB", (48, 64), (230, 90, 25)).save(data, format="PNG")
    return data.getvalue()


def make_asset(client, filename="source.png"):
    result = client.post("/api/templates/upload", files={"file": (filename, image_bytes(), "image/png")})
    assert result.status_code == 201, result.text
    return result.json()["template_id"]


def payload(asset_id):
    return {"title": "Test photo reel", "category": "Product", "slides": [
        {"id": "slide-one", "asset_id": asset_id, "name": "Still", "duration": 0.6, "motion": "static", "transition": "cut", "fitMode": "cover"},
        {"id": "slide-two", "asset_id": asset_id, "name": "Still two", "duration": 0.6, "motion": "zoom_in", "transition": "crossfade", "fitMode": "contain"},
    ], "overlays": {"title": "Test", "subtitle": "", "brandName": "", "titlePosition": "bottom", "brandWatermarkPosition": "none"},
        "audio": {"trackId": None, "volume": 0.8, "offset": 0}, "settings": {"aspect_ratio": "9:16", "width": 720, "height": 1280, "fps": 24}}


def test_projects_persist_and_are_owner_scoped(editor_api):
    client, active, _objects, sessions, _outputs = editor_api
    asset_id = make_asset(client)
    created = client.post("/api/editor-projects", json=payload(asset_id))
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]
    changed = payload(asset_id); changed["title"] = "Saved revision"
    assert client.put(f"/api/editor-projects/{project_id}", json=changed).json()["title"] == "Saved revision"
    assert client.get("/api/editor-projects").json()[0]["slides"][0]["asset_id"] == asset_id
    with sessions() as reopened:
        record = reopened.get(EditorProject, project_id)
        assert record.project_data["slides"][0]["asset_id"] == asset_id
        assert record.project_data["settings"]["total_duration"] == 1.2
        assert record.title == "Saved revision"
    active["id"] = 202
    assert client.get("/api/editor-projects").json() == []
    assert client.get(f"/api/editor-projects/{project_id}").status_code == 404
    assert client.put(f"/api/editor-projects/{project_id}", json=payload(asset_id)).status_code == 404
    assert client.delete(f"/api/editor-projects/{project_id}").status_code == 404
    assert client.post(f"/api/editor-projects/{project_id}/export").status_code == 404


def test_project_rejects_other_users_assets_and_invalid_settings(editor_api):
    client, active, _objects, _sessions, _outputs = editor_api
    asset_id = make_asset(client)
    active["id"] = 202
    assert client.post("/api/editor-projects", json=payload(asset_id)).status_code == 400
    bad = payload("00000000-0000-0000-0000-000000000001")
    assert client.post("/api/editor-projects", json=bad).status_code == 400


def test_image_export_renders_real_mp4_and_downloads_without_credit_calls(editor_api, monkeypatch):
    client, _active, _objects, sessions, outputs = editor_api
    from app.services import credit_service
    monkeypatch.setattr(credit_service, "deduct_credits", lambda *_: (_ for _ in ()).throw(AssertionError("free export called deduct")))
    monkeypatch.setattr(credit_service, "refund_credits", lambda *_: (_ for _ in ()).throw(AssertionError("free export called refund")))
    asset_id = make_asset(client)
    export_payload = payload(asset_id)
    export_payload["settings"] = {"aspect_ratio": "9:16", "width": 1080, "height": 1920, "fps": 30}
    created = client.post("/api/editor-projects", json=export_payload)
    assert created.status_code == 201, created.text
    result = client.post(f"/api/editor-projects/{created.json()['id']}/export")
    assert result.status_code == 200, result.text
    reel_id = result.json()["reel_id"]
    output = outputs / f"{reel_id}.mp4"
    assert output.is_file() and output.stat().st_size > 1000
    from app.services.ffmpeg_service import probe
    metadata = probe(output)
    video = next(stream for stream in metadata["streams"] if stream["codec_type"] == "video")
    assert int(video["width"]) == 1080 and int(video["height"]) == 1920
    assert round(float(video["r_frame_rate"].split("/")[0]) / float(video["r_frame_rate"].split("/")[1])) == 30
    downloaded = client.get(f"/api/reels/{reel_id}/download")
    assert downloaded.status_code == 200
    assert downloaded.content[:4] == b"\x00\x00\x00\x18" or b"ftyp" in downloaded.content[:16]
    history_response = client.get("/api/reels/history")
    assert history_response.status_code == 200
    item = next(record for record in history_response.json()["items"] if record["reel_id"] == reel_id)
    assert item["status"] == "completed"
    assert item["title"] == "Test photo reel"
    assert item["created_at"]
    assert item["source"] == "image_to_reel"
    assert "output_path" not in item
    # A repeated export request returns the existing completed reel and does
    # not create a second history row.
    repeated = client.post(f"/api/editor-projects/{created.json()['id']}/export")
    assert repeated.status_code == 200 and repeated.json()["reel_id"] == reel_id
    with sessions() as db:
        project = db.get(EditorProject, created.json()["id"])
        assert project.export_status == "completed" and project.export_reel_id == reel_id
        history = db.scalar(select(ReelHistory).where(ReelHistory.reel_id == reel_id))
        assert history is not None and history.user_id == 101
        assert history.output_path == str(output.resolve())
        assert history.status == "completed" and history.created_at is not None
        render_job = db.scalar(select(ReelJob).where(ReelJob.job_id == reel_id))
        assert render_job.job_type == "image_to_reel"
        assert render_job.user_id == 101
        assert render_job.status == "completed" and render_job.progress == 100
        # A fresh SQLAlchemy session models a backend restart: the record and
        # its local download target remain available.
    with sessions() as reopened:
        persisted = reopened.scalar(select(ReelHistory).where(ReelHistory.reel_id == reel_id, ReelHistory.user_id == 101))
        assert persisted is not None and Path(persisted.output_path).is_file()
    _client, active, _objects, _sessions, _outputs = editor_api
    active["id"] = 202
    assert client.get("/api/reels/history").json()["items"] == []
    assert client.get(f"/api/reels/{reel_id}/download").status_code == 404


def test_editor_history_is_created_only_after_nonempty_output_exists(editor_api, monkeypatch):
    client, _active, _objects, sessions, _outputs = editor_api
    from app.api import editor_projects
    monkeypatch.setattr(editor_projects, "render_photo_reel", lambda *_: {"duration_seconds": 1.2})
    asset_id = make_asset(client)
    project_id = client.post("/api/editor-projects", json=payload(asset_id)).json()["id"]
    result = client.post(f"/api/editor-projects/{project_id}/export")
    assert result.status_code == 500
    with sessions() as db:
        assert db.scalars(select(ReelHistory)).all() == []
        project = db.get(EditorProject, project_id)
        assert project.export_status == "failed"


def test_project_owner_can_delete(editor_api):
    client, _active, _objects, sessions, _outputs = editor_api
    asset_id = make_asset(client)
    project_id = client.post("/api/editor-projects", json=payload(asset_id)).json()["id"]
    assert client.delete(f"/api/editor-projects/{project_id}").status_code == 204
    with sessions() as db:
        assert db.get(EditorProject, project_id) is None


def test_failed_export_is_recorded_and_never_touches_credits(editor_api, monkeypatch):
    client, _active, _objects, sessions, _outputs = editor_api
    from app.services import credit_service
    monkeypatch.setattr(credit_service, "deduct_credits", lambda *_: (_ for _ in ()).throw(AssertionError("free export called deduct")))
    monkeypatch.setattr(credit_service, "refund_credits", lambda *_: (_ for _ in ()).throw(AssertionError("free export called refund")))
    from app.api import editor_projects
    monkeypatch.setattr(editor_projects, "render_photo_reel", lambda *_: (_ for _ in ()).throw(RuntimeError("render failed")))
    asset_id = make_asset(client)
    project_id = client.post("/api/editor-projects", json=payload(asset_id)).json()["id"]
    assert client.post(f"/api/editor-projects/{project_id}/export").status_code == 500
    with sessions() as db:
        row = db.scalar(select(EditorProject).where(EditorProject.id == project_id))
        assert row.export_status == "failed" and row.export_error


def test_reel_download_requires_authentication_and_owner_and_has_no_static_alias(editor_api):
    client, active, _objects, sessions, outputs = editor_api
    reel_id = "11111111-1111-4111-8111-111111111111"
    output = outputs / f"{reel_id}.mp4"
    outputs.mkdir(parents=True, exist_ok=True)
    output.write_bytes(b"private-mp4-fixture")
    with sessions() as db:
        db.add(ReelHistory(reel_id=reel_id, user_id=101, status="completed", output_path=str(output)))
        db.commit()
    assert client.get(f"/api/reels/{reel_id}/download").status_code == 200
    assert client.get(f"/storage/outputs/{reel_id}.mp4").status_code == 404
    active["id"] = 202
    assert client.get(f"/api/reels/{reel_id}/download").status_code == 404
    app.dependency_overrides.pop(get_current_user)
    assert client.get(f"/api/reels/{reel_id}/download").status_code == 401


def test_editor_project_endpoints_require_authentication(editor_api):
    client, _active, _objects, _sessions, _outputs = editor_api
    app.dependency_overrides.pop(get_current_user)
    assert client.get("/api/editor-projects").status_code == 401
    assert client.post("/api/editor-projects", json=payload("00000000-0000-0000-0000-000000000001")).status_code == 401
