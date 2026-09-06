from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.services.brand_service import get_brand_config, get_brand_logo_path

router = APIRouter()


@router.get("/branding")
def get_branding() -> dict:
    """The single source of truth the frontend renders its identity from -
    see brand_service.get_brand_config(). Changing assets/branding/brand.json
    changes this response, and therefore the website, without any frontend
    code change.
    """
    config = get_brand_config()
    return {
        "name": config.name,
        "tagline": config.tagline,
        "logo_url": "/api/branding/logo",
        "primary_color": config.primary_color,
        "secondary_color": config.secondary_color,
        "text_color": config.text_color,
    }


@router.get("/branding/logo")
def get_logo() -> FileResponse:
    """Serves ONLY the configured branding logo (assets/branding/brand.json's
    "logo" field, resolved as a bare filename inside assets/branding/ - see
    brand_service.get_brand_logo_path). There is no filename or path taken
    from the request, so there is nothing for a client to traverse.
    """
    logo_path = get_brand_logo_path()
    if logo_path is None:
        raise HTTPException(status_code=404, detail="Brand logo not configured")
    return FileResponse(logo_path, media_type="image/jpeg")
