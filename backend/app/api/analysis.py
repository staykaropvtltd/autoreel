import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.api.videos import DEMO_RAW_DIR, RAW_UPLOADS_DIR
from app.core.job_store import create_analysis_job, get_analysis_job, get_upload_job, update_analysis_job
from app.services.batch_selector import select_best_clips
from app.services.clip_selector import analyze_video

router = APIRouter()


class AnalyzeRequest(BaseModel):
    job_id: str | None = None
    use_demo: bool = False


def _run_analysis_job(job_id: str, video_paths: list[Path]) -> None:
    """Runs in a background task. Reuses Phase 3's analyze_video (scene
    detection + quality scoring) and Phase 4's select_best_clips (cross-file
    dedup + diversity selection) exactly as-is - no analysis logic is
    duplicated here, only orchestrated with stage updates for polling.
    """
    try:
        update_analysis_job(job_id, status="processing", stage="analyzing")
        per_video_results = [analyze_video(path) for path in video_paths]

        update_analysis_job(job_id, stage="selecting_clips")
        batch_result = select_best_clips(per_video_results)

        update_analysis_job(
            job_id,
            status="completed",
            stage="completed",
            per_video_results=per_video_results,
            result=batch_result,
        )
    except Exception as exc:
        update_analysis_job(job_id, status="failed", stage="failed", error=str(exc))


@router.post("/analysis/analyze")
def start_analysis(request: AnalyzeRequest, background_tasks: BackgroundTasks) -> dict:
    if request.use_demo:
        if not DEMO_RAW_DIR.exists() or not any(DEMO_RAW_DIR.glob("*.mp4")):
            raise HTTPException(status_code=400, detail="Demo footage is not available")
        source_dir = DEMO_RAW_DIR
        video_paths = sorted(source_dir.glob("*.mp4"))
    else:
        if not request.job_id:
            raise HTTPException(status_code=400, detail="job_id is required")
        upload_job = get_upload_job(request.job_id)
        if upload_job is None:
            raise HTTPException(status_code=404, detail=f"Upload job not found: {request.job_id}")
        source_dir = RAW_UPLOADS_DIR / request.job_id
        video_paths = [source_dir / f["filename"] for f in upload_job["files"]]

    if not video_paths:
        raise HTTPException(status_code=400, detail="No videos to analyze")

    analysis_job_id = str(uuid.uuid4())
    create_analysis_job(analysis_job_id, source_dir=source_dir)
    background_tasks.add_task(_run_analysis_job, analysis_job_id, video_paths)

    return {"job_id": analysis_job_id, "status": "queued"}


@router.get("/analysis/{job_id}")
def get_analysis(job_id: str) -> dict:
    job = get_analysis_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Analysis job not found: {job_id}")

    if job["status"] in ("queued", "processing"):
        return {"job_id": job_id, "status": job["status"], "stage": job["stage"]}

    if job["status"] == "failed":
        return {"job_id": job_id, "status": "failed", "stage": "failed", "error": job.get("error")}

    batch_result = job["result"]
    per_video_results = job["per_video_results"]
    total_processing_time = round(
        sum(r.processing_time_seconds for r in per_video_results) + batch_result.processing_time_seconds, 3
    )

    return {
        "job_id": job_id,
        "status": "completed",
        "stage": "completed",
        "videos_analyzed": len(per_video_results),
        "total_segments": batch_result.total_segments,
        "accepted_before_dedupe": batch_result.accepted_before_dedupe,
        "duplicates_removed": batch_result.duplicates_removed,
        "final_selected_count": batch_result.final_selected_count,
        "processing_time_seconds": total_processing_time,
        "clips": [c.model_dump() for c in batch_result.all_clips],
    }
