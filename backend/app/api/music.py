
import mimetypes
import uuid
from pathlib import Path
import time
from collections import defaultdict, deque

from fastapi import Request, Depends
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.security import safe_filename
from app.core.auth_dependencies import get_current_user, get_current_user_optional, get_db
from app.core.storage import TEMP_DIR
from app.models.database_models import MusicTrack, User
from app.services.music_service import (
    discover_music_libraries,
    custom_track_response,
    get_owned_custom_track,
    validate_audio_file,
)
from app.services import music_storage_service

router = APIRouter()

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
MUSIC_DIR = _PROJECT_ROOT / "assets" / "music"
ALLOWED_MUSIC_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac"}
MAX_MUSIC_SIZE_BYTES = 50 * 1024 * 1024
MAX_USER_MUSIC_STORAGE_BYTES = 500 * 1024 * 1024
_MUSIC_CHUNK_SIZE = 1024 * 1024

def get_libraries() -> list[tuple[Path, bool]]:
    # Only built-in catalog files are local/shared. User uploads are private
    # Supabase objects indexed by the authenticated owner's MusicTrack rows.
    return [(MUSIC_DIR, False)]


# Backward-compatibility alias
LIBRARIES = get_libraries()
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
def list_music(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    tracks = discover_music_libraries(get_libraries())
    result = [{key: value for key, value in track.items() if key != "_path"} for track in tracks]
    custom_tracks = db.scalars(select(MusicTrack).where(
        MusicTrack.owner_user_id == current_user.id,
        MusicTrack.is_builtin.is_(False),
    ).order_by(MusicTrack.created_at.desc())).all()
    for track in custom_tracks:
        try:
            path = music_storage_service.validate_storage_path(track.storage_path, current_user.id)
            preview_url = music_storage_service.create_signed_url(path)
        except music_storage_service.MusicStorageError as exc:
            raise HTTPException(status_code=503, detail="Private soundtrack storage is unavailable") from exc
        result.append(custom_track_response(track, preview_url))
    return result


@router.get("/music/{track_id}/preview")
def preview_music(
    track_id: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    if track_id.startswith("custom-"):
        if current_user is None:
            raise HTTPException(status_code=401, detail="Authentication required")
        track = get_owned_custom_track(db, current_user.id, track_id)
        if track is None:
            raise HTTPException(status_code=404, detail="Track not found")
        try:
            path = music_storage_service.validate_storage_path(track.storage_path, current_user.id)
            body = music_storage_service.get_object(path)
        except music_storage_service.MusicObjectNotFound as exc:
            raise HTTPException(status_code=404, detail="Track not found") from exc
        except music_storage_service.MusicStorageError as exc:
            raise HTTPException(status_code=503, detail="Private soundtrack storage is unavailable") from exc
        media_type = mimetypes.guess_type(track.original_filename)[0] or "application/octet-stream"
        return Response(body, media_type=media_type)

    track = next((item for item in discover_music_libraries(get_libraries()) if item["id"] == track_id), None)
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    client_ip = (
        request.client.host
        if request.client
        else "unknown"
    )

    check_upload_rate_limit(client_ip)

    
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No music file provided")

    supplied_filename = file.filename
    if (
        supplied_filename in {".", ".."}
        or "/" in supplied_filename
        or "\\" in supplied_filename
        or Path(supplied_filename).name != supplied_filename
    ):
        raise HTTPException(status_code=400, detail="Invalid music filename")
    original_filename = safe_filename(supplied_filename)

    if not original_filename:
        raise HTTPException(status_code=400, detail="Invalid music filename")

    extension = Path(original_filename).suffix.lower()

    if extension not in ALLOWED_MUSIC_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported music format. Allowed: MP3, WAV, M4A, AAC",
        )

    upload_id = str(uuid.uuid4())
    current_size = db.scalar(select(func.coalesce(func.sum(MusicTrack.file_size_bytes), 0)).where(
        MusicTrack.owner_user_id == current_user.id,
        MusicTrack.is_builtin.is_(False),
    )) or 0
    temp_root = (TEMP_DIR / "music-validation" / str(current_user.id)).resolve()
    temp_root.mkdir(parents=True, exist_ok=True)
    temp_path = (temp_root / f"{upload_id}{extension}").resolve()
    if not temp_path.is_relative_to(temp_root):
        raise HTTPException(status_code=400, detail="Invalid music filename")

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

                if current_size + size > MAX_USER_MUSIC_STORAGE_BYTES:
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

        storage_path = f"users/{current_user.id}/{upload_id}{extension}"
        music_storage_service.validate_storage_path(storage_path, current_user.id)
        try:
            music_storage_service.upload_object(
                storage_path,
                temp_path.read_bytes(),
                mimetypes.guess_type(original_filename)[0] or "application/octet-stream",
            )
        except music_storage_service.MusicStorageError as exc:
            raise HTTPException(status_code=503, detail="Private soundtrack storage is unavailable") from exc
        try:
            preview_url = music_storage_service.create_signed_url(storage_path)
        except music_storage_service.MusicStorageError as exc:
            try:
                music_storage_service.delete_object(storage_path)
            except music_storage_service.MusicStorageError:
                pass
            raise HTTPException(status_code=503, detail="Private soundtrack storage is unavailable") from exc
        row = MusicTrack(
            owner_user_id=current_user.id,
            title=Path(original_filename).stem.replace("_", " ").replace("-", " ").title(),
            original_filename=original_filename,
            storage_path=storage_path,
            file_format=extension.lstrip("."),
            file_size_bytes=size,
            duration_seconds=audio_info["duration"],
            is_builtin=False,
        )
        try:
            db.add(row)
            db.commit()
            db.refresh(row)
        except Exception as exc:
            db.rollback()
            try:
                music_storage_service.delete_object(storage_path)
            except music_storage_service.MusicStorageError:
                pass
            raise HTTPException(status_code=500, detail="Failed to save soundtrack metadata") from exc
        response = custom_track_response(row, preview_url)
        response.update({"status": "uploaded", "size": size})
        return response

    except HTTPException:
        temp_path.unlink(missing_ok=True)
        raise

    except Exception as exc:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to save or validate music file",
        ) from exc

    finally:
        temp_path.unlink(missing_ok=True)
        await file.close()


@router.delete("/music/{track_id}", status_code=204)
def delete_music(
    track_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    track = get_owned_custom_track(db, current_user.id, track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")
    try:
        storage_path = music_storage_service.validate_storage_path(track.storage_path, current_user.id)
        music_storage_service.delete_object(storage_path)
    except music_storage_service.MusicObjectNotFound:
        pass
    except music_storage_service.MusicStorageError as exc:
        raise HTTPException(status_code=503, detail="Private soundtrack storage is unavailable") from exc
    db.delete(track)
    db.commit()
