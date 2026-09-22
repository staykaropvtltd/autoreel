from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse


from fastapi import File, UploadFile


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

# ===============================================================
# UPLOAD CUSTOM MUSIC
# ===============================================================



ALLOWED_MUSIC_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".m4a",
    ".aac",
}

MAX_MUSIC_SIZE_BYTES = 50 * 1024 * 1024
_MUSIC_CHUNK_SIZE = 1024 * 1024


@router.post("/music/upload")
async def upload_music(file: UploadFile = File(...)) -> dict:
    if not file:
        raise HTTPException(
            status_code=400,
            detail="No music file provided",
        )

    filename = safe_filename(file.filename or "")

    if not filename:
        raise HTTPException(
            status_code=400,
            detail="Invalid music filename",
        )

    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_MUSIC_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported music format. "
                "Allowed formats: MP3, WAV, M4A, AAC"
            ),
        )

    MUSIC_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    destination = MUSIC_DIR / filename

    size = 0

    try:
        with open(destination, "wb") as output_file:
            while chunk := await file.read(_MUSIC_CHUNK_SIZE):
                size += len(chunk)

                if size > MAX_MUSIC_SIZE_BYTES:
                    output_file.close()
                    destination.unlink(missing_ok=True)

                    raise HTTPException(
                        status_code=400,
                        detail="Music file is too large. Maximum size is 50 MB.",
                    )

                output_file.write(chunk)

    except HTTPException:
        raise

    except Exception as exc:
        destination.unlink(missing_ok=True)

        raise HTTPException(
            status_code=500,
            detail="Failed to save music file",
        ) from exc

    if size == 0:
        destination.unlink(missing_ok=True)

        raise HTTPException(
            status_code=400,
            detail="Empty music file",
        )

    return {
        "status": "uploaded",
        "filename": filename,
        "size": size,
    }
