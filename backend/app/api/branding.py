from pathlib import Path
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict
from fastapi.responses import FileResponse

from app.services.brand_service import (
    get_brand_config,
    get_brand_logo_path,
    get_logo_placement,
    save_user_logo,
    set_logo_placement,
)

router = APIRouter()


class LogoPlacementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    placement: Literal["start", "entire"]


class BrandingResponse(BaseModel):
    name: str
    tagline: str | None
    logo_url: str
    logo_placement: Literal["start", "entire"]
    primary_color: str | None
    secondary_color: str | None
    text_color: str | None


class BrandLogoUploadResponse(BaseModel):
    status: Literal["uploaded"]
    filename: str
    logo_url: str
    placement: Literal["start", "entire"]


class LogoPlacementResponse(BaseModel):
    status: Literal["updated"]
    placement: Literal["start", "entire"]

ALLOWED_LOGO_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
}

MAX_LOGO_SIZE = 10 * 1024 * 1024  # 10 MB


@router.get("/branding", response_model=BrandingResponse)
def get_branding() -> BrandingResponse:
    """
    Returns the current branding configuration.
    """

    config = get_brand_config()

    return BrandingResponse(
        name=config.name,
        tagline=config.tagline,
        logo_url="/api/branding/logo",
        logo_placement=get_logo_placement(),
        primary_color=config.primary_color,
        secondary_color=config.secondary_color,
        text_color=config.text_color,
    )


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


@router.post("/branding/logo", response_model=BrandLogoUploadResponse)
async def upload_brand_logo(
    file: UploadFile = File(...),
    placement: str = Form("start"),
) -> BrandLogoUploadResponse:
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
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to save brand logo.",
        ) from exc

    return BrandLogoUploadResponse(
        status="uploaded",
        filename=logo_path.name,
        logo_url="/api/branding/logo",
        placement=placement,
    )


@router.post("/branding/logo/placement", response_model=LogoPlacementResponse)
def update_logo_placement(
    request: LogoPlacementRequest,
) -> LogoPlacementResponse:
    """
    Updates the logo placement without re-uploading the logo.
    """

    placement = request.placement

    try:
        set_logo_placement(placement)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to update logo placement.",
        ) from exc

    return LogoPlacementResponse(status="updated", placement=placement)
