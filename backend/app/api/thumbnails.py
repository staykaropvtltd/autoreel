import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
THUMBNAIL_CACHE_DIR = _PROJECT_ROOT / "storage" / "temp" / "thumbnails"


@router.get("/thumbnails/{key}")
def get_thumbnail(key: str) -> FileResponse:
    # Our own cache keys are pure hex hashes - reject anything else outright
    # rather than resolving it against the filesystem.
    if not re.fullmatch(r"^[0-9a-fA-F]{16,64}$", key):
        raise HTTPException(status_code=400, detail="Invalid thumbnail key")

    path = THUMBNAIL_CACHE_DIR / f"{key}.jpg"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    return FileResponse(path, media_type="image/jpeg")
