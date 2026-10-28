from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core import job_store
from app.models.database_models import Base, ReelJob, User
from app.schemas.batch import BatchAnalysisResult


def test_upload_job_persists_owner_and_files_across_cache_restart(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'jobs.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add_all([
            User(id=41, email="jobs-one@example.test", name="One"),
            User(id=42, email="jobs-two@example.test", name="Two"),
        ])
        db.commit()
    monkeypatch.setattr(job_store, "SessionLocal", sessions)

    upload_id = "d471ef75-8951-4e75-bcdf-19d23f22bfbd"
    job_store.create_upload_job(upload_id, [{"filename": "clip.mp4", "size": 123}], 41)
    with sessions() as db:
        row = db.scalar(select(ReelJob).where(ReelJob.job_id == upload_id))
        assert row.job_type == "upload"
        assert row.user_id == 41
        assert row.status == "completed" and row.progress == 100
        assert row.created_at and row.updated_at

    # Drop the process cache to simulate a backend restart.
    monkeypatch.setattr(job_store, "_upload_jobs", {})
    assert job_store.get_upload_job(upload_id, 41)["files"][0]["filename"] == "clip.mp4"
    assert job_store.get_upload_job(upload_id, 42) is None
    engine.dispose()


def test_analysis_job_transitions_persist_and_terminal_status_cannot_be_overwritten(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'analysis-jobs.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add(User(id=51, email="analysis-job@example.test", name="Analysis"))
        db.commit()
    monkeypatch.setattr(job_store, "SessionLocal", sessions)
    monkeypatch.setattr(job_store, "_analysis_jobs", {})
    job_id = "049b1675-597c-40fb-8b50-840017356e20"
    source = tmp_path / "uploads" / job_id
    job_store.create_analysis_job(job_id, source, user_id=51)
    with sessions() as db:
        pending = db.scalar(select(ReelJob).where(ReelJob.job_id == job_id))
        assert pending.status == "pending" and pending.progress == 0
    job_store.update_analysis_job(job_id, status="processing", stage="analyzing", progress=40)
    with sessions() as db:
        processing = db.scalar(select(ReelJob).where(ReelJob.job_id == job_id))
        assert processing.status == "processing" and processing.progress == 40
    job_store.update_analysis_job(job_id, status="failed", stage="failed", error="Analysis failed. Please try again.")
    job_store.update_analysis_job(job_id, status="completed", stage="completed")

    with sessions() as db:
        row = db.scalar(select(ReelJob).where(ReelJob.job_id == job_id))
        assert row.status == "failed" and row.stage == "failed"
        assert row.progress == 100
        assert row.error == "Analysis failed. Please try again."

    monkeypatch.setattr(job_store, "_analysis_jobs", {})
    recovered = job_store.get_analysis_job(job_id, 51)
    assert recovered["status"] == "failed"
    assert recovered["source_dir"] == source
    assert job_store.get_analysis_job(job_id, 52) is None
    engine.dispose()


def test_completed_analysis_payload_can_be_restored_after_cache_restart(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'completed-analysis.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add(User(id=52, email="analysis-result@example.test", name="Analysis"))
        db.commit()
    monkeypatch.setattr(job_store, "SessionLocal", sessions)
    monkeypatch.setattr(job_store, "_analysis_jobs", {})
    job_id = "706339bd-67ef-4859-9a5b-0ab0927c06e4"
    job_store.create_analysis_job(job_id, tmp_path, user_id=52)
    result = BatchAnalysisResult(
        batch_id=job_id, input_video_count=1, total_segments=0,
        accepted_before_dedupe=0, duplicates_removed=0,
        final_selected_count=0, processing_time_seconds=0.01,
        selected_clips=[], all_clips=[],
    )
    job_store.update_analysis_job(job_id, status="completed", stage="completed",
                                  result=result, per_video_results=[], videos_analyzed=1,
                                  videos_failed=0, file_errors=[])
    monkeypatch.setattr(job_store, "_analysis_jobs", {})
    recovered = job_store.get_analysis_job(job_id, 52)
    assert recovered["status"] == "completed"
    assert recovered["result"].batch_id == job_id
    assert recovered["result"].all_clips == []
    assert recovered["per_video_results"] == []
    engine.dispose()


def test_internal_error_detail_is_persisted_but_filesystem_path_is_not_returned(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'safe-errors.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add(User(id=71, email="safe-error@example.test", name="Safe error"))
        db.commit()
    monkeypatch.setattr(job_store, "SessionLocal", sessions)
    monkeypatch.setattr(job_store, "_reel_jobs", {})
    job_id = "47d137bd-8e89-4fe8-bfa5-a7af5f7b07cb"
    job_store.create_reel_job(job_id, user_id=71)
    job_store.update_reel_job(job_id, status="failed", stage="failed",
                              error="FFmpeg failed at C:\\private\\customer\\raw.mp4")
    public = job_store.get_reel_job(job_id, 71)
    with sessions() as db:
        row = db.scalar(select(ReelJob).where(ReelJob.job_id == job_id))
    assert "C:\\private" in row.error
    assert public["error"] == "Reel rendering failed. Please try again."
    engine.dispose()


def test_reel_job_recovers_status_and_result_after_cache_restart(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'reel-jobs.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add(User(id=61, email="reel-job@example.test", name="Reel"))
        db.commit()
    monkeypatch.setattr(job_store, "SessionLocal", sessions)
    monkeypatch.setattr(job_store, "_reel_jobs", {})
    job_id = "c46c9742-5cfb-4428-a95e-d565e8f3d503"
    assert job_store.create_reel_job(job_id, "req-1", 61)
    with sessions() as db:
        pending = db.scalar(select(ReelJob).where(ReelJob.job_id == job_id))
        assert pending.status == "pending" and pending.created_at and pending.updated_at
    job_store.update_reel_job(job_id, status="processing", stage="rendering")
    with sessions() as db:
        processing = db.scalar(select(ReelJob).where(ReelJob.job_id == job_id))
        assert processing.status == "processing" and processing.progress == 45
    job_store.update_reel_job(job_id, status="completed", stage="completed",
                              response={"reel_id": job_id}, output_path="storage/outputs/reel.mp4")

    monkeypatch.setattr(job_store, "_reel_jobs", {})
    recovered = job_store.get_reel_job(job_id, 61)
    assert recovered["status"] == "completed"
    assert recovered["response"] == {"reel_id": job_id}
    assert recovered["output_path"] == "storage/outputs/reel.mp4"
    assert job_store.get_reel_job(job_id, 62) is None
    assert job_store.get_reel_job_by_request_id("req-1", 61) == job_id
    engine.dispose()
