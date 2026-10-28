from pathlib import Path
import logging
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_user, get_current_user_optional, get_db
from app.models.database_models import BrandSettings, User
from app.services.brand_service import (
    brand_config_for_user,
    delete_user_logo,
    get_brand_config,
    get_logo_placement,
    get_or_create_brand_settings,
    StorageObjectNotFound,
    StorageConfigurationError,
    get_user_logo,
    save_user_logo,
    set_logo_placement,
    update_brand_settings,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class LogoPlacementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    placement: Literal["start", "entire"]


class BrandingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, max_length=255)
    tagline: str | None = Field(default=None, max_length=500)
    primary_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    secondary_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    text_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    options: dict | None = None


class BrandingResponse(BaseModel):
    name: str
    tagline: str | None
    logo_url: str
    logo_placement: Literal["start", "entire"]
    primary_color: str | None
    secondary_color: str | None
    text_color: str | None
    options: dict = Field(default_factory=dict)


class BrandLogoUploadResponse(BaseModel):
    status: Literal["uploaded"]
    filename: str
    logo_url: str
    placement: Literal["start", "entire"]


class LogoPlacementResponse(BaseModel):
    status: Literal["updated"]
    placement: Literal["start", "entire"]


MAX_LOGO_SIZE = 10 * 1024 * 1024


def _response(
    config,
    placement: str,
    options: dict | None = None,
    logo_url: str = "/api/branding/logo",
) -> BrandingResponse:
    return BrandingResponse(
        name=config.name,
        tagline=config.tagline,
        logo_url=logo_url,
        logo_placement=placement,
        primary_color=config.primary_color,
        secondary_color=config.secondary_color,
        text_color=config.text_color,
        options=options or {},
    )


@router.get("/branding", response_model=BrandingResponse)
def get_branding(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> BrandingResponse:
    if current_user is None:
        return _response(get_brand_config(), get_logo_placement())
    settings = get_or_create_brand_settings(db, current_user.id)
    return _response(
        brand_config_for_user(db, current_user.id),
        get_logo_placement(settings),
        settings.options,
        "/api/branding/logo" if settings.logo_storage_path else "",
    )


@router.put("/branding", response_model=BrandingResponse)
def update_branding(
    request: BrandingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BrandingResponse:
    settings = update_brand_settings(db, current_user.id, **request.model_dump(exclude_unset=True))
    return _response(
        brand_config_for_user(db, current_user.id),
        get_logo_placement(settings),
        settings.options,
        "/api/branding/logo" if settings.logo_storage_path else "",
    )


@router.get("/branding/logo")
def get_logo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        logo = get_user_logo(db, current_user.id)
    except StorageObjectNotFound as exc:
        raise HTTPException(status_code=404, detail="Brand logo object not found") from exc
    except StorageConfigurationError as exc:
        logger.exception("Brand logo storage configuration failed for user_id=%s", current_user.id)
        raise HTTPException(status_code=503, detail="Brand logo storage is misconfigured") from exc
    except RuntimeError as exc:
        logger.exception("Brand logo Storage read failed for user_id=%s", current_user.id)
        raise HTTPException(status_code=503, detail="Brand logo storage is unavailable") from exc
    if logo:
        return Response(logo[0], media_type=logo[1], headers={"Cache-Control": "private, no-store"})
    # Logos are optional. Never serve another source's local/default logo here;
    # a configured per-user logo is fetched only through its private object path.
    raise HTTPException(status_code=404, detail="Brand logo not configured")


@router.post("/branding/logo", response_model=BrandLogoUploadResponse)
async def upload_brand_logo(
    file: UploadFile = File(...),
    placement: str = Form("start"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BrandLogoUploadResponse:
    if placement not in {"start", "entire"}:
        raise HTTPException(status_code=400, detail="Invalid logo placement. Use 'start' or 'entire'.")
    extension = Path(file.filename or "").suffix.lower()
    content = await file.read(MAX_LOGO_SIZE + 1)
    await file.close()
    if not content:
        raise HTTPException(status_code=400, detail="Logo file is empty.")
    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(status_code=400, detail="Logo file is too large. Maximum size is 10 MB.")
    try:
        object_path = save_user_logo(db, current_user.id, content, extension, placement)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except StorageConfigurationError as exc:
        logger.exception("Brand logo Storage configuration failed for user_id=%s", current_user.id)
        raise HTTPException(status_code=503, detail="Brand logo storage is misconfigured") from exc
    except RuntimeError as exc:
        logger.exception("Brand logo Storage upload failed for user_id=%s", current_user.id)
        raise HTTPException(status_code=503, detail="Brand logo storage is unavailable") from exc
    return BrandLogoUploadResponse(status="uploaded", filename=Path(object_path).name,
                                    logo_url="/api/branding/logo", placement=placement)


@router.delete("/branding/logo", status_code=204)
def remove_brand_logo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        delete_user_logo(db, current_user.id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Brand logo storage is unavailable") from exc
    return Response(status_code=204)


@router.post("/branding/logo/placement", response_model=LogoPlacementResponse)
def update_logo_placement(
    request: LogoPlacementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LogoPlacementResponse:
    set_logo_placement(db, current_user.id, request.placement)
    return LogoPlacementResponse(status="updated", placement=request.placement)
