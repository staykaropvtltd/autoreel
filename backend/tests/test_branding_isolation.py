from io import BytesIO

import pytest
import urllib.error
from io import BytesIO
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth_dependencies import get_current_user, get_current_user_optional, get_db
from app.main import app
from app.models.database_models import Base, User
from app.services import brand_service


@pytest.fixture
def branding_client(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'branding-test.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add_all([
            User(id=101, email="a@example.test", name="A"),
            User(id=202, email="b@example.test", name="B"),
        ])
        db.commit()

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    objects: dict[str, bytes] = {}

    def storage(method, path, body=None, content_type=None):
        if method == "POST":
            objects[path] = body
            return b""
        if method == "GET":
            if path not in objects:
                raise brand_service.StorageObjectNotFound("missing test object")
            return objects[path]
        if method == "DELETE":
            objects.pop(path, None)
            return b""
        raise AssertionError(method)

    monkeypatch.setattr(brand_service, "_storage_request", storage)
    with TestClient(app) as client:
        yield client, objects
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def _user(user_id: int) -> User:
    return User(id=user_id, email=f"{user_id}@example.test", name=str(user_id))


def _authenticate_as(user_id: int) -> None:
    user = _user(user_id)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_current_user_optional] = lambda: user


def _png() -> bytes:
    image = BytesIO()
    Image.new("RGB", (2, 2), color="white").save(image, format="PNG")
    return image.getvalue()


def test_brand_settings_are_isolated_between_users(branding_client):
    client, _ = branding_client
    _authenticate_as(101)
    first = client.put("/api/branding", json={"name": "Brand A", "tagline": "A tag"})
    assert first.status_code == 200
    _authenticate_as(202)
    second = client.put("/api/branding", json={"name": "Brand B", "tagline": "B tag"})
    assert second.status_code == 200
    assert client.get("/api/branding").json()["name"] == "Brand B"
    _authenticate_as(101)
    assert client.get("/api/branding").json()["name"] == "Brand A"


@pytest.mark.parametrize(
    "configured_url",
    [
        "https://project.supabase.co",
        "https://project.supabase.co/rest/v1",
        "https://project.supabase.co/rest/v1/",
    ],
)
def test_storage_settings_normalize_postgrest_suffix(monkeypatch, configured_url):
    monkeypatch.setenv("SUPABASE_URL", configured_url)
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key")
    monkeypatch.setenv("SUPABASE_BRANDING_BUCKET", "branding")

    url, _key, bucket = brand_service._storage_settings()

    assert url == "https://project.supabase.co"
    assert bucket == "branding"


def test_storage_settings_reject_publishable_key(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "sb_publishable_test-value")
    monkeypatch.setenv("SUPABASE_BRANDING_BUCKET", "branding")

    with pytest.raises(brand_service.StorageConfigurationError, match="publishable key"):
        brand_service._storage_settings()


def test_storage_upload_rls_rejection_is_reported_as_configuration_error(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-key")
    monkeypatch.setenv("SUPABASE_BRANDING_BUCKET", "branding")
    error_body = b'{"code":"AccessDenied","message":"new row violates row-level security policy"}'
    error = urllib.error.HTTPError(
        "https://project.supabase.co/storage/v1/object/branding/user/logo.png",
        400,
        "Bad Request",
        {},
        BytesIO(error_body),
    )
    monkeypatch.setattr(brand_service.urllib.request, "urlopen", lambda *_args, **_kwargs: (_ for _ in ()).throw(error))

    with pytest.raises(brand_service.StorageConfigurationError, match="credentials or access policy"):
        brand_service._storage_request("POST", "101/logo.png", b"image", "image/png")


def test_logo_storage_and_delete_are_scoped_to_authenticated_owner(branding_client):
    client, objects = branding_client
    _authenticate_as(101)
    uploaded = client.post(
        "/api/branding/logo",
        files={"file": ("brand.png", _png(), "image/png")},
        data={"placement": "entire"},
    )
    assert uploaded.status_code == 200
    logo_path = next(iter(objects))
    assert logo_path.startswith("101/")

    _authenticate_as(202)
    client.delete("/api/branding/logo")
    assert logo_path in objects
    hidden = client.get("/api/branding/logo")
    assert hidden.status_code == 404

    _authenticate_as(101)
    assert client.get("/api/branding/logo").content == _png()
    assert client.delete("/api/branding/logo").status_code == 204
    assert logo_path not in objects


def test_saved_logo_path_with_missing_storage_object_returns_optional_404(branding_client):
    client, objects = branding_client
    _authenticate_as(101)
    response = client.post(
        "/api/branding/logo",
        files={"file": ("brand.png", _png(), "image/png")},
    )
    assert response.status_code == 200
    objects.clear()  # simulate an object removed outside the application
    missing = client.get("/api/branding/logo")
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Brand logo object not found"


def test_user_without_a_saved_logo_gets_optional_404(branding_client):
    client, _ = branding_client
    _authenticate_as(101)
    response = client.get("/api/branding/logo")
    assert response.status_code == 404
    assert response.json()["detail"] == "Brand logo not configured"


def test_branding_response_omits_logo_url_when_user_has_no_logo(branding_client):
    client, _ = branding_client
    _authenticate_as(101)

    response = client.get("/api/branding")

    assert response.status_code == 200
    assert response.json()["logo_url"] == ""


def test_logo_read_requires_authentication(branding_client):
    client, _ = branding_client
    response = client.get("/api/branding/logo")
    assert response.status_code == 401


@pytest.mark.parametrize(
    ("failure", "detail"),
    [
        (brand_service.StorageConfigurationError("bad settings"), "Brand logo storage is misconfigured"),
        (RuntimeError("upstream unavailable"), "Brand logo storage is unavailable"),
    ],
)
def test_logo_storage_failures_are_reported_as_service_unavailable(branding_client, monkeypatch, failure, detail):
    client, _ = branding_client
    _authenticate_as(101)
    client.post(
        "/api/branding/logo",
        files={"file": ("brand.png", _png(), "image/png")},
    )
    monkeypatch.setattr(brand_service, "_storage_request", lambda *_args, **_kwargs: (_ for _ in ()).throw(failure))

    response = client.get("/api/branding/logo")
    assert response.status_code == 503
    assert response.json()["detail"] == detail


@pytest.mark.parametrize(
    ("failure", "detail"),
    [
        (brand_service.StorageConfigurationError("configured bucket unavailable"), "Brand logo storage is misconfigured"),
        (RuntimeError("upstream Storage rejected the upload"), "Brand logo storage is unavailable"),
    ],
)
def test_logo_upload_storage_failures_are_logged_and_return_503(
    branding_client, monkeypatch, caplog, failure, detail
):
    client, _ = branding_client
    _authenticate_as(101)
    monkeypatch.setattr(
        brand_service,
        "_storage_request",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(failure),
    )

    response = client.post(
        "/api/branding/logo",
        files={"file": ("brand.png", _png(), "image/png")},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == detail
    assert "Brand logo Storage" in caplog.text
    assert str(failure) in caplog.text


def test_logo_mutation_requires_authentication(branding_client):
    client, _ = branding_client
    response = client.post(
        "/api/branding/logo",
        files={"file": ("brand.png", _png(), "image/png")},
    )
    assert response.status_code == 401
