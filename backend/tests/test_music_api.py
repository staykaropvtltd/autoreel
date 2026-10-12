import subprocess
from pathlib import Path

from fastapi.testclient import TestClient

from app.api import music as music_module
from app.main import app

client = TestClient(app)


def _isolate_music_libraries(monkeypatch, music_dir: Path, tmp_path: Path) -> None:
    monkeypatch.setattr(music_module, "MUSIC_DIR", music_dir)
    monkeypatch.setattr(music_module, "CUSTOM_MUSIC_DIR", tmp_path / "custom_music")


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
    monkeypatch.setattr(music_module, "CUSTOM_MUSIC_DIR", tmp_path)
    response = client.post(
        "/api/music/upload",
        files={"file": ("fake.mp3", b"not-a-real-audio-file", "audio/mpeg")},
    )
    assert response.status_code == 400
    assert "Invalid or unsupported audio" in response.json()["detail"]
