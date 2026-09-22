from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.services.brand_service import (
    get_brand_config,
    get_brand_logo_path,
    get_logo_placement,
    save_user_logo,
)

router = APIRouter()

ALLOWED_LOGO_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
}

MAX_LOGO_SIZE = 10 * 1024 * 1024  # 10 MB


@router.get("/branding")
def get_branding() -> dict:
    """
    Returns the current branding configuration.
    """

    config = get_brand_config()

    return {
        "name": config.name,
        "tagline": config.tagline,
        "logo_url": "/api/branding/logo",
        "logo_placement": get_logo_placement(),
        "primary_color": config.primary_color,
        "secondary_color": config.secondary_color,
        "text_color": config.text_color,
    }


@router.get("/branding/logo")
def get_logo() -> FileResponse:
    """
    Serves the currently configured branding logo.
    """

    logo_path = get_brand_logo_path()

    if logo_path is None:
        raise HTTPException(
            status_code=404,
            detail="Brand logo not configured",
        )

    media_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }

    media_type = media_types.get(
        Path(logo_path).suffix.lower(),
        "image/png",
    )

    return FileResponse(
        logo_path,
        media_type=media_type,
    )


@router.post("/branding/logo")
async def upload_brand_logo(
    file: UploadFile = File(...),
    placement: str = Form("start"),
) -> dict:
    """
    Uploads or replaces the user's brand logo.

    placement:
        start  -> logo appears at the beginning of the reel
        entire -> logo appears throughout the reel
    """

    if placement not in {"start", "entire"}:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid logo placement. "
                "Use 'start' or 'entire'."
            ),
        )

    filename = file.filename or ""
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_LOGO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported logo format. "
                "Allowed formats: PNG, JPG, JPEG, WEBP."
            ),
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Logo file is empty.",
        )

    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Logo file is too large. Maximum size is 10 MB.",
        )

    try:
        logo_path = save_user_logo(
            file_bytes=content,
            extension=extension,
            placement=placement,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to save brand logo.",
        ) from exc

    return {
        "status": "uploaded",
        "filename": logo_path.name,
        "logo_url": "/api/branding/logo",
        "placement": placement,
    }