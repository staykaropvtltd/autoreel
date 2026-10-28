import uuid
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_user, get_db
from app.core.job_store import template_is_in_use
from app.core.security import safe_filename
from app.models.database_models import EditorProject, Template, User
from app.services import template_service

router = APIRouter()
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
_ALLOWED_FORMATS = {
    ".jpg": ("JPEG", "image/jpeg"),
    ".jpeg": ("JPEG", "image/jpeg"),
    ".png": ("PNG", "image/png"),
    ".webp": ("WEBP", "image/webp"),
}


def _storage_error(exc: template_service.TemplateStorageError) -> HTTPException:
    status = 404 if isinstance(exc, template_service.TemplateObjectNotFound) else 503
    return HTTPException(status_code=status, detail="Template storage is unavailable")


@router.post("/templates/upload", status_code=201)
async def upload_template_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    filename = safe_filename(file.filename or "")
    if not filename or filename in {".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid template image filename")
    expected = _ALLOWED_FORMATS.get(Path(filename).suffix.lower())
    if expected is None:
        raise HTTPException(status_code=400, detail="Allowed template formats are JPG, PNG, and WEBP")

    body = await file.read(MAX_FILE_SIZE_BYTES + 1)
    if not body:
        raise HTTPException(status_code=400, detail="Template image is empty")
    if len(body) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Template image exceeds the 20 MB limit")
    try:
        with Image.open(BytesIO(body)) as image:
            image_format = image.format
            width, height = image.size
            if width <= 0 or height <= 0 or width * height > 40_000_000:
                raise ValueError("Image dimensions are outside the supported range")
            image.verify()
        if image_format != expected[0]:
            raise ValueError("Image contents do not match the filename extension")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Upload a valid JPG, PNG, or WEBP image") from exc

    template_id = str(uuid.uuid4())
    storage_path = f"{current_user.id}/{template_id}/{filename}"
    content_type = expected[1]
    row = Template(
        id=template_id,
        user_id=current_user.id,
        original_filename=filename,
        storage_path=storage_path,
        content_type=content_type,
        file_size_bytes=len(body),
        metadata_json={},
    )
    try:
        template_service.upload_object(storage_path, body, content_type)
        db.add(row)
        db.flush()
        db.refresh(row)
        response_data = template_service.template_response(row)
        db.commit()
    except template_service.TemplateStorageError as exc:
        db.rollback()
        try:
            template_service.delete_object(storage_path)
        except template_service.TemplateStorageError:
            pass
        raise _storage_error(exc) from exc
    except Exception as exc:
        db.rollback()
        try:
            template_service.delete_object(storage_path)
        except template_service.TemplateStorageError:
            pass
        raise HTTPException(status_code=503, detail="Could not save template metadata") from exc
    return {**response_data, "status": "uploaded"}


@router.get("/templates")
def list_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = db.scalars(
        select(Template).where(Template.user_id == current_user.id).order_by(Template.created_at.desc())
    ).all()
    return [template_service.template_response(row) for row in rows]


def _owned_template(template_id: str, user: User, db: Session) -> Template:
    try:
        normalized_id = str(uuid.UUID(template_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid template ID") from exc
    template = template_service.get_owned_template(db, normalized_id, user.id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    try:
        template.storage_path = template_service.validate_storage_path(
            template.storage_path, user.id, template.id
        )
    except template_service.TemplateStorageError as exc:
        raise HTTPException(status_code=500, detail="Template metadata is invalid") from exc
    return template


@router.get("/templates/{template_id}/preview")
def preview_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    template = _owned_template(template_id, current_user, db)
    try:
        body = template_service.get_object(template.storage_path)
    except template_service.TemplateStorageError as exc:
        raise _storage_error(exc) from exc
    return Response(
        content=body,
        media_type=template.content_type,
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/templates/{template_id}")
def delete_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    template = _owned_template(template_id, current_user, db)
    if template_is_in_use(template.id, current_user.id):
        raise HTTPException(status_code=409, detail="Template is attached to an active or saved analysis workflow")
    # Saved Image-to-Reel projects use template UUIDs as durable private image
    # references. Keep their backing objects until those projects are removed.
    projects = db.scalars(select(EditorProject).where(EditorProject.user_id == current_user.id)).all()
    in_editor_project = any(
        any(slide.get("asset_id") == template.id for slide in (project.project_data or {}).get("slides", []))
        or (project.project_data or {}).get("overlays", {}).get("logo_asset_id") == template.id
        for project in projects
    )
    if in_editor_project:
        raise HTTPException(status_code=409, detail="Image is attached to a saved editor project")
    template_id_value = template.id
    content_type = template.content_type
    try:
        body = template_service.get_object(template.storage_path)
        template_service.delete_object(template.storage_path)
    except template_service.TemplateStorageError as exc:
        raise _storage_error(exc) from exc
    try:
        db.delete(template)
        db.commit()
    except Exception as exc:
        db.rollback()
        try:
            template_service.upload_object(template.storage_path, body, template.content_type)
        except template_service.TemplateStorageError:
            pass
        raise HTTPException(status_code=503, detail="Could not delete template metadata") from exc
    cache_path = template_service.render_cache_path(current_user.id, template_id_value, content_type)
    cache_path.unlink(missing_ok=True)
    return {"deleted": True}
