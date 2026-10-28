import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api import music as music_module
from app.core.auth_dependencies import get_current_user, get_current_user_optional, get_db
from app.main import app
from app.models.database_models import Base, User
from app.services import music_storage_service

client = TestClient(app)
OWNER_ID = 701001


@pytest.fixture(autouse=True)
def music_test_environment(tmp_path: Path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'music-api.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add_all([
            User(id=OWNER_ID, email="music-owner@example.test", name="Owner"),
            User(id=OWNER_ID + 1, email="music-other@example.test", name="Other"),
        ])
        db.commit()

    def override_db():
        with sessions() as db:
            yield db

    active = {"id": OWNER_ID}
    def current_user():
        return User(id=active["id"], email="music@example.test", name="Music tester")

    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = current_user
    app.dependency_overrides[get_current_user_optional] = current_user
    objects: dict[str, bytes] = {}
    monkeypatch.setattr(music_storage_service, "upload_object", lambda path, body, _type: objects.__setitem__(path, body))
    monkeypatch.setattr(music_storage_service, "get_object", lambda path: objects[path])
    monkeypatch.setattr(music_storage_service, "delete_object", lambda path: objects.pop(path, None))
    monkeypatch.setattr(music_storage_service, "create_signed_url", lambda path: f"https://storage.test/sign/{path}")
    yield {"active": active, "objects": objects, "sessions": sessions}
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def _isolate_music_libraries(monkeypatch, music_dir: Path, tmp_path: Path) -> None:
    monkeypatch.setattr(music_module, "MUSIC_DIR", music_dir)


def _make_audio(path: Path, duration: float = 3.0) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi", "-i", f"sine=frequency=440:duration={duration}",
            "-c:a", "libmp3lame", "-b:a", "64k", str(path),
        ],
        capture_output=True, check=True,
    )


def test_list_music_returns_discovered_tracks(tmp_path: Path, monkeypatch):
    _make_audio(tmp_path / "traditional_elegance.mp3")
    _isolate_music_libraries(monkeypatch, tmp_path, tmp_path)

    response = client.get("/api/music")

    assert response.status_code == 200
    tracks = response.json()
    assert len(tracks) == 1
    assert tracks[0]["id"] == "traditional_elegance"
    assert "duration" in tracks[0]


def test_list_music_returns_the_demo_tracks():
    """The real assets/music/ library (not a monkeypatched temp dir) must
    include at least the original demo tracks - a superset, since the
    library is scanned dynamically and may grow with real tracks added
    later (out of scope for this test to enumerate exhaustively).
    """
    response = client.get("/api/music")

    assert response.status_code == 200
    ids = {t["id"] for t in response.json()}
    assert {"festive_silk", "traditional_elegance", "graceful_heritage"} <= ids


def test_list_music_empty_when_no_tracks(tmp_path: Path, monkeypatch):
    _isolate_music_libraries(monkeypatch, tmp_path, tmp_path)
    response = client.get("/api/music")
    assert response.status_code == 200
    assert response.json() == []


def test_preview_music_serves_audio(tmp_path: Path, monkeypatch):
    _make_audio(tmp_path / "festive_silk.mp3")
    _isolate_music_libraries(monkeypatch, tmp_path, tmp_path)

    response = client.get("/api/music/festive_silk/preview")

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert len(response.content) > 0


def test_preview_music_unknown_id_returns_404(tmp_path: Path, monkeypatch):
    _isolate_music_libraries(monkeypatch, tmp_path, tmp_path)
    response = client.get("/api/music/does-not-exist/preview")
    assert response.status_code == 404


def test_preview_music_does_not_expose_arbitrary_paths(tmp_path: Path, monkeypatch):
    _isolate_music_libraries(monkeypatch, tmp_path, tmp_path)
    # No track discovery match for a path-traversal-flavored id -> 404, not
    # a filesystem read outside MUSIC_DIR.
    response = client.get("/api/music/..%2F..%2Fsecrets/preview")
    assert response.status_code in (404, 400)


def test_upload_music_rejects_non_audio(tmp_path: Path, monkeypatch):
    response = client.post(
        "/api/music/upload",
        files={"file": ("fake.mp3", b"not-a-real-audio-file", "audio/mpeg")},
    )
    assert response.status_code == 400
    assert "Invalid or unsupported audio" in response.json()["detail"]


def test_music_endpoints_require_authentication(music_test_environment):
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_optional, None)
    assert client.get("/api/music").status_code == 401
    assert client.post("/api/music/upload", files={"file": ("x.mp3", b"bad", "audio/mpeg")}).status_code == 401
    assert client.get("/api/music/custom-1/preview").status_code == 401


def test_uploaded_soundtracks_are_private_and_owner_scoped(music_test_environment, tmp_path: Path):
    context = music_test_environment
    audio_path = tmp_path / "private_song.mp3"
    _make_audio(audio_path, duration=1.0)
    audio_bytes = audio_path.read_bytes()
    response = client.post("/api/music/upload", files={"file": ("private_song.mp3", audio_bytes, "audio/mpeg")})
    assert response.status_code == 200
    uploaded = response.json()
    assert uploaded["id"].startswith("custom-")
    assert "preview_url" in uploaded and "storage_path" not in uploaded
    storage_path = next(iter(context["objects"]))
    assert storage_path.startswith(f"users/{OWNER_ID}/")

    assert client.get("/api/music").json()[-1]["id"] == uploaded["id"]
    assert client.get(f"/api/music/{uploaded['id']}/preview").content == audio_bytes

    context["active"]["id"] = OWNER_ID + 1
    assert all(track["id"] != uploaded["id"] for track in client.get("/api/music").json())
    assert client.get(f"/api/music/{uploaded['id']}/preview").status_code == 404
    assert client.delete(f"/api/music/{uploaded['id']}").status_code == 404
    assert storage_path in context["objects"]

    context["active"]["id"] = OWNER_ID
    assert client.delete(f"/api/music/{uploaded['id']}").status_code == 204
    assert storage_path not in context["objects"]


@pytest.mark.parametrize("filename", ["../../outside.mp3", "..\\..\\outside.mp3"])
def test_music_upload_rejects_path_traversal(music_test_environment, filename: str):
    response = client.post("/api/music/upload", files={"file": (filename, b"bad", "audio/mpeg")})
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid music filename"


def test_music_storage_paths_are_user_scoped_and_traversal_safe():
    assert music_storage_service.validate_storage_path("users/10/song.mp3", 10) == "users/10/song.mp3"
    for path in ("users/11/song.mp3", "users/10/../secret.mp3", "users\\10\\song.mp3"):
        with pytest.raises(music_storage_service.MusicStorageError):
            music_storage_service.validate_storage_path(path, 10)
