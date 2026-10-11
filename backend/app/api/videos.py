import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.job_store import create_upload_job
from app.core.security import safe_filename

router = APIRouter()

# Resolved from this file's location so behavior is independent of the
# process cwd (matches app/api/reels.py's convention).
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
RAW_UPLOADS_DIR = _PROJECT_ROOT / "storage" / "uploads"
DEMO_RAW_DIR = _PROJECT_ROOT / "assets" / "demo" / "raw"

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm"}
MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024
_CHUNK_SIZE = 1024 * 1024


@router.post("/videos/upload")
async def upload_videos(files: list[UploadFile] = File(...)) -> dict:
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    job_id = str(uuid.uuid4())
    job_dir = RAW_UPLOADS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    uploaded_files = []
    for upload in files:
        filename = safe_filename(upload.filename or "")
        extension = Path(filename).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported video format: {filename}")

        destination = job_dir / filename
        size = 0
        with open(destination, "wb") as out_file:
            while chunk := await upload.read(_CHUNK_SIZE):
                size += len(chunk)
                if size > MAX_FILE_SIZE_BYTES:
                    out_file.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(status_code=400, detail=f"File too large: {filename}")
                out_file.write(chunk)

        if size == 0:
            destination.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail=f"Empty file: {filename}")

        uploaded_files.append({"filename": filename, "size": size})

    create_upload_job(job_id, uploaded_files)
    return {"job_id": job_id, "status": "uploaded", "files": uploaded_files}


@router.get("/demo/status")
def demo_status() -> dict:
    available = DEMO_RAW_DIR.exists() and any(DEMO_RAW_DIR.glob("*.mp4"))
    return {"available": available}
