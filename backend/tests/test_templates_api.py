from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth_dependencies import get_current_user, get_db
from app.main import app
from app.models.database_models import Base, User
from app.services import template_service


@pytest.fixture
def template_api(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'templates.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add_all([User(id=101, email="one@example.test", name="One"), User(id=202, email="two@example.test", name="Two")])
        db.commit()

    def override_db():
        with sessions() as db:
            yield db

    active = {"id": 101}
    def user_dependency():
        if active["id"] is None:
            raise AssertionError("auth override must be removed for anonymous-request tests")
        return User(id=active["id"], email=f"{active['id']}@example.test", name="Tester")

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = user_dependency
    objects: dict[str, bytes] = {}

    def storage(method, path, body=None, content_type=None):
        if method == "POST":
            objects[path] = body
            return b"{}"
        if method == "GET":
            if path not in objects:
                raise template_service.TemplateObjectNotFound("missing")
            return objects[path]
        if method == "DELETE":
            objects.pop(path, None)
            return b"{}"
        raise AssertionError(method)

    monkeypatch.setattr(template_service, "_storage_request", storage)
    with TestClient(app) as client:
        yield client, active, objects, sessions
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (32, 48), color=(240, 120, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


def upload(client: TestClient, name: str = "opening.png", content: bytes | None = None):
    return client.post("/api/templates/upload", files={"file": (name, content or png_bytes(), "image/png")})


def test_authenticated_upload_list_preview_and_persistent_metadata(template_api):
    client, active, objects, sessions = template_api
    response = upload(client)
    assert response.status_code == 201
    body = response.json()
    template_id = body["template_id"]
    assert body["filename"] == "opening.png"
    assert "storage_path" not in body and "path" not in body
    stored_path = next(iter(objects))
    assert stored_path == f"101/{template_id}/opening.png"
    assert client.get("/api/templates").json()[0]["template_id"] == template_id
    assert client.get(f"/api/templates/{template_id}/preview").content == png_bytes()
    with sessions() as fresh_session:
        from app.models.database_models import Template
        record = fresh_session.get(Template, template_id)
        assert record is not None and record.user_id == 101
        assert record.storage_path == stored_path
    active["id"] = 202
    assert client.get("/api/templates").json() == []
    assert client.get(f"/api/templates/{template_id}/preview").status_code == 404
    assert client.delete(f"/api/templates/{template_id}").status_code == 404
    assert stored_path in objects


def test_template_endpoints_require_authentication(template_api):
    client, _active, _objects, _sessions = template_api
    app.dependency_overrides.pop(get_current_user)
    assert client.get("/api/templates").status_code == 401
    assert upload(client).status_code == 401
    assert client.delete("/api/templates/00000000-0000-0000-0000-000000000001").status_code == 401


@pytest.mark.parametrize(
    "filename,content",
    [("bad.gif", png_bytes()), ("fake.png", b"not an image"), ("mismatch.jpg", png_bytes())],
)
def test_invalid_template_files_are_rejected_before_storage(template_api, filename, content):
    client, _active, objects, _sessions = template_api
    response = upload(client, filename, content)
    assert response.status_code == 400
    assert objects == {}


def test_storage_failure_does_not_create_template_row(template_api, monkeypatch):
    client, _active, _objects, sessions = template_api
    monkeypatch.setattr(template_service, "upload_object", lambda *_args: (_ for _ in ()).throw(template_service.TemplateStorageError("offline")))
    response = upload(client)
    assert response.status_code == 503
    with sessions() as db:
        from sqlalchemy import select
        from app.models.database_models import Template
        assert db.scalar(select(Template)) is None


def test_template_delete_removes_private_object_and_database_record(template_api):
    client, _active, objects, sessions = template_api
    response = upload(client)
    template_id = response.json()["template_id"]
    storage_path = next(iter(objects))
    deleted = client.delete(f"/api/templates/{template_id}")
    assert deleted.status_code == 200
    assert storage_path not in objects
    with sessions() as db:
        from app.models.database_models import Template
        assert db.get(Template, template_id) is None


def test_local_template_migration_is_idempotent_and_preserves_source(template_api, monkeypatch, tmp_path):
    _client, _active, objects, sessions = template_api
    from scripts import migrate_local_templates as migration
    monkeypatch.setattr(migration, "SessionLocal", sessions)
    template_id = "cb5c6585-e207-4fa6-96c1-b0bc2ac70001"
    template_dir = tmp_path / template_id
    template_dir.mkdir()
    source = template_dir / "original.png"
    source.write_bytes(png_bytes())
    owner_map = {template_id: 101}

    assert migration.migrate(owner_map, tmp_path)["migrated"] == 1
    second = migration.migrate(owner_map, tmp_path)
    assert second["migrated"] == 0
    assert second["already_present"] == 1
    assert source.is_file()
    assert f"101/{template_id}/original.png" in objects
