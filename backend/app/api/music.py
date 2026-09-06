from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.core.security import safe_filename
from app.services.music_service import discover_music_library

router = APIRouter()

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
MUSIC_DIR = _PROJECT_ROOT / "assets" / "music"


@router.get("/music")
def list_music() -> list[dict]:
    """Dynamically scans assets/music/ - never a hard-coded track list."""
    return discover_music_library(MUSIC_DIR)


@router.get("/music/{track_id}/preview")
def preview_music(track_id: str) -> FileResponse:
    """Serves audio for preview by id, looked up against the discovered
    library only - never a raw filesystem path from the client, so there is
    nothing to traverse.
    """
    track = next((t for t in discover_music_library(MUSIC_DIR) if t["id"] == track_id), None)
    if track is None:
        raise HTTPException(status_code=404, detail=f"Track not found: {track_id}")

    path = MUSIC_DIR / safe_filename(track["filename"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Track file missing")

    return FileResponse(path, media_type="audio/mpeg")
