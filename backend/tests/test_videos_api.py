from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api import videos
from app.core.auth_dependencies import get_current_user
from app.main import app
from app.models.database_models import Base, User

client = TestClient(app)
TEST_USER_ID = 678910


@pytest.fixture(autouse=True)
def authenticated_video_uploads(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'video-jobs.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add(User(id=TEST_USER_ID, email="video-upload@example.test", name="Video uploader"))
        db.commit()
    from app.core import job_store
    monkeypatch.setattr(job_store, "SessionLocal", sessions)
    app.dependency_overrides[get_current_user] = lambda: User(
        id=TEST_USER_ID, email="video-upload@example.test", name="Video uploader"
    )
    yield
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_upload_single_video(synthetic_video_with_audio: Path, monkeypatch, tmp_path: Path):
    monkeypatch.setattr(videos, "RAW_UPLOADS_DIR", tmp_path / "uploads")

    with open(synthetic_video_with_audio, "rb") as f:
        response = client.post(
            "/api/videos/upload",
            files=[("files", (synthetic_video_with_audio.name, f, "video/mp4"))],
        )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "uploaded"
    assert "job_id" in body
    assert len(body["files"]) == 1
    assert body["files"][0]["filename"] == synthetic_video_with_audio.name
    assert body["files"][0]["size"] > 0

    saved_path = (tmp_path / "uploads" / body["job_id"] / synthetic_video_with_audio.name)
    assert saved_path.exists()
    from app.core.job_store import get_upload_job
    owned_job = get_upload_job(body["job_id"], TEST_USER_ID)
    assert owned_job["user_id"] == TEST_USER_ID
    assert owned_job["files"][0]["user_id"] == TEST_USER_ID
    assert get_upload_job(body["job_id"], TEST_USER_ID + 1) is None


def test_upload_requires_authentication(monkeypatch, tmp_path: Path):
    app.dependency_overrides.pop(get_current_user, None)
    monkeypatch.setattr(videos, "RAW_UPLOADS_DIR", tmp_path / "uploads")
    response = client.post(
        "/api/videos/upload",
        files=[("files", ("clip.mp4", b"video", "video/mp4"))],
    )
    assert response.status_code == 401
    assert not (tmp_path / "uploads").exists()


def test_upload_stores_original_bytes_unchanged(synthetic_video_with_audio: Path, monkeypatch, tmp_path: Path):
    """Upload integrity: the endpoint must never re-encode or otherwise
    touch uploaded video bytes - only Reel rendering encodes anything. The
    file on disk after upload must be byte-for-byte identical to what was
    sent.
    """
    monkeypatch.setattr(videos, "RAW_UPLOADS_DIR", tmp_path / "uploads")
    original_bytes = synthetic_video_with_audio.read_bytes()

    with open(synthetic_video_with_audio, "rb") as f:
        response = client.post(
            "/api/videos/upload",
            files=[("files", (synthetic_video_with_audio.name, f, "video/mp4"))],
        )

    assert response.status_code == 200
    job_id = response.json()["job_id"]
    saved_path = tmp_path / "uploads" / job_id / synthetic_video_with_audio.name
    assert saved_path.read_bytes() == original_bytes


def test_upload_multiple_videos(
    synthetic_video_with_audio: Path, synthetic_video_no_audio: Path, monkeypatch, tmp_path: Path
):
    monkeypatch.setattr(videos, "RAW_UPLOADS_DIR", tmp_path / "uploads")

    with open(synthetic_video_with_audio, "rb") as f1, open(synthetic_video_no_audio, "rb") as f2:
        response = client.post(
            "/api/videos/upload",
            files=[
                ("files", (synthetic_video_with_audio.name, f1, "video/mp4")),
                ("files", (synthetic_video_no_audio.name, f2, "video/mp4")),
            ],
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["files"]) == 2


def test_upload_rejects_invalid_format(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(videos, "RAW_UPLOADS_DIR", tmp_path / "uploads")

    response = client.post(
        "/api/videos/upload",
        files=[("files", ("not_a_video.txt", b"hello world", "text/plain"))],
    )

    assert response.status_code == 400
    assert "unsupported" in response.json()["detail"].lower()


@pytest.mark.parametrize("filename", ["../../evil.mp4", "..\\..\\evil.mp4"])
def test_upload_rejects_path_traversal_filename(filename, monkeypatch, tmp_path: Path):
    monkeypatch.setattr(videos, "RAW_UPLOADS_DIR", tmp_path / "uploads")

    response = client.post(
        "/api/videos/upload",
        files=[("files", (filename, b"fake video bytes", "video/mp4"))],
    )

    assert response.status_code == 400
    assert not (tmp_path / "evil.mp4").exists()
    assert not (tmp_path / "uploads" / "evil.mp4").exists()


def test_upload_rejects_oversized_file(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(videos, "RAW_UPLOADS_DIR", tmp_path / "uploads")
    monkeypatch.setattr(videos, "MAX_FILE_SIZE_BYTES", 10)

    response = client.post(
        "/api/videos/upload",
        files=[("files", ("clip.mp4", b"this payload is definitely more than 10 bytes", "video/mp4"))],
    )

    assert response.status_code == 400
    assert "too large" in response.json()["detail"].lower()


def test_upload_rejects_empty_file(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(videos, "RAW_UPLOADS_DIR", tmp_path / "uploads")

    response = client.post(
        "/api/videos/upload",
        files=[("files", ("clip.mp4", b"", "video/mp4"))],
    )

    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_demo_status_reports_availability(monkeypatch, tmp_path: Path):
    empty_dir = tmp_path / "no_demo"
    monkeypatch.setattr(videos, "DEMO_RAW_DIR", empty_dir)

    response = client.get("/api/demo/status")

    assert response.status_code == 200
    assert response.json() == {"available": False}
