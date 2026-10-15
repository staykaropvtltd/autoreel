from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api import thumbnails
from app.core.auth_dependencies import get_current_user
from app.core.job_store import register_thumbnail_owner
from app.main import app
from app.models.database_models import User
from app.services.thumbnail_service import get_or_create_thumbnail, thumbnail_cache_key

client = TestClient(app)
OWNER_ID = 445566


@pytest.fixture(autouse=True)
def authenticated_thumbnails():
    app.dependency_overrides[get_current_user] = lambda: User(
        id=OWNER_ID, email="thumbnail-owner@example.test", name="Owner"
    )
    yield
    app.dependency_overrides.pop(get_current_user, None)


def test_get_thumbnail_rejects_invalid_key_format():
    response = client.get("/api/thumbnails/../../etc")
    assert response.status_code in (400, 404)  # path is normalized by the router; either is safe

    response = client.get("/api/thumbnails/not-hex!!")
    assert response.status_code == 400


def test_get_thumbnail_returns_404_for_unknown_key(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(thumbnails, "THUMBNAIL_CACHE_DIR", tmp_path)
    response = client.get("/api/thumbnails/abcdef1234567890abcd")
    assert response.status_code == 404


def test_get_thumbnail_serves_cached_file(monkeypatch, tmp_path: Path, synthetic_video_with_audio: Path):
    monkeypatch.setattr(thumbnails, "THUMBNAIL_CACHE_DIR", tmp_path)

    thumb_path = get_or_create_thumbnail(synthetic_video_with_audio, 0.2, tmp_path)
    key = thumb_path.stem
    register_thumbnail_owner(key, OWNER_ID)

    response = client.get(f"/api/thumbnails/{key}")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert len(response.content) > 0


def test_thumbnail_requires_authentication(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(thumbnails, "THUMBNAIL_CACHE_DIR", tmp_path)
    (tmp_path / "abcdef1234567890abcd.jpg").write_bytes(b"private")
    register_thumbnail_owner("abcdef1234567890abcd", OWNER_ID)
    app.dependency_overrides.pop(get_current_user, None)
    assert client.get("/api/thumbnails/abcdef1234567890abcd").status_code == 401


def test_thumbnail_is_owner_scoped(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(thumbnails, "THUMBNAIL_CACHE_DIR", tmp_path)
    key = "abcdef1234567890abcd"
    (tmp_path / f"{key}.jpg").write_bytes(b"private")
    register_thumbnail_owner(key, OWNER_ID)
    app.dependency_overrides[get_current_user] = lambda: User(
        id=OWNER_ID + 1, email="other@example.test", name="Other"
    )
    assert client.get(f"/api/thumbnails/{key}").status_code == 404


def test_thumbnail_route_does_not_expose_storage_files_directly():
    response = client.get("/storage/temp/thumbnails/abcdef1234567890abcd.jpg")
    assert response.status_code == 404


def test_thumbnail_cache_key_is_stable_and_alnum():
    key1 = thumbnail_cache_key("clip.mp4", 1.234)
    key2 = thumbnail_cache_key("clip.mp4", 1.234)
    key3 = thumbnail_cache_key("clip.mp4", 5.0)

    assert key1 == key2
    assert key1 != key3
    assert key1.isalnum()


def test_get_or_create_thumbnail_is_cached_not_regenerated(tmp_path: Path, synthetic_video_with_audio: Path):
    first = get_or_create_thumbnail(synthetic_video_with_audio, 0.1, tmp_path)
    mtime_before = first.stat().st_mtime

    second = get_or_create_thumbnail(synthetic_video_with_audio, 0.1, tmp_path)

    assert second == first
    assert second.stat().st_mtime == mtime_before
