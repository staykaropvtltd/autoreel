import uuid
import time
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from pathlib import Path
from threading import BoundedSemaphore
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.api.videos import DEMO_RAW_DIR, RAW_UPLOADS_DIR
from app.core.job_store import (
    create_analysis_job,
    get_analysis_job,
    get_template_image,
    get_upload_job,
    update_analysis_job,
)
from app.core.config import get_settings
from app.services.batch_selector import select_best_clips
from app.services.clip_identity import ensure_analysis_clip_ids
from app.services.clip_selector import analyze_video
from app.api.templates import TEMPLATE_IMAGES_DIR
from app.core.security import safe_filename
from app.schemas.batch import BatchClip
from app.services.video_metadata import get_video_metadata

router = APIRouter()

_ANALYSIS_MAX_WORKERS = get_settings().analysis_max_workers
_ANALYSIS_JOB_TIMEOUT_SECONDS = get_settings().analysis_job_timeout_seconds
_ANALYSIS_EXECUTOR = ThreadPoolExecutor(
    max_workers=_ANALYSIS_MAX_WORKERS,
    thread_name_prefix="video-analysis",
)
_ANALYSIS_SLOTS = BoundedSemaphore(_ANALYSIS_MAX_WORKERS)
_PER_FILE_ERROR = "This video could not be analyzed. Check the file and try again."


class AnalysisFileError(BaseModel):
    filename: str
    message: str


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: uuid.UUID | None = None
    use_demo: bool = False
    template_id: uuid.UUID | None = None


class AnalysisStartResponse(BaseModel):
    job_id: uuid.UUID
    status: Literal["queued"]


class AnalysisStatusResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    job_id: uuid.UUID
    status: Literal["queued", "processing", "completed", "failed"]
    stage: Literal["queued", "analyzing", "selecting_clips", "completed", "failed"] | None = None
    error: str | None = None
    videos_analyzed: int | None = Field(default=None, ge=0)
    videos_failed: int | None = Field(default=None, ge=0)
    file_errors: list[AnalysisFileError] | None = None
    total_segments: int | None = Field(default=None, ge=0)
    accepted_before_dedupe: int | None = Field(default=None, ge=0)
    duplicates_removed: int | None = Field(default=None, ge=0)
    final_selected_count: int | None = Field(default=None, ge=0)
    processing_time_seconds: float | None = Field(default=None, ge=0.0, allow_inf_nan=False)
    clips: list[BatchClip] | None = None
    template_id: uuid.UUID | None = None


def _run_analysis_job(
    job_id: str,
    video_paths: list[Path],
    *,
    timeout_seconds: float | None = None,
) -> None:
    """Runs in a background task. Reuses Phase 3's analyze_video (scene
    detection + quality scoring) and Phase 4's select_best_clips (cross-file
    dedup + diversity selection) exactly as-is - no analysis logic is
    duplicated here, only orchestrated with stage updates for polling.
    """
    if timeout_seconds is None:
        timeout_seconds = _ANALYSIS_JOB_TIMEOUT_SECONDS
    deadline = time.monotonic() + timeout_seconds
    results: list[object | None] = [None] * len(video_paths)
    failures: list[AnalysisFileError | None] = [None] * len(video_paths)
    pending: dict[Future, int] = {}
    next_index = 0

    def release_slot(_future: Future) -> None:
        _ANALYSIS_SLOTS.release()

    try:
        update_analysis_job(job_id, status="processing", stage="analyzing")

        while next_index < len(video_paths) or pending:
            while next_index < len(video_paths) and len(pending) < _ANALYSIS_MAX_WORKERS:
                remaining = deadline - time.monotonic()
                if remaining <= 0 or not _ANALYSIS_SLOTS.acquire(timeout=remaining):
                    raise TimeoutError
                path = video_paths[next_index]
                try:
                    future = _ANALYSIS_EXECUTOR.submit(analyze_video, path)
                except Exception:
                    _ANALYSIS_SLOTS.release()
                    raise
                future.add_done_callback(release_slot)
                pending[future] = next_index
                next_index += 1

            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError
            done, _ = wait(pending, timeout=remaining, return_when=FIRST_COMPLETED)
            if not done:
                raise TimeoutError

            for future in done:
                index = pending.pop(future)
                try:
                    results[index] = future.result()
                except Exception:
                    failures[index] = AnalysisFileError(
                        filename=video_paths[index].name,
                        message=_PER_FILE_ERROR,
                    )

        per_video_results = [result for result in results if result is not None]
        file_errors = [failure for failure in failures if failure is not None]
        if not per_video_results:
            update_analysis_job(
                job_id,
                status="failed",
                stage="failed",
                error="No videos could be analyzed. Check the files and try again.",
                per_video_results=[],
                file_errors=file_errors,
                videos_analyzed=0,
                videos_failed=len(file_errors),
            )
            return

        update_analysis_job(job_id, stage="selecting_clips")
        batch_result = select_best_clips(per_video_results)
        ensure_analysis_clip_ids(job_id, batch_result)

        update_analysis_job(
            job_id,
            status="completed",
            stage="completed",
            per_video_results=per_video_results,
            result=batch_result,
            file_errors=file_errors,
            videos_analyzed=len(per_video_results),
            videos_failed=len(file_errors),
        )
    except TimeoutError:
        for future in pending:
            future.cancel()
        update_analysis_job(
            job_id,
            status="failed",
            stage="failed",
            error="Analysis timed out. Please try again.",
            file_errors=[failure for failure in failures if failure is not None],
        )
    except Exception:
        for future in pending:
            future.cancel()
        update_analysis_job(
            job_id,
            status="failed",
            stage="failed",
            error="Analysis failed. Please try again.",
            file_errors=[failure for failure in failures if failure is not None],
        )


@router.post("/analysis/analyze", response_model=AnalysisStartResponse)
def start_analysis(request: AnalyzeRequest, background_tasks: BackgroundTasks) -> AnalysisStartResponse:
    if request.template_id is not None:
        template = get_template_image(str(request.template_id))
        if template is None:
            raise HTTPException(status_code=404, detail="Template not found")
        template_root = TEMPLATE_IMAGES_DIR.resolve()
        template_path = Path(template.get("path", "")).resolve()
        if not template_path.is_relative_to(template_root) or not template_path.is_file():
            raise HTTPException(status_code=400, detail="Template image is unavailable")

    if request.use_demo:
        if not DEMO_RAW_DIR.exists() or not any(DEMO_RAW_DIR.glob("*.mp4")):
            raise HTTPException(status_code=400, detail="Demo footage is not available")
        source_dir = DEMO_RAW_DIR
        video_paths = sorted(source_dir.glob("*.mp4"))
    else:
        if not request.job_id:
            raise HTTPException(status_code=400, detail="job_id is required")
        upload_job = get_upload_job(str(request.job_id))
        if upload_job is None:
            raise HTTPException(status_code=404, detail=f"Upload job not found: {request.job_id}")
        source_dir = RAW_UPLOADS_DIR / str(request.job_id)
        upload_root = source_dir.resolve()
        video_paths = []
        for file_record in upload_job["files"]:
            filename = file_record.get("filename", "")
            if not filename or safe_filename(filename) != filename:
                raise HTTPException(status_code=400, detail="Invalid uploaded source filename")
            source_path = (source_dir / filename).resolve()
            if not source_path.is_relative_to(upload_root) or not source_path.is_file():
                raise HTTPException(status_code=400, detail="Uploaded source file is missing or invalid")
            try:
                metadata = get_video_metadata(source_path)
                if metadata.duration <= 0:
                    raise ValueError("Video duration must be positive")
            except Exception as exc:
                raise HTTPException(status_code=400, detail="Uploaded source file is missing or invalid") from exc
            video_paths.append(source_path)

    if request.use_demo:
        for source_path in video_paths:
            try:
                metadata = get_video_metadata(source_path)
                if metadata.duration <= 0:
                    raise ValueError("Video duration must be positive")
            except Exception as exc:
                raise HTTPException(status_code=400, detail="Demo source file is missing or invalid") from exc

    if not video_paths:
        raise HTTPException(status_code=400, detail="No videos to analyze")

    analysis_job_id = str(uuid.uuid4())

    try:
        create_analysis_job(
            analysis_job_id,
            source_dir=source_dir,
            template_id=str(request.template_id) if request.template_id else None,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Template not found") from exc

    background_tasks.add_task(
    _run_analysis_job,
    analysis_job_id,
    video_paths,
)

    return AnalysisStartResponse(job_id=uuid.UUID(analysis_job_id), status="queued")


@router.get("/analysis/{job_id}", response_model=AnalysisStatusResponse, response_model_exclude_none=True)
def get_analysis(job_id: uuid.UUID) -> AnalysisStatusResponse:
    job_id = str(job_id)
    job = get_analysis_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Analysis job not found: {job_id}")

    if job["status"] in ("queued", "processing"):
        return AnalysisStatusResponse(job_id=uuid.UUID(job_id), status=job["status"], stage=job["stage"])

    if job["status"] == "failed":
        return AnalysisStatusResponse(
            job_id=uuid.UUID(job_id),
            status="failed",
            stage="failed",
            error=job.get("error"),
            videos_analyzed=job.get("videos_analyzed"),
            videos_failed=job.get("videos_failed"),
            file_errors=job.get("file_errors"),
            template_id=job.get("template_id"),
        )

    batch_result = job["result"]
    ensure_analysis_clip_ids(job_id, batch_result)
    per_video_results = job["per_video_results"]
    total_processing_time = round(
        sum(r.processing_time_seconds for r in per_video_results) + batch_result.processing_time_seconds, 3
    )

    return AnalysisStatusResponse(
        job_id=uuid.UUID(job_id), status="completed", stage="completed",
        videos_analyzed=len(per_video_results), total_segments=batch_result.total_segments,
        videos_failed=job.get("videos_failed", 0), file_errors=job.get("file_errors", []),
        accepted_before_dedupe=batch_result.accepted_before_dedupe,
        duplicates_removed=batch_result.duplicates_removed,
        final_selected_count=batch_result.final_selected_count,
        processing_time_seconds=total_processing_time,
        clips=[c.model_dump() for c in batch_result.all_clips],
        template_id=job.get("template_id"),
    )
