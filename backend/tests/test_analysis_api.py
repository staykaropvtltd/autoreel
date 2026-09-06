import time
from pathlib import Path

from fastapi.testclient import TestClient

from app.api import analysis, videos
from app.main import app

client = TestClient(app)


def _poll_until_done(job_id: str, timeout: float = 30.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        response = client.get(f"/api/analysis/{job_id}")
        assert response.status_code == 200
        body = response.json()
        if body["status"] in ("completed", "failed"):
            return body
        time.sleep(0.2)
    raise AssertionError(f"Analysis job {job_id} did not finish within {timeout}s")


def test_analyze_requires_job_id_or_demo():
    response = client.post("/api/analysis/analyze", json={})

    assert response.status_code == 400
    assert "job_id" in response.json()["detail"].lower()


def test_analyze_rejects_unknown_job_id():
    response = client.post("/api/analysis/analyze", json={"job_id": "does-not-exist"})

    assert response.status_code == 404


def test_analyze_uploaded_videos_end_to_end(
    synthetic_video_with_audio: Path, synthetic_two_scene_video: Path, monkeypatch, tmp_path: Path
):
    uploads_dir = tmp_path / "uploads"
    monkeypatch.setattr(videos, "RAW_UPLOADS_DIR", uploads_dir)
    monkeypatch.setattr(analysis, "RAW_UPLOADS_DIR", uploads_dir)

    with open(synthetic_video_with_audio, "rb") as f1, open(synthetic_two_scene_video, "rb") as f2:
        upload_response = client.post(
            "/api/videos/upload",
            files=[
                ("files", (synthetic_video_with_audio.name, f1, "video/mp4")),
                ("files", (synthetic_two_scene_video.name, f2, "video/mp4")),
            ],
        )
    upload_job_id = upload_response.json()["job_id"]

    analyze_response = client.post("/api/analysis/analyze", json={"job_id": upload_job_id})
    assert analyze_response.status_code == 200
    analysis_body = analyze_response.json()
    assert analysis_body["status"] == "queued"

    result = _poll_until_done(analysis_body["job_id"])

    assert result["status"] == "completed"
    assert result["videos_analyzed"] == 2
    assert result["total_segments"] >= 2
    assert result["processing_time_seconds"] > 0
    assert isinstance(result["clips"], list)
    assert len(result["clips"]) == result["total_segments"]
    for clip in result["clips"]:
        for key in ("source_file", "start_time", "end_time", "duration", "score", "metrics", "reasons", "selected", "locked"):
            assert key in clip


def test_analyze_rejects_when_no_demo_footage(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(analysis, "DEMO_RAW_DIR", tmp_path / "no_demo")

    response = client.post("/api/analysis/analyze", json={"use_demo": True})

    assert response.status_code == 400
    assert "demo" in response.json()["detail"].lower()


def test_get_analysis_unknown_job_returns_404():
    response = client.get("/api/analysis/does-not-exist")

    assert response.status_code == 404
