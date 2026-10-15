from pathlib import Path
from io import BytesIO
from urllib import response

import pytest
import uuid
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api import reels
from app.core.auth_dependencies import get_current_user, get_db
from app.main import app
from app.models.database_models import Base, CreditTransaction, Template, User
from app.services import credit_service, reel_history_service
from app.services import template_service
from PIL import Image

client = TestClient(app)

TEST_USER_ID = 987650


@pytest.fixture(autouse=True)
def reset_demo_credits(monkeypatch, tmp_path):
    """Give each test a fresh persistent-credit database and authenticated user."""
    engine = create_engine(f"sqlite:///{tmp_path / 'reel-api-test.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    from app.core import job_store
    monkeypatch.setattr(job_store, "SessionLocal", sessions)
    user = User(id=TEST_USER_ID, email="reel-api@example.test", name="Reel API")
    with sessions() as db:
        db.add(user)
        db.commit()

    def override_db():
        with sessions() as db:
            yield db

    monkeypatch.setitem(app.dependency_overrides, get_db, override_db)
    monkeypatch.setitem(
        app.dependency_overrides,
        get_current_user,
        lambda: User(id=TEST_USER_ID, email="reel-api@example.test", name="Reel API"),
    )
    monkeypatch.setattr(credit_service, "SessionLocal", sessions)
    monkeypatch.setattr(reel_history_service, "SessionLocal", sessions)
    monkeypatch.setattr(reels, "SessionLocal", sessions)
    # Keep existing rendering/API tests deterministic; the queued-worker path
    # has separate tests that hold and release the executor task explicitly.
    monkeypatch.setattr(reels._REEL_EXECUTOR, "submit", lambda fn, *args: fn(*args))
    yield
    Base.metadata.drop_all(engine)
    engine.dispose()


def _generate_result(payload: dict) -> tuple[dict, dict]:
    accepted = client.post("/api/reels/generate", json=payload)
    assert accepted.status_code == 202
    receipt = accepted.json()
    status = client.get(f"/api/reels/{receipt['reel_id']}").json()
    return receipt, status



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


def test_browser_rendered_reel_import_is_disabled_without_charging_or_persisting(
    monkeypatch, tmp_path: Path
):
    output_dir = tmp_path / "outputs"
    monkeypatch.setattr(reels, "OUTPUTS_DIR", output_dir)
    deductions: list[tuple[str, int]] = []
    monkeypatch.setattr(
        reels,
        "deduct_credits",
        lambda user_id, amount: deductions.append((user_id, amount)),
    )

    response = client.post(
        "/api/reels/import",
        files={"file": ("browser-render.mp4", b"untrusted browser output", "video/mp4")},
    )

    assert response.status_code == 410
    assert "project export endpoint" in response.json()["detail"].lower()
    assert deductions == []
    assert not output_dir.exists()


def test_generate_reel_rejects_empty_selection():
    receipt, status = _generate_result({"selected_clips": []})
    assert status["reel_id"] == receipt["reel_id"]
    assert status["status"] == "failed"
    assert "empty" in status["error"].lower()
    with credit_service.SessionLocal() as db:
        rows = db.query(CreditTransaction).filter(
            CreditTransaction.user_id == TEST_USER_ID,
            CreditTransaction.reel_id == receipt["reel_id"],
        ).order_by(CreditTransaction.id).all()
    assert [(row.transaction_type, row.amount) for row in rows] == [
        ("deduction", reels.REEL_GENERATION_COST),
        ("refund", reels.REEL_GENERATION_COST),
    ]


def test_generate_reel_returns_available_and_required_credits(monkeypatch):
    def insufficient_credits(_user_id: str, _amount: int, **_kwargs) -> int:
        raise ValueError("Insufficient credits. Available: 3, required: 10")

    monkeypatch.setattr(reels, "deduct_credits", insufficient_credits)
    _, status = _generate_result({})
    assert status["status"] == "failed"
    assert status["error"] == "Insufficient credits. Available: 3, required: 10"


def test_generate_reel_rejects_missing_source_video():
    payload = {"selected_clips": [_batch_clip_payload("does_not_exist.mp4", 0.0, 3.0, 90)]}

    _, status = _generate_result(payload)
    assert status["status"] == "failed"
    assert "not found" in status["error"].lower()


def test_generate_reel_rejects_path_traversal_filename():
    payload = {
        "selected_clips": [_batch_clip_payload("does_not_exist.mp4", 0.0, 3.0, 90)],
        "output_filename": "../../evil.mp4",
    }

    _, status = _generate_result(payload)
    assert status["status"] == "failed"


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

    _, status = _generate_result(payload)
    assert status["status"] == "completed"
    body = status["result"]
    assert body["width"] == 1080
    assert body["height"] == 1920
    assert body["video_codec"] == "h264"
    download_response = client.get(body["download_url"])
    assert download_response.status_code == 200
    assert download_response.headers["content-type"] == "video/mp4"
    assert download_response.content


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

    receipt, status = _generate_result(payload)
    body = status["result"]
    assert body["status"] == "completed"
    assert receipt["reel_id"] == body["reel_id"]
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
    reel_id = _generate_result(payload)[0]["reel_id"]

    response = client.get(f"/api/reels/{reel_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["reel_id"] == reel_id
    assert body["status"] == "completed"
    assert body["result"]["width"] == 1080


def test_get_reel_status_unknown_id_returns_404():
    response = client.get(f"/api/reels/{uuid.uuid4()}")

    assert response.status_code == 404


def test_generation_returns_job_receipt_before_worker_finishes(monkeypatch):
    submitted = []
    monkeypatch.setattr(reels._REEL_EXECUTOR, "submit", lambda fn, *args: submitted.append((fn, args)))
    request_id = str(uuid.uuid4())
    response = client.post("/api/reels/generate", json={"request_id": request_id})

    assert response.status_code == 202
    receipt = response.json()
    assert receipt["status"] == "queued"
    assert submitted
    status = client.get(f"/api/reels/{receipt['reel_id']}").json()
    assert status["status"] == "queued"
    assert status["result"] is None
    assert client.get("/api/health").status_code == 200
    reels._REEL_SLOTS.release()


def test_duplicate_generation_request_id_reuses_job_without_second_charge(monkeypatch):
    deductions = []
    original_deduct = reels.deduct_credits
    def count_deduction(user_id, amount, **kwargs):
        deductions.append((user_id, amount))
        return original_deduct(user_id, amount, **kwargs)
    monkeypatch.setattr(reels, "deduct_credits", count_deduction)
    request_id = str(uuid.uuid4())
    payload = {"request_id": request_id, "selected_clips": []}
    first = client.post("/api/reels/generate", json=payload).json()
    second = client.post("/api/reels/generate", json=payload).json()

    assert first["reel_id"] == second["reel_id"]
    assert deductions == [(TEST_USER_ID, reels.REEL_GENERATION_COST)]


def test_generation_capacity_rejects_extra_job_without_charging(monkeypatch):
    assert reels._REEL_SLOTS.acquire(blocking=False)
    assert reels._REEL_SLOTS.acquire(blocking=False)
    try:
        response = client.post("/api/reels/generate", json={})
    finally:
        reels._REEL_SLOTS.release()
        reels._REEL_SLOTS.release()
    assert response.status_code == 503


def test_failed_background_render_removes_partial_output(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(reels, "OUTPUTS_DIR", tmp_path)
    def fail(_request, reel_id, _user_id):
        (tmp_path / f"{reel_id}.mp4").write_bytes(b"partial")
        raise HTTPException(status_code=500, detail="render failed")
    monkeypatch.setattr(reels, "_generate_reel_blocking", fail)

    response = client.post("/api/reels/generate", json={})
    reel_id = response.json()["reel_id"]
    status = client.get(f"/api/reels/{reel_id}").json()
    assert status["status"] == "failed"
    assert status["error"] == "render failed"
    assert not (tmp_path / f"{reel_id}.mp4").exists()


def test_reel_identifier_paths_require_uuid():
    assert client.get("/api/reels/not-a-uuid").status_code == 422
    assert client.get("/api/reels/not-a-uuid/download").status_code == 422


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
    reel_id = _generate_result(payload)[0]["reel_id"]

    response = client.get(f"/api/reels/{reel_id}/download")

    assert response.status_code == 200
    assert response.headers["content-type"] == "video/mp4"
    output_path = outputs_dir / f"{reel_id}.mp4"
    assert response.content == output_path.read_bytes()

    output_path.unlink()
    missing_file_response = client.get(f"/api/reels/{reel_id}/download")
    assert missing_file_response.status_code == 404


def test_download_reel_unknown_id_returns_404():
    response = client.get(f"/api/reels/{uuid.uuid4()}/download")

    assert response.status_code == 404


def test_download_reel_job_without_output_path_returns_404():
    from app.core.job_store import create_reel_job

    reel_id = str(uuid.uuid4())
    create_reel_job(reel_id, request_id=f"pending-{reel_id}")

    response = client.get(f"/api/reels/{reel_id}/download")
    assert response.status_code == 404
    assert response.json()["detail"] == "Reel file not found"


def test_generate_reel_with_analysis_job_id_resolves_source_dir(
    synthetic_video_with_audio: Path, monkeypatch, tmp_path: Path
):
    from app.core.job_store import create_analysis_job

    job_scoped_dir = tmp_path / "uploads" / "job-abc"
    job_scoped_dir.mkdir(parents=True)
    (job_scoped_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())
    analysis_job_id = "00000000-0000-0000-0000-000000000100"
    create_analysis_job(analysis_job_id, source_dir=job_scoped_dir, user_id=TEST_USER_ID)

    outputs_dir = tmp_path / "outputs"
    monkeypatch.setattr(reels, "OUTPUTS_DIR", outputs_dir)

    payload = {
        "selected_clips": [_batch_clip_payload(synthetic_video_with_audio.name, 0.0, 1.0, 90)],
        "analysis_job_id": analysis_job_id,
        "min_total_duration": 0.5,
        "max_total_duration": 5.0,
        "brand": {"text": None},
    }

    _, status = _generate_result(payload)
    assert status["status"] == "completed"
    assert status["result"]["width"] == 1080


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
    create_analysis_job(job_id, source_dir=source_dir, user_id=TEST_USER_ID)
    update_analysis_job(
        job_id,
        status="completed",
        stage="completed",
        per_video_results=[],
        result=batch_result,
    )


def test_plan_reel_returns_story_ordered_plan(tmp_path: Path):
    job_id = "00000000-0000-0000-0000-000000000101"
    _completed_analysis_job_with_clips(job_id, tmp_path)

    response = client.post(
        "/api/reels/plan", json={"analysis_job_id": job_id, "target_duration": 15.0}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["target_duration"] == 15.0
    assert body["estimated_duration"] <= 15.0 + 1e-6
    assert body["template_seconds"] == 0.0
    assert body["end_card_seconds"] == 5.0
    assert body["estimated_final_duration"] == pytest.approx(15.0)
    assert body["duration_status"] == "ok"
    assert len(body["clips"]) > 0
    assert body["clips"][0]["position"] == 1
    for clip in body["clips"]:
        assert clip["clip_id"]
        assert "shot_role" in clip
        assert "role_confidence" in clip


def test_plan_reel_uses_exact_selected_clip_ids_for_same_source_file(tmp_path: Path):
    from app.core.job_store import create_analysis_job, update_analysis_job
    from app.schemas.batch import BatchAnalysisResult, BatchClip

    job_id = "00000000-0000-0000-0000-000000000150"
    clips = [
        BatchClip(**_batch_clip_payload("same.mp4", 1.0, 3.0, 90)),
        BatchClip(**_batch_clip_payload("same.mp4", 5.0, 7.0, 88)),
    ]
    result = BatchAnalysisResult(
        batch_id="same-source-test",
        input_video_count=1,
        total_segments=2,
        accepted_before_dedupe=2,
        duplicates_removed=0,
        final_selected_count=2,
        processing_time_seconds=0.1,
        selected_clips=clips,
        all_clips=clips,
    )
    create_analysis_job(job_id, source_dir=tmp_path, user_id=TEST_USER_ID)
    update_analysis_job(job_id, status="completed", stage="completed", result=result, per_video_results=[])

    analyzed = client.get(f"/api/analysis/{job_id}").json()["clips"]
    first_id, second_id = (clip["clip_id"] for clip in analyzed)
    assert first_id != second_id
    assert client.get(f"/api/analysis/{job_id}").json()["clips"][0]["clip_id"] == first_id

    first_plan = client.post(
        "/api/reels/plan",
        json={"analysis_job_id": job_id, "selected_clip_ids": [first_id], "target_duration": 15.0},
    )
    assert first_plan.status_code == 200
    assert [clip["clip_id"] for clip in first_plan.json()["clips"]] == [first_id]

    both_plan = client.post(
        "/api/reels/plan",
        json={"analysis_job_id": job_id, "selected_clip_ids": [first_id, second_id], "target_duration": 15.0},
    )
    assert both_plan.status_code == 200
    assert {clip["clip_id"] for clip in both_plan.json()["clips"]} == {first_id, second_id}


def test_plan_reel_rejects_empty_duplicate_unknown_and_cross_job_clip_ids(tmp_path: Path):
    job_a = "00000000-0000-0000-0000-000000000151"
    job_b = "00000000-0000-0000-0000-000000000152"
    _completed_analysis_job_with_clips(job_a, tmp_path)
    _completed_analysis_job_with_clips(job_b, tmp_path)
    id_a = client.get(f"/api/analysis/{job_a}").json()["clips"][0]["clip_id"]
    id_b = client.get(f"/api/analysis/{job_b}").json()["clips"][0]["clip_id"]

    empty = client.post("/api/reels/plan", json={"analysis_job_id": job_a, "selected_clip_ids": []})
    assert empty.status_code == 422
    duplicate = client.post(
        "/api/reels/plan", json={"analysis_job_id": job_a, "selected_clip_ids": [id_a, id_a]}
    )
    assert duplicate.status_code == 422
    unknown = client.post(
        "/api/reels/plan", json={"analysis_job_id": job_a, "selected_clip_ids": [str(uuid.uuid4())]}
    )
    assert unknown.status_code == 422
    cross_job = client.post(
        "/api/reels/plan", json={"analysis_job_id": job_a, "selected_clip_ids": [id_b]}
    )
    assert cross_job.status_code == 422


def test_plan_reel_rejects_selection_that_cannot_fit_target_duration(tmp_path: Path):
    from app.core.job_store import create_analysis_job, update_analysis_job
    from app.schemas.batch import BatchAnalysisResult, BatchClip

    job_id = "00000000-0000-0000-0000-000000000153"
    clips = [
        BatchClip(**_batch_clip_payload(f"video-{index}.mp4", 0.0, 1.0, 90 - index))
        for index in range(7)
    ]
    result = BatchAnalysisResult(
        batch_id="too-many-selected-test",
        input_video_count=7,
        total_segments=7,
        accepted_before_dedupe=7,
        duplicates_removed=0,
        final_selected_count=7,
        processing_time_seconds=0.1,
        selected_clips=clips,
        all_clips=clips,
    )
    create_analysis_job(job_id, source_dir=tmp_path, user_id=TEST_USER_ID)
    update_analysis_job(job_id, status="completed", stage="completed", result=result, per_video_results=[])
    clip_ids = [clip["clip_id"] for clip in client.get(f"/api/analysis/{job_id}").json()["clips"]]

    response = client.post(
        "/api/reels/plan",
        json={"analysis_job_id": job_id, "selected_clip_ids": clip_ids, "target_duration": 15.0},
    )
    assert response.status_code == 422
    assert "do not fit" in response.json()["detail"]


def test_plan_reel_rejects_selected_clip_shorter_than_min_clip_duration(tmp_path: Path):
    from app.core.job_store import create_analysis_job, update_analysis_job
    from app.schemas.batch import BatchAnalysisResult, BatchClip

    job_id = "00000000-0000-0000-0000-000000000154"
    # Clip with duration 0.3s is below default min_clip_duration (0.5s)
    clips = [
        BatchClip(**_batch_clip_payload("video-short.mp4", 0.0, 0.3, 85))
    ]
    result = BatchAnalysisResult(
        batch_id="short-clip-test",
        input_video_count=1,
        total_segments=1,
        accepted_before_dedupe=1,
        duplicates_removed=0,
        final_selected_count=1,
        processing_time_seconds=0.1,
        selected_clips=clips,
        all_clips=clips,
    )
    create_analysis_job(job_id, source_dir=tmp_path, user_id=TEST_USER_ID)
    update_analysis_job(job_id, status="completed", stage="completed", result=result, per_video_results=[])
    clip_ids = [clip["clip_id"] for clip in client.get(f"/api/analysis/{job_id}").json()["clips"]]

    response = client.post(
        "/api/reels/plan",
        json={"analysis_job_id": job_id, "selected_clip_ids": clip_ids, "target_duration": 15.0},
    )
    assert response.status_code == 422
    assert "shorter than the minimum clip duration" in response.json()["detail"]


def test_plan_reel_estimate_accounts_for_registered_template(monkeypatch, tmp_path: Path):
    job_id = "00000000-0000-0000-0000-000000000107"
    _completed_analysis_job_with_clips(job_id, tmp_path)
    template_path = tmp_path / "template.png"
    template_path.write_bytes(b"registered template")
    monkeypatch.setattr(reels, "_resolve_template_image", lambda *_args: template_path)

    response = client.post(
        "/api/reels/plan",
        json={"analysis_job_id": job_id, "target_duration": 15.5},
    )

    assert response.status_code == 200
    plan = response.json()
    assert plan["template_seconds"] == 1.0
    assert plan["end_card_seconds"] == 5.0
    assert plan["estimated_final_duration"] == pytest.approx(15.5)
    assert plan["duration_status"] == "ok"


def test_plan_reel_rejects_target_that_cannot_fit_template_and_full_end_card(
    monkeypatch, tmp_path: Path
):
    job_id = "00000000-0000-0000-0000-000000000108"
    _completed_analysis_job_with_clips(job_id, tmp_path)
    template_path = tmp_path / "template.png"
    template_path.write_bytes(b"registered template")
    monkeypatch.setattr(reels, "_resolve_template_image", lambda *_args: template_path)

    response = client.post(
        "/api/reels/plan",
        json={"analysis_job_id": job_id, "target_duration": 5.0},
    )

    assert response.status_code == 422


def test_plan_reel_rejects_unknown_analysis_job():
    response = client.post(
        "/api/reels/plan", json={"analysis_job_id": str(uuid.uuid4()), "target_duration": 15.0}
    )

    assert response.status_code == 404


def test_generate_reel_from_plan_end_to_end_with_private_template(synthetic_video_with_audio: Path, monkeypatch, tmp_path: Path):
    uploads_dir = tmp_path / "uploads"
    outputs_dir = tmp_path / "outputs"
    uploads_dir.mkdir()
    (uploads_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())

    monkeypatch.setattr(reels, "OUTPUTS_DIR", outputs_dir)

    from app.core.job_store import create_analysis_job, update_analysis_job
    from app.schemas.batch import BatchAnalysisResult, BatchClip

    clip = BatchClip(**_batch_clip_payload(synthetic_video_with_audio.name, 0.0, 1.0, 90))
    unselected_clip = BatchClip(**_batch_clip_payload(synthetic_video_with_audio.name, 1.0, 2.0, 88))
    batch_result = BatchAnalysisResult(
        batch_id="test-batch-2",
        input_video_count=1,
        total_segments=2,
        accepted_before_dedupe=2,
        duplicates_removed=0,
        final_selected_count=1,
        processing_time_seconds=0.1,
        selected_clips=[clip],
        all_clips=[clip, unselected_clip],
    )
    job_id = "00000000-0000-0000-0000-000000000102"
    template_id = "00000000-0000-0000-0000-000000000202"
    image_bytes = BytesIO()
    Image.new("RGB", (64, 96), color=(210, 50, 80)).save(image_bytes, format="PNG")
    with reels.SessionLocal() as db:
        db.add(Template(
            id=template_id,
            user_id=TEST_USER_ID,
            original_filename="opening.png",
            storage_path=f"{TEST_USER_ID}/{template_id}/opening.png",
            content_type="image/png",
            file_size_bytes=len(image_bytes.getvalue()),
            metadata_json={},
        ))
        db.commit()
    monkeypatch.setattr(template_service, "_storage_request", lambda method, _path, *_args: image_bytes.getvalue() if method == "GET" else b"")
    create_analysis_job(job_id, source_dir=uploads_dir, template_id=template_id, user_id=TEST_USER_ID)
    update_analysis_job(job_id, status="completed", stage="completed", per_video_results=[], result=batch_result)

    selected_id = client.get(f"/api/analysis/{job_id}").json()["clips"][0]["clip_id"]
    plan_response = client.post(
        "/api/reels/plan",
        json={"analysis_job_id": job_id, "selected_clip_ids": [selected_id], "target_duration": 12.0},
    )
    assert plan_response.status_code == 200
    reel_plan = plan_response.json()
    assert len(reel_plan["clips"]) == 1
    assert reel_plan["template_seconds"] == 1.0

    _, status = _generate_result(
        {
            "reel_plan": reel_plan,
            "analysis_job_id": job_id,
            "selected_clip_ids": [reel_plan["clips"][0]["clip_id"]],
            "brand": {"text": None},
        },
    )

    assert status["status"] == "completed"
    body = status["result"]
    assert body["width"] == 1080
    assert body["height"] == 1920
    assert body["clip_count"] == 1
    assert body["duration"] == pytest.approx(reel_plan["estimated_final_duration"], abs=0.5)
    assert body["duration_status"] == reel_plan["duration_status"]


def test_generate_reel_accepts_planned_clip_with_float_imprecision(tmp_path: Path):
    job_id = "00000000-0000-0000-0000-000000000109"
    _completed_analysis_job_with_clips(job_id, tmp_path)

    plan_response = client.post(
        "/api/reels/plan",
        json={"analysis_job_id": job_id, "target_duration": 15.0},
    )
    assert plan_response.status_code == 200
    reel_plan = plan_response.json()
    # Apply slight float imprecision within 1e-6 tolerance
    reel_plan["clips"][0]["planned_end"] += 5e-7

    response = client.post(
        "/api/reels/generate",
        json={
            "reel_plan": reel_plan,
            "analysis_job_id": job_id,
            "selected_clip_ids": [reel_plan["clips"][0]["clip_id"]],
            "brand": {"text": None},
        },
    )
    assert response.status_code == 202
    assert response.json()["status"] == "queued"



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
    job_id = "00000000-0000-0000-0000-000000000103"
    create_analysis_job(job_id, source_dir=source_dir, user_id=TEST_USER_ID)
    update_analysis_job(job_id, status="completed", stage="completed", per_video_results=[], result=batch_result)

    response = client.post("/api/reels/plan", json={"analysis_job_id": job_id, "target_duration": 12.0})

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
        "target_duration": 7.0,
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

    _, status = _generate_result(
        {"reel_plan": reel_plan, "output_filename": "edited_reel.mp4"}
    )
    assert status["status"] == "completed"
    body = status["result"]
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
    monkeypatch.setattr(reels, "MUSIC_LIBRARIES", [(music_dir, False)])

    reel_plan = {
        "target_duration": 6.0,
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

    _, status = _generate_result({"reel_plan": reel_plan})
    assert status["status"] == "completed"
    body = status["result"]
    assert body["audio_codec"] == "aac"
    assert body["duration"] == pytest.approx(6.0, abs=0.3)

    # The selected music (preserve_original_audio=False) must be the ONLY
    # audio, and must cover the whole Reel - video/audio/container duration
    # must all agree (the exact bug class the earlier truncation fix guards).
    from app.services.video_metadata import get_video_stream_duration

    reel_job = reels.get_reel_job(body["reel_id"])
    assert reel_job is not None
    output_path = Path(reel_job["output_path"])
    assert output_path.is_file()

    video_stream_duration = get_video_stream_duration(output_path)
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
        "target_duration": 10.0, "estimated_duration": 1.0, "duration_difference": 0.0,
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

    from app.services.credit_service import get_balance
    credits_before = get_balance(TEST_USER_ID)
    _, status = _generate_result({"reel_plan": reel_plan})
    assert status["status"] == "failed"
    assert "not found" in status["error"].lower()
    assert get_balance(TEST_USER_ID) == credits_before


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

    _, status = _generate_result(payload)
    assert status["status"] == "completed"
    assert status["result"]["duration_status"] in ("ok", "insufficient_content")


@pytest.mark.parametrize(
    "payload",
    [
        {"min_total_duration": 0},
        {"min_total_duration": 301},
        {"max_total_duration": 0},
        {"max_total_duration": 301},
        {"transition": "invalid_transition"},
        {"selected_clips": [{}] * 101},
    ],
)
def test_generate_reel_rejects_invalid_request_fields(payload):
    response = client.post("/api/reels/generate", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        {"target_duration": -5},
        {"target_duration": 0},
        {"target_duration": 4.9},
        {"target_duration": 301},
        {"target_duration": "NaN"},
        {"target_duration": "Infinity"},
        {"min_clip_duration": 0},
        {"max_clip_duration": 61},
        {"min_quality_score": -1},
        {"min_quality_score": 101},
    ],
)
def test_plan_reel_rejects_invalid_request_fields(payload):
    from app.services.credit_service import get_balance

    credits_before = get_balance(TEST_USER_ID)
    response = client.post(
        "/api/reels/plan",
        json={"analysis_job_id": "00000000-0000-0000-0000-000000000104", **payload},
    )

    assert response.status_code == 422
    assert get_balance(TEST_USER_ID) == credits_before


def test_plan_reel_accepts_documented_maximum_duration(tmp_path: Path):
    job_id = "00000000-0000-0000-0000-000000000105"
    _completed_analysis_job_with_clips(job_id, tmp_path)

    response = client.post(
        "/api/reels/plan", json={"analysis_job_id": job_id, "target_duration": 300.0}
    )

    assert response.status_code == 200
    assert response.json()["target_duration"] == 300.0


def test_plan_reel_rejects_malformed_analysis_identifier():
    response = client.post(
        "/api/reels/plan", json={"analysis_job_id": "not-a-uuid", "target_duration": 15.0}
    )
    assert response.status_code == 422


def test_plan_reel_rejects_unknown_fields():
    response = client.post(
        "/api/reels/plan",
        json={"analysis_job_id": "00000000-0000-0000-0000-000000000106", "target_duration": 15, "status": "completed"},
    )
    assert response.status_code == 422
