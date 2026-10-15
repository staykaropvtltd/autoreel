"""Free, authenticated Image-to-Reel project persistence and export APIs."""
import uuid
import os
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_user, get_db
from app.core.storage import OUTPUTS_DIR
from app.core.job_store import create_render_job, update_reel_job
from app.models.database_models import EditorProject, ReelHistory, Template, User
from app.services import template_service
from app.services.photo_reel_renderer import render_photo_reel

router = APIRouter(prefix="/editor-projects", tags=["Image-to-Reel editor"])
logger = logging.getLogger(__name__)
MOTIONS = {"zoom_in", "zoom_out", "pan_left", "pan_right", "static"}
TRANSITIONS = {"cut", "crossfade", "slide"}


class ProjectPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=255)
    category: str = Field(default="Product", max_length=60)
    slides: list[dict] = Field(min_length=1, max_length=100)
    overlays: dict = Field(default_factory=dict)
    audio: dict = Field(default_factory=dict)
    settings: dict = Field(default_factory=lambda: {"aspect_ratio": "9:16", "width": 1080, "height": 1920, "fps": 30})


def _validated_payload(payload: ProjectPayload, user_id: int, db: Session) -> dict:
    settings = payload.settings
    if settings.get("aspect_ratio") not in {"9:16", "1:1", "16:9"}:
        raise HTTPException(400, "Unsupported aspect ratio")
    width, height, fps = settings.get("width"), settings.get("height"), settings.get("fps")
    dimensions = {
        ("9:16", 720, 1280), ("9:16", 1080, 1920),
        ("1:1", 720, 720), ("1:1", 1080, 1080),
        ("16:9", 1280, 720), ("16:9", 1920, 1080),
    }
    if (settings.get("aspect_ratio"), width, height) not in dimensions or fps not in {24, 25, 30}:
        raise HTTPException(400, "Unsupported output dimensions or frame rate")
    slides = []
    duration_total = 0.0
    for entry in payload.slides:
        try:
            asset_id = str(uuid.UUID(str(entry.get("asset_id"))))
        except (ValueError, TypeError, AttributeError) as exc:
            raise HTTPException(400, "Each slide must reference a valid uploaded image asset") from exc
        asset = db.scalar(select(Template).where(Template.id == asset_id, Template.user_id == user_id))
        if asset is None or asset.content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise HTTPException(400, "A slide image is missing or is not owned by this account")
        duration = entry.get("duration")
        if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not 0.5 <= duration <= 15:
            raise HTTPException(400, "Slide duration must be between 0.5 and 15 seconds")
        motion = entry.get("motion", "static")
        transition = entry.get("transition", "cut")
        if motion not in MOTIONS or transition not in TRANSITIONS:
            raise HTTPException(400, "Unsupported slide motion or transition")
        if entry.get("fitMode", "cover") not in {"cover", "contain"}:
            raise HTTPException(400, "Unsupported image fit mode")
        duration_total += float(duration)
        slides.append({
            "id": str(entry.get("id") or uuid.uuid4()),
            "asset_id": asset_id,
            "name": str(entry.get("name") or asset.original_filename)[:255],
            "duration": float(duration), "motion": motion, "transition": transition,
            "fitMode": entry.get("fitMode", "cover"),
        })
    if duration_total > 180:
        raise HTTPException(400, "Total project duration cannot exceed 180 seconds")
    overlays = payload.overlays
    safe_overlays = {
        "title": str(overlays.get("title") or "")[:160],
        "subtitle": str(overlays.get("subtitle") or "")[:200],
        "brandName": str(overlays.get("brandName") or "")[:100],
        "titlePosition": overlays.get("titlePosition", "bottom"),
        "titleSize": max(12, min(100, int(overlays.get("titleSize", 38)))),
        "brandWatermarkPosition": overlays.get("brandWatermarkPosition", "none"),
        "showPriceTag": bool(overlays.get("showPriceTag", False)),
        "price": str(overlays.get("price") or "")[:30],
        "showCtaBadge": bool(overlays.get("showCtaBadge", False)),
        "ctaText": str(overlays.get("ctaText") or "")[:100],
        "showEndCard": bool(overlays.get("showEndCard", False)),
        "endCardText": str(overlays.get("endCardText") or "")[:100],
        "endCardSubtext": str(overlays.get("endCardSubtext") or "")[:200],
        "showLogo": bool(overlays.get("showLogo", False)),
        "logoPosition": overlays.get("logoPosition", "top-right"),
        "logoSize": max(32, min(400, int(overlays.get("logoSize", 130)))),
        "logoOpacity": max(0.2, min(1.0, float(overlays.get("logoOpacity", 0.95)))),
    }
    if safe_overlays["titlePosition"] not in {"top", "center", "bottom"} or safe_overlays["brandWatermarkPosition"] not in {"top-left", "top-right", "bottom-center", "none"}:
        raise HTTPException(400, "Unsupported overlay placement")
    if safe_overlays["logoPosition"] not in {"top-left", "top", "top-right", "left", "center", "right", "bottom-left", "down", "bottom-right"}:
        raise HTTPException(400, "Unsupported logo placement")
    logo_asset_id = overlays.get("logo_asset_id")
    if logo_asset_id:
        try:
            logo_asset_id = str(uuid.UUID(str(logo_asset_id)))
        except (ValueError, TypeError, AttributeError) as exc:
            raise HTTPException(400, "Invalid logo image reference") from exc
        logo = db.scalar(select(Template).where(Template.id == logo_asset_id, Template.user_id == user_id))
        if logo is None:
            raise HTTPException(400, "Logo image is missing or is not owned by this account")
        safe_overlays["logo_asset_id"] = logo_asset_id
    audio = payload.audio
    track_id = audio.get("trackId")
    if track_id is not None and (not isinstance(track_id, str) or len(track_id) > 200):
        raise HTTPException(400, "Invalid soundtrack selection")
    volume = audio.get("volume", 0.85)
    offset = audio.get("offset", 0)
    if not isinstance(volume, (int, float)) or not 0 <= volume <= 1 or not isinstance(offset, (int, float)) or not 0 <= offset <= 3600:
        raise HTTPException(400, "Invalid soundtrack settings")
    if track_id:
        from app.api.music import get_libraries
        from app.services.music_service import find_track_by_id, get_owned_custom_track, is_custom_track_id
        available = (
            get_owned_custom_track(db, user_id, track_id)
            if is_custom_track_id(track_id)
            else find_track_by_id(get_libraries(), track_id)
        )
        if available is None:
            raise HTTPException(400, "The selected soundtrack is unavailable on the server. Choose a catalog or uploaded track.")
    return {
        "category": payload.category,
        "slides": slides,
        "overlays": safe_overlays,
        "audio": {"trackId": track_id, "trackTitle": str(audio.get("trackTitle") or "")[:255], "volume": float(volume), "offset": float(offset)},
        "settings": {"aspect_ratio": settings["aspect_ratio"], "width": width, "height": height, "fps": fps, "total_duration": round(duration_total, 3)},
    }


def _response(row: EditorProject) -> dict:
    public_metadata = {key: value for key, value in (row.export_metadata or {}).items() if key != "worker_pid"}
    return {"id": row.id, "title": row.title, **(row.project_data or {}),
            "export_status": row.export_status, "reel_id": row.export_reel_id,
            "export_error": row.export_error, "export_metadata": public_metadata,
            "created_at": row.created_at, "updated_at": row.updated_at}


@router.post("", status_code=201)
def create_project(payload: ProjectPayload, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = _validated_payload(payload, user.id, db)
    row = EditorProject(id=str(uuid.uuid4()), user_id=user.id, title=payload.title.strip(), project_data=data)
    db.add(row); db.commit(); db.refresh(row)
    return _response(row)


@router.get("")
def list_projects(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(EditorProject).where(EditorProject.user_id == user.id).order_by(EditorProject.updated_at.desc())).all()
    return [_response(row) for row in rows]


def _owned(project_id: str, user: User, db: Session) -> EditorProject:
    try:
        normalized = str(uuid.UUID(project_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(400, "Invalid project ID") from exc
    row = db.scalar(select(EditorProject).where(EditorProject.id == normalized, EditorProject.user_id == user.id).with_for_update())
    if row is None:
        raise HTTPException(404, "Project not found")
    return row


@router.get("/{project_id}")
def get_project(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _response(_owned(project_id, user, db))


@router.put("/{project_id}")
def save_project(project_id: str, payload: ProjectPayload, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _owned(project_id, user, db)
    if row.export_status == "rendering":
        raise HTTPException(409, "This project is currently exporting")
    row.title = payload.title.strip()
    row.project_data = _validated_payload(payload, user.id, db)
    row.updated_at = datetime.now(timezone.utc)
    if row.export_status in {"failed", "completed"}:
        row.export_status = "idle"; row.export_error = None
    db.commit(); db.refresh(row)
    return _response(row)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _owned(project_id, user, db)
    if row.export_status == "rendering":
        raise HTTPException(409, "This project is currently exporting")
    db.delete(row); db.commit()


@router.post("/{project_id}/export")
def export_project(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _owned(project_id, user, db)
    if row.export_status == "rendering":
        worker_pid = (row.export_metadata or {}).get("worker_pid")
        worker_alive = False
        if isinstance(worker_pid, int):
            try:
                os.kill(worker_pid, 0)
                worker_alive = True
            except OSError:
                worker_alive = False
        if worker_alive:
            raise HTTPException(409, "This project is already exporting")
        # A previous backend process stopped during synchronous rendering.
        # Reconcile its persisted history row and allow a free retry.
        abandoned_reel_id = row.export_reel_id
        if abandoned_reel_id:
            abandoned = db.scalar(select(ReelHistory).where(ReelHistory.reel_id == abandoned_reel_id, ReelHistory.user_id == user.id))
            if abandoned:
                db.delete(abandoned)
        row.export_status = "failed"
        row.export_error = "Previous export process stopped before completion. Retry the free export."
        row.export_reel_id = None
        db.commit()
        if abandoned_reel_id:
            update_reel_job(
                abandoned_reel_id,
                status="failed",
                stage="failed",
                progress=100,
                error="Previous Image-to-Reel export stopped before completion.",
            )
    if row.export_status == "completed" and row.export_reel_id:
        history = db.scalar(select(ReelHistory).where(ReelHistory.reel_id == row.export_reel_id, ReelHistory.user_id == user.id))
        if history and history.output_path and Path(history.output_path).is_file():
            return {"status": "completed", "reel_id": row.export_reel_id, "download_url": f"/api/reels/{row.export_reel_id}/download", "metadata": row.export_metadata}
    # Revalidate all current owner references before marking work as started.
    data = _validated_payload(ProjectPayload(title=row.title, **(row.project_data or {})), user.id, db)
    reel_id = str(uuid.uuid4())
    output = (OUTPUTS_DIR / f"{reel_id}.mp4").resolve()
    if not output.is_relative_to(OUTPUTS_DIR.resolve()):
        raise HTTPException(400, "Invalid output target")
    row.project_data = data
    row.export_status = "rendering"; row.export_error = None; row.export_reel_id = reel_id
    row.export_metadata = {"worker_pid": os.getpid(), "started_at": datetime.now(timezone.utc).isoformat()}
    db.commit()
    if not create_render_job(reel_id, user.id, "image_to_reel", reel_id=reel_id,
                             response_data={"project_id": row.id}):
        raise HTTPException(409, "An export job with this identifier already exists")
    update_reel_job(reel_id, status="processing", stage="rendering", progress=45)
    try:
        metadata = render_photo_reel(data, user.id, output, db)
        if not output.is_file() or output.stat().st_size <= 0:
            raise RuntimeError("Renderer completed without creating a valid output file")
        if not output.resolve().is_relative_to(OUTPUTS_DIR.resolve()):
            raise RuntimeError("Renderer output escaped the configured output directory")
        history = ReelHistory(
            reel_id=reel_id,
            user_id=user.id,
            status="completed",
            title=row.title,
            output_path=str(output.resolve()),
            created_at=datetime.now(timezone.utc),
        )
        db.add(history)
        row.export_status = "completed"; row.export_metadata = metadata; row.export_error = None
        db.commit()
        update_reel_job(
            reel_id, status="completed", stage="completed", progress=100,
            response={"reel_id": reel_id, "download_url": f"/api/reels/{reel_id}/download", "metadata": metadata},
            output_path=str(output.resolve()),
        )
        return {"status": "completed", "reel_id": reel_id, "download_url": f"/api/reels/{reel_id}/download", "metadata": metadata}
    except Exception as exc:
        logger.exception("Image-to-Reel export failed for project %s (user %s)", row.id, user.id)
        output.unlink(missing_ok=True)
        history = db.scalar(select(ReelHistory).where(ReelHistory.reel_id == reel_id, ReelHistory.user_id == user.id))
        if history:
            db.delete(history)
        row.export_status = "failed"; row.export_error = "Export failed. Check the project images and soundtrack, then retry."; row.export_reel_id = None
        db.commit()
        update_reel_job(reel_id, status="failed", stage="failed", progress=100,
                        error="Image-to-Reel export failed. Please try again.")
        if isinstance(exc, (ValueError, template_service.TemplateStorageError)):
            raise HTTPException(400, "The saved project has invalid or unavailable media/settings.") from exc
        raise HTTPException(500, "Image-to-Reel export failed. Please try again.") from exc

