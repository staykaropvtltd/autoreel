
import json
import mimetypes
import uuid
from pathlib import Path
import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.core.security import safe_filename
from app.services.ffmpeg_service import FFprobeError
from app.services.music_service import (
    discover_music_libraries,
    find_track_by_id,
    validate_audio_file,
)

router = APIRouter()

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
MUSIC_DIR = _PROJECT_ROOT / "assets" / "music"
CUSTOM_MUSIC_DIR = _PROJECT_ROOT / "storage" / "music"

ALLOWED_MUSIC_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac"}
MAX_MUSIC_SIZE_BYTES = 50 * 1024 * 1024
MAX_CUSTOM_MUSIC_STORAGE_BYTES = 500 * 1024 * 1024
_MUSIC_CHUNK_SIZE = 1024 * 1024

LIBRARIES = [
    (MUSIC_DIR, False),
    (CUSTOM_MUSIC_DIR, True),
]
UPLOAD_RATE_LIMIT = 5
UPLOAD_RATE_WINDOW_SECONDS = 60

_upload_attempts = defaultdict(deque)


def check_upload_rate_limit(client_ip: str) -> None:
    now = time.monotonic()
    attempts = _upload_attempts[client_ip]

    # Remove attempts older than one minute.
    while attempts and now - attempts[0] >= UPLOAD_RATE_WINDOW_SECONDS:
        attempts.popleft()

    if len(attempts) >= UPLOAD_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Too many upload attempts. Please try again in one minute.",
        )

    attempts.append(now)


@router.get("/music")
def list_music() -> list[dict]:
    tracks = discover_music_libraries(LIBRARIES)

    # Never return internal server filesystem paths to the client.
    return [
        {key: value for key, value in track.items() if key != "_path"}
        for track in tracks
    ]


@router.get("/music/{track_id}/preview")
def preview_music(track_id: str) -> FileResponse:
    track = find_track_by_id(LIBRARIES, track_id)

    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")

    path = Path(track["_path"])

    if not path.is_file():
        raise HTTPException(status_code=404, detail="Track file not found")

    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"

    return FileResponse(path, media_type=media_type)


@router.post("/music/upload")
async def upload_music(
    request: Request,
    file: UploadFile = File(...),
) -> dict:
    client_ip = (
        request.client.host
        if request.client
        else "unknown"
    )

    check_upload_rate_limit(client_ip)

    
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No music file provided")

    original_filename = safe_filename(file.filename)

    if not original_filename:
        raise HTTPException(status_code=400, detail="Invalid music filename")

    extension = Path(original_filename).suffix.lower()

    if extension not in ALLOWED_MUSIC_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported music format. Allowed: MP3, WAV, M4A, AAC",
        )

    CUSTOM_MUSIC_DIR.mkdir(parents=True, exist_ok=True)

    # Global storage cap is an interim protection until real user ownership
    # and per-user quotas are implemented.
    current_size = sum(
        path.stat().st_size
        for path in CUSTOM_MUSIC_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in ALLOWED_MUSIC_EXTENSIONS
    )

    if current_size >= MAX_CUSTOM_MUSIC_STORAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Custom music storage limit reached",
        )

    upload_id = str(uuid.uuid4())
    temp_path = CUSTOM_MUSIC_DIR / f".{upload_id}.upload{extension}"
    destination = CUSTOM_MUSIC_DIR / f"{upload_id}{extension}"
    metadata_path = CUSTOM_MUSIC_DIR / f"{upload_id}.json"

    size = 0

    try:
        # "xb" prevents accidentally overwriting an existing temp file.
        with temp_path.open("xb") as output_file:
            while chunk := await file.read(_MUSIC_CHUNK_SIZE):
                size += len(chunk)

                if size > MAX_MUSIC_SIZE_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="Music file is too large. Maximum size is 50 MB.",
                    )

                if current_size + size > MAX_CUSTOM_MUSIC_STORAGE_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="Custom music storage limit reached",
                    )

                output_file.write(chunk)

        if size == 0:
            raise HTTPException(status_code=400, detail="Empty music file")

        # Verify actual content rather than trusting the extension.
        try:
            audio_info = validate_audio_file(temp_path)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail="Invalid or unsupported audio file",
            ) from exc

        # Unique destination; never write into assets/music.
        temp_path.replace(destination)

        metadata_path.write_text(
            json.dumps({"original_filename": original_filename}),
            encoding="utf-8",
        )

        return {
            "status": "uploaded",
            "id": upload_id,
            "filename": destination.name,
            "display_name": Path(original_filename).stem.replace("_", " ").replace("-", " ").title(),
            "duration": audio_info["duration"],
            "format": extension.lstrip("."),
            "is_custom": True,
            "size": size,
        }

    except HTTPException:
        temp_path.unlink(missing_ok=True)
        destination.unlink(missing_ok=True)
        metadata_path.unlink(missing_ok=True)
        raise

    except Exception as exc:
        temp_path.unlink(missing_ok=True)
        destination.unlink(missing_ok=True)
        metadata_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to save or validate music file",
        ) from exc

    finally:
        await file.close()
