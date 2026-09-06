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


def create_upload_job(job_id: str, files: list[dict[str, Any]]) -> None:
    with _lock:
        _upload_jobs[job_id] = {"status": "uploaded", "files": files}


def get_upload_job(job_id: str) -> dict[str, Any] | None:
    with _lock:
        job = _upload_jobs.get(job_id)
        return dict(job) if job is not None else None


def create_analysis_job(job_id: str, source_dir: Path) -> None:
    with _lock:
        _analysis_jobs[job_id] = {"status": "queued", "stage": "queued", "source_dir": source_dir}


def update_analysis_job(job_id: str, **fields: Any) -> None:
    with _lock:
        if job_id in _analysis_jobs:
            _analysis_jobs[job_id].update(fields)


def get_analysis_job(job_id: str) -> dict[str, Any] | None:
    with _lock:
        job = _analysis_jobs.get(job_id)
        return dict(job) if job is not None else None


def create_reel_job(reel_id: str, response: dict[str, Any]) -> None:
    with _lock:
        _reel_jobs[reel_id] = {"status": "completed", "response": response}


def get_reel_job(reel_id: str) -> dict[str, Any] | None:
    with _lock:
        job = _reel_jobs.get(reel_id)
        return dict(job) if job is not None else None
