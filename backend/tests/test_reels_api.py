from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api import reels
from app.main import app

client = TestClient(app)


def _batch_clip_payload(source_file: str, start: float, end: float, score: int) -> dict:
    return {
        "source_file": source_file,
        "start_time": start,
        "end_time": end,
        "duration": end - start,
        "score": score,
        "metrics": {
            "avg_sharpness": 300.0,
            "avg_brightness": 130.0,
            "dark_frame_ratio": 0.0,
            "avg_motion": 15.0,
            "sampled_frame_count": 4,
        },
        "reasons": [],
        "perceptual_hash": "0" * 16,
        "status": "selected",
        "selected": True,
    }


def test_generate_reel_rejects_empty_selection():
    response = client.post("/api/reels/generate", json={"selected_clips": []})

    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_generate_reel_rejects_missing_source_video():
    payload = {"selected_clips": [_batch_clip_payload("does_not_exist.mp4", 0.0, 3.0, 90)]}

    response = client.post("/api/reels/generate", json=payload)

    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


def test_generate_reel_rejects_path_traversal_filename():
    payload = {
        "selected_clips": [_batch_clip_payload("does_not_exist.mp4", 0.0, 3.0, 90)],
        "output_filename": "../../evil.mp4",
    }

    response = client.post("/api/reels/generate", json=payload)

    assert response.status_code == 400


def test_generate_reel_end_to_end(synthetic_video_with_audio: Path, monkeypatch, tmp_path: Path):
    uploads_dir = tmp_path / "uploads"
    outputs_dir = tmp_path / "outputs"
    uploads_dir.mkdir()
    (uploads_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())

    monkeypatch.setattr(reels, "RAW_UPLOADS_DIR", uploads_dir)
    monkeypatch.setattr(reels, "OUTPUTS_DIR", outputs_dir)

    payload = {
        "selected_clips": [_batch_clip_payload(synthetic_video_with_audio.name, 0.0, 1.0, 90)],
        "output_filename": "test_reel.mp4",
        "min_total_duration": 0.5,
        "max_total_duration": 5.0,
        "brand": {"text": None},
    }

    response = client.post("/api/reels/generate", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["width"] == 1080
    assert body["height"] == 1920
    assert body["video_codec"] == "h264"
    assert Path(body["output_path"]).exists()


# --- Phase 6: job-tracked generation, status polling, download ---


def test_generate_reel_returns_reel_id_and_download_url(
    synthetic_video_with_audio: Path, monkeypatch, tmp_path: Path
):
    uploads_dir = tmp_path / "uploads"
    outputs_dir = tmp_path / "outputs"
    uploads_dir.mkdir()
    (uploads_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())

    monkeypatch.setattr(reels, "RAW_UPLOADS_DIR", uploads_dir)
    monkeypatch.setattr(reels, "OUTPUTS_DIR", outputs_dir)

    payload = {
        "selected_clips": [_batch_clip_payload(synthetic_video_with_audio.name, 0.0, 1.0, 90)],
        "min_total_duration": 0.5,
        "max_total_duration": 5.0,
        "brand": {"text": None},
    }

    response = client.post("/api/reels/generate", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert "reel_id" in body
    assert body["download_url"] == f"/api/reels/{body['reel_id']}/download"


def test_get_reel_status(synthetic_video_with_audio: Path, monkeypatch, tmp_path: Path):
    uploads_dir = tmp_path / "uploads"
    outputs_dir = tmp_path / "outputs"
    uploads_dir.mkdir()
    (uploads_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())

    monkeypatch.setattr(reels, "RAW_UPLOADS_DIR", uploads_dir)
    monkeypatch.setattr(reels, "OUTPUTS_DIR", outputs_dir)

    payload = {
        "selected_clips": [_batch_clip_payload(synthetic_video_with_audio.name, 0.0, 1.0, 90)],
        "min_total_duration": 0.5,
        "max_total_duration": 5.0,
        "brand": {"text": None},
    }
    reel_id = client.post("/api/reels/generate", json=payload).json()["reel_id"]

    response = client.get(f"/api/reels/{reel_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["reel_id"] == reel_id
    assert body["status"] == "completed"
    assert body["width"] == 1080


def test_get_reel_status_unknown_id_returns_404():
    response = client.get("/api/reels/does-not-exist")

    assert response.status_code == 404


def test_download_reel_returns_video_file(synthetic_video_with_audio: Path, monkeypatch, tmp_path: Path):
    uploads_dir = tmp_path / "uploads"
    outputs_dir = tmp_path / "outputs"
    uploads_dir.mkdir()
    (uploads_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())

    monkeypatch.setattr(reels, "RAW_UPLOADS_DIR", uploads_dir)
    monkeypatch.setattr(reels, "OUTPUTS_DIR", outputs_dir)

    payload = {
        "selected_clips": [_batch_clip_payload(synthetic_video_with_audio.name, 0.0, 1.0, 90)],
        "min_total_duration": 0.5,
        "max_total_duration": 5.0,
        "brand": {"text": None},
    }
    reel_id = client.post("/api/reels/generate", json=payload).json()["reel_id"]

    response = client.get(f"/api/reels/{reel_id}/download")

    assert response.status_code == 200
    assert response.headers["content-type"] == "video/mp4"
    assert len(response.content) > 0


def test_download_reel_unknown_id_returns_404():
    response = client.get("/api/reels/does-not-exist/download")

    assert response.status_code == 404


def test_generate_reel_with_analysis_job_id_resolves_source_dir(
    synthetic_video_with_audio: Path, monkeypatch, tmp_path: Path
):
    from app.core.job_store import create_analysis_job

    job_scoped_dir = tmp_path / "uploads" / "job-abc"
    job_scoped_dir.mkdir(parents=True)
    (job_scoped_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())
    create_analysis_job("job-abc-analysis", source_dir=job_scoped_dir)

    outputs_dir = tmp_path / "outputs"
    monkeypatch.setattr(reels, "OUTPUTS_DIR", outputs_dir)

    payload = {
        "selected_clips": [_batch_clip_payload(synthetic_video_with_audio.name, 0.0, 1.0, 90)],
        "analysis_job_id": "job-abc-analysis",
        "min_total_duration": 0.5,
        "max_total_duration": 5.0,
        "brand": {"text": None},
    }

    response = client.post("/api/reels/generate", json=payload)

    assert response.status_code == 200
    assert response.json()["width"] == 1080


# --- Phase 7: story-ordered, duration-target reel planning ---


def _completed_analysis_job_with_clips(job_id: str, source_dir: Path) -> None:
    from app.core.job_store import create_analysis_job, update_analysis_job
    from app.schemas.analysis import AnalysisResult

    clips = [
        _batch_clip_payload(f"v{i}.mp4", 0.0, 4.0, score=95 - i * 3) for i in range(6)
    ]
    from app.schemas.batch import BatchAnalysisResult, BatchClip

    batch_clips = [BatchClip(**c) for c in clips]
    batch_result = BatchAnalysisResult(
        batch_id="test-batch",
        input_video_count=6,
        total_segments=6,
        accepted_before_dedupe=6,
        duplicates_removed=0,
        final_selected_count=6,
        processing_time_seconds=0.1,
        selected_clips=batch_clips,
        all_clips=batch_clips,
    )
    create_analysis_job(job_id, source_dir=source_dir)
    update_analysis_job(
        job_id,
        status="completed",
        stage="completed",
        per_video_results=[],
        result=batch_result,
    )


def test_plan_reel_returns_story_ordered_plan(tmp_path: Path):
    _completed_analysis_job_with_clips("plan-job-1", tmp_path)

    response = client.post(
        "/api/reels/plan", json={"analysis_job_id": "plan-job-1", "target_duration": 15.0}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["target_duration"] == 15.0
    assert body["estimated_duration"] <= 15.0 + 1e-6
    assert len(body["clips"]) > 0
    assert body["clips"][0]["position"] == 1
    for clip in body["clips"]:
        assert "shot_role" in clip
        assert "role_confidence" in clip


def test_plan_reel_rejects_unknown_analysis_job():
    response = client.post(
        "/api/reels/plan", json={"analysis_job_id": "does-not-exist", "target_duration": 15.0}
    )

    assert response.status_code == 404


def test_generate_reel_from_plan_end_to_end(synthetic_video_with_audio: Path, monkeypatch, tmp_path: Path):
    uploads_dir = tmp_path / "uploads"
    outputs_dir = tmp_path / "outputs"
    uploads_dir.mkdir()
    (uploads_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())

    monkeypatch.setattr(reels, "OUTPUTS_DIR", outputs_dir)

    from app.core.job_store import create_analysis_job, update_analysis_job
    from app.schemas.batch import BatchAnalysisResult, BatchClip

    clip = BatchClip(**_batch_clip_payload(synthetic_video_with_audio.name, 0.0, 1.0, 90))
    batch_result = BatchAnalysisResult(
        batch_id="test-batch-2",
        input_video_count=1,
        total_segments=1,
        accepted_before_dedupe=1,
        duplicates_removed=0,
        final_selected_count=1,
        processing_time_seconds=0.1,
        selected_clips=[clip],
        all_clips=[clip],
    )
    create_analysis_job("plan-job-2", source_dir=uploads_dir)
    update_analysis_job("plan-job-2", status="completed", stage="completed", per_video_results=[], result=batch_result)

    plan_response = client.post(
        "/api/reels/plan", json={"analysis_job_id": "plan-job-2", "target_duration": 5.0, "min_quality_score": 0}
    )
    assert plan_response.status_code == 200
    reel_plan = plan_response.json()
    assert len(reel_plan["clips"]) == 1

    generate_response = client.post(
        "/api/reels/generate",
        json={
            "reel_plan": reel_plan,
            "analysis_job_id": "plan-job-2",
            "brand": {"text": None},
        },
    )

    assert generate_response.status_code == 200
    body = generate_response.json()
    assert body["width"] == 1080
    assert body["height"] == 1920
    assert body["clip_count"] == 1


# --- Phase 8: editor plan (transitions, branding, product overlays, thumbnails) ---


def test_plan_reel_includes_thumbnail_urls(synthetic_video_with_audio: Path, tmp_path: Path, monkeypatch):
    from app.api import reels as reels_module

    monkeypatch.setattr(reels_module, "THUMBNAIL_CACHE_DIR", tmp_path / "thumb_cache")

    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())

    from app.core.job_store import create_analysis_job, update_analysis_job
    from app.schemas.batch import BatchAnalysisResult, BatchClip

    clip = BatchClip(**_batch_clip_payload(synthetic_video_with_audio.name, 0.0, 1.0, 90))
    batch_result = BatchAnalysisResult(
        batch_id="thumb-batch", input_video_count=1, total_segments=1, accepted_before_dedupe=1,
        duplicates_removed=0, final_selected_count=1, processing_time_seconds=0.1,
        selected_clips=[clip], all_clips=[clip],
    )
    create_analysis_job("thumb-job", source_dir=source_dir)
    update_analysis_job("thumb-job", status="completed", stage="completed", per_video_results=[], result=batch_result)

    response = client.post("/api/reels/plan", json={"analysis_job_id": "thumb-job", "target_duration": 5.0})

    assert response.status_code == 200
    clips = response.json()["clips"]
    assert len(clips) == 1
    assert clips[0]["thumbnail_url"] is not None
    assert clips[0]["thumbnail_url"].startswith("/api/thumbnails/")


def test_generate_reel_with_transitions_and_product_overlays(
    synthetic_video_with_audio: Path, synthetic_two_scene_video: Path, monkeypatch, tmp_path: Path
):
    uploads_dir = tmp_path / "uploads"
    outputs_dir = tmp_path / "outputs"
    uploads_dir.mkdir()
    (uploads_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())
    (uploads_dir / synthetic_two_scene_video.name).write_bytes(synthetic_two_scene_video.read_bytes())
    monkeypatch.setattr(reels, "OUTPUTS_DIR", outputs_dir)
    monkeypatch.setattr(reels, "RAW_UPLOADS_DIR", uploads_dir)

    reel_plan = {
        "target_duration": 2.0,
        "estimated_duration": 2.0,
        "duration_difference": 0.0,
        "processing_time_seconds": 0.0,
        "clips": [
            {
                "position": 1, "source_file": synthetic_video_with_audio.name,
                "original_start": 0.0, "original_end": 1.0, "planned_start": 0.0, "planned_end": 1.0,
                "planned_duration": 1.0, "score": 90, "shot_role": "HERO", "role_confidence": 0.9,
                "transition_in": {"type": "none", "duration": 0.0},
            },
            {
                "position": 2, "source_file": synthetic_two_scene_video.name,
                "original_start": 0.0, "original_end": 1.0, "planned_start": 0.0, "planned_end": 1.0,
                "planned_duration": 1.0, "score": 85, "shot_role": "DETAIL", "role_confidence": 0.7,
                "transition_in": {"type": "zoom_in", "duration": 0.5},
            },
        ],
        "branding": {"brand_name": "KALADHAR HEIRLOOMS"},
        "product": {"material": "Silk", "price": "Rs 4,999"},
        "overlays": {"brand_placement": "beginning", "material_placement": "detail_clip", "material_clip_position": 2, "price_placement": "final_clip"},
    }

    response = client.post(
        "/api/reels/generate",
        json={"reel_plan": reel_plan, "output_filename": "edited_reel.mp4"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["width"] == 1080
    assert body["height"] == 1920
    assert body["clip_count"] == 2


# --- Phase 9: music-in-plan generation, path-traversal rejection, duration status ---


def test_generate_reel_with_music_end_to_end(
    synthetic_video_with_audio: Path, monkeypatch, tmp_path: Path
):
    import subprocess

    uploads_dir = tmp_path / "uploads"
    outputs_dir = tmp_path / "outputs"
    music_dir = tmp_path / "music"
    uploads_dir.mkdir()
    music_dir.mkdir()
    (uploads_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())
    subprocess.run(
        ["ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
         "-c:a", "libmp3lame", "-b:a", "64k", str(music_dir / "test_song.mp3")],
        capture_output=True, check=True,
    )

    monkeypatch.setattr(reels, "OUTPUTS_DIR", outputs_dir)
    monkeypatch.setattr(reels, "RAW_UPLOADS_DIR", uploads_dir)
    monkeypatch.setattr(reels, "MUSIC_DIR", music_dir)

    reel_plan = {
        "target_duration": 1.0,
        "estimated_duration": 1.0,
        "duration_difference": 0.0,
        "processing_time_seconds": 0.0,
        "clips": [
            {
                "position": 1, "source_file": synthetic_video_with_audio.name,
                "original_start": 0.0, "original_end": 1.0, "planned_start": 0.0, "planned_end": 1.0,
                "planned_duration": 1.0, "score": 90, "shot_role": "HERO", "role_confidence": 0.9,
                "transition_in": {"type": "none", "duration": 0.0},
            },
        ],
        "branding": {"brand_name": None} if False else {},
        "music": {
            "track_id": "test_song", "track_name": "Test Song", "source_path": "test_song.mp3",
            "source_duration": 3.0, "start_time": 0.0, "end_time": 1.0, "volume": 0.7,
            "loop_if_needed": True, "preserve_original_audio": False,
        },
    }

    response = client.post("/api/reels/generate", json={"reel_plan": reel_plan})

    assert response.status_code == 200
    body = response.json()
    assert body["audio_codec"] == "aac"
    assert body["duration"] == pytest.approx(1.0, abs=0.3)

    # The selected music (preserve_original_audio=False) must be the ONLY
    # audio, and must cover the whole Reel - video/audio/container duration
    # must all agree (the exact bug class the earlier truncation fix guards).
    from app.services.video_metadata import get_video_stream_duration

    video_stream_duration = get_video_stream_duration(Path(body["output_path"]))
    assert video_stream_duration == pytest.approx(body["duration"], abs=0.3)


def test_generate_reel_music_path_traversal_is_rejected(
    synthetic_video_with_audio: Path, monkeypatch, tmp_path: Path
):
    uploads_dir = tmp_path / "uploads"
    outputs_dir = tmp_path / "outputs"
    music_dir = tmp_path / "music"
    uploads_dir.mkdir()
    music_dir.mkdir()
    (uploads_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())

    monkeypatch.setattr(reels, "OUTPUTS_DIR", outputs_dir)
    monkeypatch.setattr(reels, "RAW_UPLOADS_DIR", uploads_dir)
    monkeypatch.setattr(reels, "MUSIC_DIR", music_dir)

    reel_plan = {
        "target_duration": 1.0, "estimated_duration": 1.0, "duration_difference": 0.0,
        "processing_time_seconds": 0.0,
        "clips": [
            {
                "position": 1, "source_file": synthetic_video_with_audio.name,
                "original_start": 0.0, "original_end": 1.0, "planned_start": 0.0, "planned_end": 1.0,
                "planned_duration": 1.0, "score": 90, "shot_role": "HERO", "role_confidence": 0.9,
                "transition_in": {"type": "none", "duration": 0.0},
            },
        ],
        "music": {
            "track_id": "evil", "track_name": "evil", "source_path": "../../../windows/win.ini",
            "source_duration": 3.0, "start_time": 0.0, "end_time": 1.0, "volume": 0.7,
            "loop_if_needed": True, "preserve_original_audio": False,
        },
    }

    response = client.post("/api/reels/generate", json={"reel_plan": reel_plan})

    assert response.status_code == 400


def test_generate_reel_returns_duration_status_field(
    synthetic_video_with_audio: Path, monkeypatch, tmp_path: Path
):
    uploads_dir = tmp_path / "uploads"
    outputs_dir = tmp_path / "outputs"
    uploads_dir.mkdir()
    (uploads_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())

    monkeypatch.setattr(reels, "OUTPUTS_DIR", outputs_dir)
    monkeypatch.setattr(reels, "RAW_UPLOADS_DIR", uploads_dir)

    payload = {
        "selected_clips": [_batch_clip_payload(synthetic_video_with_audio.name, 0.0, 1.0, 90)],
        "min_total_duration": 0.5, "max_total_duration": 5.0, "brand": {"text": None},
    }

    response = client.post("/api/reels/generate", json=payload)

    assert response.status_code == 200
    assert response.json()["duration_status"] in ("ok", "insufficient_content")
