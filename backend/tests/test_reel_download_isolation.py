import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from fastapi.routing import Mount
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api import reels
from app.core.auth_dependencies import get_db
from app.main import app
from app.models.database_models import Base, ReelHistory, User
from app.core.security import create_access_token
from app.core.storage import OUTPUTS_DIR as CONFIGURED_OUTPUTS_DIR
from app.services import reel_history_service


@pytest.fixture
def download_case(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'reel-download.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    reel_id = str(uuid.uuid4())
    outputs = tmp_path / "outputs"
    outputs.mkdir()
    output_path = outputs / f"{reel_id}.mp4"
    output_path.write_bytes(b"owned mp4")
    with sessions() as db:
        db.add_all([
            User(id=301, email="owner@example.test", name="Owner"),
            User(id=302, email="other@example.test", name="Other"),
            ReelHistory(
                reel_id=reel_id,
                user_id=301,
                status="completed",
                output_path=str(output_path),
            ),
        ])
        db.commit()

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    monkeypatch.setattr(reels, "OUTPUTS_DIR", outputs)
    monkeypatch.setattr(reels, "get_reel_job", lambda _reel_id: None)

    def auth_headers(user_id):
        with sessions() as db:
            user = db.get(User, user_id)
        return {"Authorization": f"Bearer {create_access_token(user.id, user.email)}"}

    with TestClient(app) as client:
        yield client, reel_id, auth_headers, sessions

    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_reel_download_requires_authentication(download_case):
    client, reel_id, _auth_headers, _sessions = download_case
    response = client.get(f"/api/reels/{reel_id}/download")
    assert response.status_code == 401


def test_reel_download_rejects_invalid_backend_token(download_case):
    client, reel_id, _auth_headers, _sessions = download_case
    response = client.get(
        f"/api/reels/{reel_id}/download",
        headers={"Authorization": "Bearer not-a-valid-token"},
    )
    assert response.status_code == 401


def test_reel_download_is_limited_to_history_owner(download_case):
    client, reel_id, authenticate, _sessions = download_case
    other_user_headers = authenticate(302)
    assert client.get(f"/api/reels/{reel_id}/download", headers=other_user_headers).status_code == 404

    owner_headers = authenticate(301)
    response = client.get(f"/api/reels/{reel_id}/download", headers=owner_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "video/mp4"
    assert response.content == b"owned mp4"


def test_reel_download_uses_saved_history_path_when_job_has_no_path(download_case, monkeypatch):
    client, reel_id, auth_headers, _sessions = download_case
    owner_headers = auth_headers(301)
    monkeypatch.setattr(reels, "get_reel_job", lambda _reel_id: {"output_path": None})

    response = client.get(f"/api/reels/{reel_id}/download", headers=owner_headers)
    assert response.status_code == 200
    assert response.content == b"owned mp4"


def test_reel_download_reports_missing_local_output(download_case, tmp_path):
    client, reel_id, auth_headers, _sessions = download_case
    owner_headers = auth_headers(301)
    (tmp_path / "outputs" / f"{reel_id}.mp4").unlink()
    response = client.get(f"/api/reels/{reel_id}/download", headers=owner_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Reel file not found"


def test_reel_download_rejects_history_path_outside_output_directory(download_case, tmp_path):
    client, reel_id, auth_headers, sessions = download_case
    outside = tmp_path / "outside.mp4"
    outside.write_bytes(b"must not be served")
    with sessions() as db:
        record = db.query(ReelHistory).filter_by(reel_id=reel_id).one()
        record.output_path = str(outside)
        db.commit()

    response = client.get(
        f"/api/reels/{reel_id}/download",
        headers=auth_headers(301),
    )
    assert response.status_code == 404


def test_outputs_are_not_mounted_as_public_static_files(download_case):
    client, reel_id, _auth_headers, _sessions = download_case
    mounts = [route for route in app.routes if isinstance(route, Mount) and isinstance(route.app, StaticFiles)]
    outputs = reels.OUTPUTS_DIR.resolve()
    assert not any(
        outputs.is_relative_to(Path(route.app.directory).resolve())
        for route in mounts
    )
    assert client.get(f"/outputs/{reel_id}.mp4").status_code == 404
    assert client.get(f"/storage/outputs/{reel_id}.mp4").status_code == 404


def test_reel_generation_and_download_share_the_configured_local_output_directory():
    assert reels.OUTPUTS_DIR == CONFIGURED_OUTPUTS_DIR


def test_reel_history_does_not_return_local_output_paths(download_case, monkeypatch):
    _client, _reel_id, _auth_headers, sessions = download_case
    monkeypatch.setattr(reel_history_service, "SessionLocal", sessions)

    records = reel_history_service.list_reel_history(301)

    assert len(records) == 1
    assert "output_path" not in records[0]
