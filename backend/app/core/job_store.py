"""Simple in-memory job state for the Phase 6 demo workflow.

No database/Redis - a hackathon-scoped process-lifetime dict, guarded by a
lock since analysis jobs are updated from a background thread while the API
reads them from request-handling threads/coroutines.
"""

import threading
from pathlib import Path
from typing import Any

_lock = threading.Lock()

_upload_jobs: dict[str, dict[str, Any]] = {}
_analysis_jobs: dict[str, dict[str, Any]] = {}
_reel_jobs: dict[str, dict[str, Any]] = {}
_reel_request_ids: dict[str, str] = {}
_template_images: dict[str, dict[str, Any]] = {}
_ANALYSIS_TERMINAL_STATUSES = {"completed", "failed"}


def create_upload_job(job_id: str, files: list[dict[str, Any]]) -> None:
    with _lock:
        _upload_jobs[job_id] = {"status": "uploaded", "files": files}


def get_upload_job(job_id: str) -> dict[str, Any] | None:
    with _lock:
        job = _upload_jobs.get(job_id)
        return dict(job) if job is not None else None


def create_analysis_job(
    job_id: str,
    source_dir: Path,
    template_id: str | None = None,
) -> None:
    with _lock:
        if template_id is not None and template_id not in _template_images:
            raise KeyError("Template not found")
        _analysis_jobs[job_id] = {
            "status": "queued",
            "stage": "queued",
            "source_dir": source_dir,
            "template_id": template_id,
        }


def update_analysis_job(job_id: str, **fields: Any) -> None:
    with _lock:
        job = _analysis_jobs.get(job_id)
        if job is None or job.get("status") in _ANALYSIS_TERMINAL_STATUSES:
            return
        job.update(fields)


def get_analysis_job(job_id: str) -> dict[str, Any] | None:
    with _lock:
        job = _analysis_jobs.get(job_id)
        return dict(job) if job is not None else None



def create_reel_job(
    reel_id: str,
    request_id: str | None = None,
) -> bool:
    with _lock:
        if request_id is not None and request_id in _reel_request_ids:
            return False
        _reel_jobs[reel_id] = {
            "status": "queued",
            "stage": "queued",
            "response": None,
            "error": None,
        }
        if request_id is not None:
            _reel_request_ids[request_id] = reel_id
        return True


def update_reel_job(reel_id: str, **fields: Any) -> None:
    with _lock:
        job = _reel_jobs.get(reel_id)
        if job is not None and job.get("status") not in {"completed", "failed"}:
            job.update(fields)


def get_reel_job_by_request_id(request_id: str) -> str | None:
    with _lock:
        return _reel_request_ids.get(request_id)


def get_reel_job(reel_id: str) -> dict[str, Any] | None:
    with _lock:
        job = _reel_jobs.get(reel_id)
        return dict(job) if job is not None else None


def create_template_image(
    template_id: str,
    filename: str,
    path: str,
) -> None:
    with _lock:
        _template_images[template_id] = {
            "template_id": template_id,
            "filename": filename,
            "path": path,
        }


def get_template_image(
    template_id: str,
) -> dict[str, Any] | None:
    with _lock:
        template = _template_images.get(template_id)
        return dict(template) if template is not None else None


def delete_template_image_if_unused(template_id: str) -> tuple[dict[str, Any] | None, bool]:
    """Remove only unreferenced templates; analysis creation shares this lock."""
    with _lock:
        template = _template_images.get(template_id)
        if template is None:
            return None, False
        in_use = any(
            job.get("template_id") == template_id and job.get("status") != "failed"
            for job in _analysis_jobs.values()
        )
        if in_use:
            return dict(template), False
        return _template_images.pop(template_id), True
