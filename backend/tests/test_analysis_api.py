import time
import uuid
import threading
from pathlib import Path
from types import SimpleNamespace

import pytest
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


def _fake_batch_result():
    return SimpleNamespace(
        processing_time_seconds=0.01,
        total_segments=0,
        accepted_before_dedupe=0,
        duplicates_removed=0,
        final_selected_count=0,
        all_clips=[],
    )


def _create_analysis_job(tmp_path: Path) -> str:
    from app.core.job_store import create_analysis_job

    job_id = str(uuid.uuid4())
    create_analysis_job(job_id, source_dir=tmp_path)
    return job_id


def test_analyze_requires_job_id_or_demo():
    response = client.post("/api/analysis/analyze", json={})

    assert response.status_code == 400
    assert "job_id" in response.json()["detail"].lower()


def test_analyze_rejects_unknown_job_id():
    response = client.post("/api/analysis/analyze", json={"job_id": str(uuid.uuid4())})

    assert response.status_code == 404


def test_analyze_rejects_malformed_uuid_identifiers():
    assert client.post("/api/analysis/analyze", json={"job_id": "../secret"}).status_code == 422
    assert client.get("/api/analysis/not-a-uuid").status_code == 422
    assert client.post("/api/analysis/analyze", json={"unknown": True}).status_code == 422


def test_analysis_response_contract_rejects_unknown_status_and_stage():
    from pydantic import ValidationError

    from app.api.analysis import AnalysisStatusResponse

    with pytest.raises(ValidationError):
        AnalysisStatusResponse(job_id=uuid.uuid4(), status="running")
    with pytest.raises(ValidationError):
        AnalysisStatusResponse(job_id=uuid.uuid4(), status="processing", stage="rendering")


def test_completed_analysis_response_omits_nullable_nested_clip_fields():
    from app.core.job_store import create_analysis_job, update_analysis_job
    from app.schemas.analysis import QualityMetrics
    from app.schemas.batch import BatchClip, SelectionStatus

    job_id = str(uuid.uuid4())
    clip = BatchClip(
        source_file="video.mp4",
        start_time=0,
        end_time=2,
        duration=2,
        score=80,
        metrics=QualityMetrics(
            avg_sharpness=1,
            avg_brightness=1,
            dark_frame_ratio=0,
            avg_motion=0.3,
            sampled_frame_count=4,
        ),
        reasons=["clear subject"],
        perceptual_hash="abc123",
        status=SelectionStatus.SELECTED,
        selected=True,
    )
    batch_result = SimpleNamespace(
        total_segments=1,
        accepted_before_dedupe=1,
        duplicates_removed=0,
        final_selected_count=1,
        processing_time_seconds=0.1,
        all_clips=[clip],
    )
    create_analysis_job(job_id, source_dir=Path.cwd())
    update_analysis_job(
        job_id,
        status="completed",
        stage="completed",
        result=batch_result,
        per_video_results=[SimpleNamespace(processing_time_seconds=0.1)],
    )

    response = client.get(f"/api/analysis/{job_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["clips"] == [
        {
            "clip_id": str(clip.clip_id),
            "source_file": "video.mp4",
            "start_time": 0,
            "end_time": 2,
            "duration": 2,
            "score": 80,
            "metrics": {
                "avg_sharpness": 1,
                "avg_brightness": 1,
                "dark_frame_ratio": 0,
                "avg_motion": 0.3,
                "sampled_frame_count": 4,
            },
            "reasons": ["clear subject"],
            "perceptual_hash": "abc123",
            "status": "selected",
            "selected": True,
            "locked": False,
        }
    ]


def test_analyze_rejects_unregistered_template():
    response = client.post(
        "/api/analysis/analyze",
        json={"use_demo": True, "template_id": str(uuid.uuid4())},
    )
    assert response.status_code == 404


def test_analyze_accepts_registered_template(monkeypatch, tmp_path: Path):
    from types import SimpleNamespace

    from app.core.job_store import create_template_image

    template_id = str(uuid.uuid4())
    template_root = tmp_path / "templates"
    template_root.mkdir()
    template_path = template_root / "registered.png"
    template_path.write_bytes(b"template")
    create_template_image(template_id, "registered.png", str(template_path))
    demo_dir = tmp_path / "demo"
    demo_dir.mkdir()
    (demo_dir / "source.mp4").write_bytes(b"test")

    monkeypatch.setattr(analysis, "TEMPLATE_IMAGES_DIR", template_root)
    monkeypatch.setattr(analysis, "DEMO_RAW_DIR", demo_dir)
    monkeypatch.setattr(analysis, "get_video_metadata", lambda _path: SimpleNamespace(duration=1.0))
    monkeypatch.setattr(analysis, "_run_analysis_job", lambda *_args: None)

    response = client.post(
        "/api/analysis/analyze", json={"use_demo": True, "template_id": template_id}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "queued"
    from app.core.job_store import get_analysis_job

    assert get_analysis_job(response.json()["job_id"])["template_id"] == template_id


def test_analyze_rejects_missing_or_invalid_upload_source(monkeypatch, tmp_path: Path):
    from app.core.job_store import create_upload_job

    upload_id = str(uuid.uuid4())
    uploads_dir = tmp_path / "uploads"
    (uploads_dir / upload_id).mkdir(parents=True)
    create_upload_job(upload_id, [{"filename": "missing.mp4", "size": 100}])
    monkeypatch.setattr(analysis, "RAW_UPLOADS_DIR", uploads_dir)

    response = client.post("/api/analysis/analyze", json={"job_id": upload_id})
    assert response.status_code == 400

    (uploads_dir / upload_id / "invalid.mp4").write_bytes(b"not a video")
    create_upload_job(upload_id, [{"filename": "invalid.mp4", "size": 12}])
    response = client.post("/api/analysis/analyze", json={"job_id": upload_id})
    assert response.status_code == 400


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
    response = client.get(f"/api/analysis/{uuid.uuid4()}")

    assert response.status_code == 404


def test_analysis_continues_after_one_corrupt_video_and_hides_raw_error(monkeypatch, tmp_path: Path):
    from app.core.job_store import get_analysis_job

    good = tmp_path / "good.mp4"
    corrupt = tmp_path / "corrupt.mp4"
    good.touch()
    corrupt.touch()

    def analyze(path: Path):
        if path.name == "corrupt.mp4":
            raise RuntimeError("ffmpeg failed at C:/private/customer/raw/corrupt.mp4")
        return SimpleNamespace(source=path.name, processing_time_seconds=0.01)

    monkeypatch.setattr(analysis, "analyze_video", analyze)
    monkeypatch.setattr(analysis, "select_best_clips", lambda _results: _fake_batch_result())
    job_id = _create_analysis_job(tmp_path)

    analysis._run_analysis_job(job_id, [good, corrupt])
    response = client.get(f"/api/analysis/{job_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["videos_analyzed"] == 1
    assert body["videos_failed"] == 1
    assert body["file_errors"] == [
        {
            "filename": "corrupt.mp4",
            "message": analysis._PER_FILE_ERROR,
        }
    ]
    assert "ffmpeg" not in response.text.lower()
    assert "customer" not in response.text.lower()
    assert [result.source for result in get_analysis_job(job_id)["per_video_results"]] == ["good.mp4"]


def test_analysis_fails_safely_when_all_videos_are_corrupt(monkeypatch, tmp_path: Path):
    paths = [tmp_path / "one.mp4", tmp_path / "two.mp4"]
    for path in paths:
        path.touch()
    monkeypatch.setattr(analysis, "analyze_video", lambda _path: (_ for _ in ()).throw(RuntimeError("private detail")))
    job_id = _create_analysis_job(tmp_path)

    analysis._run_analysis_job(job_id, paths)
    body = client.get(f"/api/analysis/{job_id}").json()

    assert body["status"] == "failed"
    assert body["stage"] == "failed"
    assert body["videos_analyzed"] == 0
    assert body["videos_failed"] == 2
    assert len(body["file_errors"]) == 2
    assert "private detail" not in str(body)


def test_analysis_concurrency_is_bounded_and_result_order_is_stable(monkeypatch, tmp_path: Path):
    paths = [tmp_path / f"video-{index}.mp4" for index in range(6)]
    active = 0
    peak = 0
    lock = threading.Lock()

    def analyze(path: Path):
        nonlocal active, peak
        with lock:
            active += 1
            peak = max(peak, active)
        time.sleep(0.02)
        with lock:
            active -= 1
        return SimpleNamespace(source=path.name, processing_time_seconds=0.01)

    monkeypatch.setattr(analysis, "analyze_video", analyze)
    monkeypatch.setattr(analysis, "select_best_clips", lambda _results: _fake_batch_result())
    job_id = _create_analysis_job(tmp_path)

    analysis._run_analysis_job(job_id, paths)

    assert peak <= analysis._ANALYSIS_MAX_WORKERS
    assert [result.source for result in analysis.get_analysis_job(job_id)["per_video_results"]] == [
        path.name for path in paths
    ]


def test_analysis_timeout_is_terminal_and_late_work_cannot_mark_success(monkeypatch, tmp_path: Path):
    path = tmp_path / "slow.mp4"
    path.touch()
    monkeypatch.setattr(
        analysis,
        "analyze_video",
        lambda _path: (time.sleep(0.15), SimpleNamespace(source="slow.mp4", processing_time_seconds=0.01))[1],
    )
    monkeypatch.setattr(analysis, "select_best_clips", lambda _results: _fake_batch_result())
    job_id = _create_analysis_job(tmp_path)

    analysis._run_analysis_job(job_id, [path], timeout_seconds=0.02)
    timed_out_body = client.get(f"/api/analysis/{job_id}").json()
    assert timed_out_body["status"] == "failed"
    assert timed_out_body["error"] == "Analysis timed out. Please try again."

    time.sleep(0.2)
    from app.core.job_store import update_analysis_job

    update_analysis_job(job_id, status="completed", stage="completed", result=_fake_batch_result())
    assert client.get(f"/api/analysis/{job_id}").json()["status"] == "failed"
