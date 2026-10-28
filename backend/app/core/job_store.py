"""In-process working cache backed by PostgreSQL job records.

The cache retains rich Python objects and local Paths needed while a task is
running. Durable ownership, status, progress, timestamps and JSON result data
are committed to ReelJob on every transition and loaded on cache misses.
"""

import threading
import re
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal
from app.models.database_models import ReelJob

_lock = threading.Lock()
_upload_jobs: dict[str, dict[str, Any]] = {}
_analysis_jobs: dict[str, dict[str, Any]] = {}
_thumbnail_owners: dict[str, int] = {}
_reel_jobs: dict[str, dict[str, Any]] = {}
_reel_request_ids: dict[tuple[int | None, str], str] = {}
_TERMINAL = {"completed", "failed"}
_SENSITIVE_ERROR = re.compile(
    r"(?:[A-Za-z]:[\\/][^\s]+|/(?:[^\s/]+/)+[^\s]*|eyJ[A-Za-z0-9_-]{20,})"
)


def _public_error(error: str | None, fallback: str) -> str | None:
    if error and _SENSITIVE_ERROR.search(error):
        return fallback
    return error


def _json_value(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_value(item) for item in value]
    if hasattr(value, "__dict__"):
        return {key: _json_value(item) for key, item in vars(value).items()
                if not key.startswith("_")}
    return value


def _db_status(status: str) -> str:
    # `queued` is part of the established HTTP polling contract. Store the
    # equivalent lifecycle state as `pending` in PostgreSQL.
    return "pending" if status == "queued" else status


def _persist_create(
    job_id: str,
    user_id: int,
    job_type: str,
    *,
    status: str = "queued",
    stage: str = "queued",
    progress: int = 0,
    reel_id: str | None = None,
    request_id: str | None = None,
    error: str | None = None,
    response_data: dict[str, Any] | None = None,
) -> bool:
    with SessionLocal() as db:
        row = ReelJob(
            job_id=job_id,
            reel_id=reel_id,
            user_id=user_id,
            job_type=job_type,
            request_id=request_id,
            status=_db_status(status),
            stage=stage,
            progress=progress,
            error=error,
            response_data=_json_value(response_data) if response_data is not None else None,
        )
        db.add(row)
        try:
            db.commit()
            return True
        except IntegrityError:
            db.rollback()
            return False


def _persist_update(job_id: str, fields: dict[str, Any]) -> bool | None:
    with SessionLocal() as db:
        row = db.scalar(select(ReelJob).where(ReelJob.job_id == job_id).with_for_update())
        if row is None:
            return None
        if row.status in _TERMINAL:
            return False
        if "status" in fields:
            row.status = _db_status(fields["status"])
        for key in ("stage", "error", "output_path"):
            if key in fields:
                setattr(row, key, fields[key])
        if "progress" in fields:
            row.progress = max(0, min(100, int(fields["progress"])))
        elif fields.get("status") == "completed":
            row.progress = 100
        if "response" in fields:
            row.response_data = _json_value(fields["response"])
        if "response_data" in fields:
            row.response_data = _json_value(fields["response_data"])
        db.commit()
        return True


def _load_row(job_id: str, user_id: int | None = None) -> ReelJob | None:
    with SessionLocal() as db:
        query = select(ReelJob).where(ReelJob.job_id == job_id)
        if user_id is not None:
            query = query.where(ReelJob.user_id == user_id)
        return db.scalar(query)


def create_upload_job(job_id: str, files: list[dict[str, Any]], user_id: int) -> None:
    owned_files = [{**item, "user_id": user_id} for item in files]
    job = {"status": "uploaded", "files": owned_files, "user_id": user_id}
    _persist_create(job_id, user_id, "upload", status="completed", stage="uploaded", progress=100,
                    response_data={"files": files})
    with _lock:
        _upload_jobs[job_id] = job


def get_upload_job(job_id: str, user_id: int) -> dict[str, Any] | None:
    with _lock:
        job = _upload_jobs.get(job_id)
    if job is None:
        row = _load_row(job_id, user_id)
        if row is None or row.job_type != "upload":
            return None
        files = (row.response_data or {}).get("files", [])
        job = {"status": "uploaded", "files": [{**item, "user_id": user_id} for item in files], "user_id": user_id}
        with _lock:
            _upload_jobs[job_id] = job
    if job.get("user_id") != user_id:
        return None
    return dict(job)


def register_thumbnail_owner(key: str, user_id: int) -> None:
    with _lock:
        _thumbnail_owners[key] = user_id


def thumbnail_belongs_to_user(key: str, user_id: int) -> bool:
    with _lock:
        return _thumbnail_owners.get(key) == user_id


def create_analysis_job(
    job_id: str,
    source_dir: Path,
    template_id: str | None = None,
    user_id: int | None = None,
) -> None:
    if user_id is None:
        raise ValueError("Analysis jobs require an authenticated user")
    job = {"status": "queued", "stage": "queued", "progress": 0,
           "source_dir": Path(source_dir), "template_id": template_id,
           "user_id": user_id}
    _persist_create(job_id, user_id, "analysis", stage="queued", progress=0,
                    response_data={"source_dir": str(source_dir), "template_id": template_id})
    with _lock:
        _analysis_jobs[job_id] = job


def update_analysis_job(job_id: str, **fields: Any) -> None:
    with _lock:
        job = _analysis_jobs.get(job_id)
        if job is None or job.get("status") in _TERMINAL:
            return
        snapshot = {**job, **fields}
    data_keys = ("source_dir", "template_id", "result", "per_video_results",
                 "file_errors", "videos_analyzed", "videos_failed")
    response_data = {key: _json_value(snapshot[key]) for key in data_keys if key in snapshot}
    stored = {key: fields[key] for key in ("status", "stage", "error") if key in fields}
    stage_progress = {"queued": 0, "analyzing": 10, "selecting_clips": 80,
                      "preparing": 10, "rendering": 45, "finalizing": 90,
                      "completed": 100, "failed": 100}
    stored["progress"] = fields.get("progress", stage_progress.get(fields.get("stage"),
                                  stage_progress.get(fields.get("status"), snapshot.get("progress", 0))))
    stored["response_data"] = response_data
    persisted = _persist_update(job_id, stored)
    if persisted is False:
        return
    with _lock:
        job = _analysis_jobs.get(job_id)
        if job is not None and job.get("status") not in _TERMINAL:
            job.update(fields)


def get_analysis_job(job_id: str, user_id: int | None = None) -> dict[str, Any] | None:
    if user_id is None:
        with _lock:
            job = _analysis_jobs.get(job_id)
        if job is not None:
            return dict(job)
    row = _load_row(job_id, user_id)
    if row is None or row.job_type != "analysis":
        return None
    data = row.response_data or {}
    job = {"status": "queued" if row.status == "pending" else row.status,
           "stage": row.stage, "progress": row.progress, "user_id": row.user_id,
           "source_dir": Path(data["source_dir"]) if data.get("source_dir") else None,
           "template_id": data.get("template_id"), "error": row.error}
    try:
        if data.get("result") is not None:
            from app.schemas.batch import BatchAnalysisResult
            job["result"] = BatchAnalysisResult.model_validate(data["result"])
        if data.get("per_video_results") is not None:
            from app.schemas.analysis import AnalysisResult
            job["per_video_results"] = [AnalysisResult.model_validate(item) for item in data["per_video_results"]]
    except Exception:
        # Defensive compatibility for legacy/test-only cached result shapes;
        # properly serialized production analysis payloads validate above.
        with _lock:
            cached = _analysis_jobs.get(job_id)
        if cached is None or cached.get("user_id") != row.user_id:
            return {"status": "failed", "stage": "failed", "user_id": row.user_id,
                    "error": "Saved analysis results could not be restored."}
        cached = dict(cached)
        cached["error"] = _public_error(cached.get("error"), "Analysis failed. Please try again.")
        return cached
    for key in ("file_errors", "videos_analyzed", "videos_failed"):
        if key in data:
            job[key] = data[key]
    with _lock:
        _analysis_jobs[job_id] = job
    result = dict(job)
    result["error"] = _public_error(result.get("error"), "Analysis failed. Please try again.")
    return result


def create_render_job(
    job_id: str,
    user_id: int,
    job_type: str,
    *,
    reel_id: str | None = None,
    response_data: dict[str, Any] | None = None,
) -> bool:
    return _persist_create(job_id, user_id, job_type, reel_id=reel_id,
                           response_data=response_data)


def create_reel_job(
    reel_id: str,
    request_id: str | None = None,
    user_id: int | None = None,
) -> bool:
    cache_key = (user_id, request_id) if request_id else None
    with _lock:
        if cache_key and cache_key in _reel_request_ids:
            return False
    if user_id is not None:
        created = _persist_create(reel_id, user_id, "reel", reel_id=reel_id,
                                  request_id=request_id)
        if not created:
            return False
    with _lock:
        _reel_jobs[reel_id] = {"status": "queued", "stage": "queued", "progress": 0,
                               "response": None, "error": None, "user_id": user_id}
        if cache_key:
            _reel_request_ids[cache_key] = reel_id
    return True


def update_reel_job(reel_id: str, **fields: Any) -> None:
    with _lock:
        job = _reel_jobs.get(reel_id)
        if job is not None and job.get("status") in _TERMINAL:
            return
    persisted = dict(fields)
    stage_progress = {"queued": 0, "preparing": 10, "rendering": 45,
                      "finalizing": 90, "completed": 100, "failed": 100}
    persisted.setdefault("progress", stage_progress.get(fields.get("stage"), 0))
    if "response" in fields:
        persisted["response_data"] = {"result": fields["response"]}
    updated = _persist_update(reel_id, persisted)
    if updated is False:
        return
    with _lock:
        job = _reel_jobs.get(reel_id)
        if job is not None and job.get("status") not in _TERMINAL:
            job.update(fields)


def get_reel_job_by_request_id(request_id: str, user_id: int | None = None) -> str | None:
    with _lock:
        cached = _reel_request_ids.get((user_id, request_id))
        if cached:
            return cached
    if user_id is None:
        return None
    with SessionLocal() as db:
        row = db.scalar(select(ReelJob).where(ReelJob.user_id == user_id,
                                               ReelJob.request_id == request_id,
                                               ReelJob.job_type == "reel"))
        return row.reel_id if row else None


def get_reel_job(reel_id: str, user_id: int | None = None) -> dict[str, Any] | None:
    if user_id is None:
        with _lock:
            job = _reel_jobs.get(reel_id)
        if job is not None:
            return dict(job)
    row = _load_row(reel_id, user_id)
    if row is None or row.job_type not in {"reel", "image_to_reel"}:
        return None
    response = row.response_data or {}
    job = {"status": "queued" if row.status == "pending" else row.status,
           "stage": row.stage, "progress": row.progress, "error": row.error,
           "response": response.get("result"), "output_path": row.output_path,
           "user_id": row.user_id}
    with _lock:
        _reel_jobs[reel_id] = job
    result = dict(job)
    result["error"] = _public_error(result.get("error"), "Reel rendering failed. Please try again.")
    return result


def template_is_in_use(template_id: str, user_id: int) -> bool:
    with _lock:
        return any(job.get("template_id") == template_id and job.get("user_id") == user_id
                   and job.get("status") != "failed" for job in _analysis_jobs.values())
