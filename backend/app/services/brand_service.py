"""Per-user branding backed by PostgreSQL and private Supabase Storage."""

import base64
import io
import json
import os
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path, PurePosixPath

from PIL import Image
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.database_models import BrandSettings
from app.schemas.branding import BrandConfig

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BRANDING_DIR = PROJECT_ROOT / "assets" / "branding"
BRAND_CONFIG_PATH = BRANDING_DIR / "brand.json"
USER_BRANDING_DIR = PROJECT_ROOT / "storage" / "branding"  # legacy test compatibility only
USER_BRAND_CONFIG_PATH = USER_BRANDING_DIR / "brand.json"
_FALLBACK = BrandConfig(name="Auto-Reel Studio")
_ALLOWED_LOGO_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


class StorageObjectNotFound(RuntimeError):
    """The configured private bucket has no object at a saved logo path."""


class StorageConfigurationError(RuntimeError):
    """Private logo storage is missing or has invalid configuration."""


def _read_default() -> dict:
    try:
        data = json.loads(BRAND_CONFIG_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _storage_settings() -> tuple[str, str, str]:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    bucket = os.getenv("SUPABASE_BRANDING_BUCKET", "")
    if not (url and key and bucket):
        raise StorageConfigurationError(
            "Private logo storage requires SUPABASE_URL, "
            "SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_BRANDING_BUCKET"
        )
    if key.startswith("sb_publishable_"):
        raise StorageConfigurationError(
            "SUPABASE_SERVICE_ROLE_KEY contains a publishable key; configure a server-side Supabase secret/service-role key"
        )
    key_parts = key.split(".")
    if len(key_parts) == 3:
        try:
            payload = key_parts[1] + "=" * (-len(key_parts[1]) % 4)
            role = json.loads(base64.urlsafe_b64decode(payload)).get("role")
        except (ValueError, TypeError, json.JSONDecodeError):
            role = None
        if role in {"anon", "authenticated"}:
            raise StorageConfigurationError(
                "SUPABASE_SERVICE_ROLE_KEY must have server-side service-role access"
            )
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise StorageConfigurationError("SUPABASE_URL must be an absolute HTTP(S) URL")
    # Some deployments copy the PostgREST endpoint into SUPABASE_URL. Storage
    # routes are rooted at the project URL, so remove only that known API suffix.
    if parsed.path.rstrip("/") == "/rest/v1":
        url = urllib.parse.urlunparse(parsed._replace(path="", params="", query="", fragment=""))
    return url, key, bucket


def _storage_request(method: str, object_path: str, body: bytes | None = None,
                     content_type: str | None = None) -> bytes:
    url, key, bucket = _storage_settings()
    encoded_path = "/".join(urllib.parse.quote(part, safe="") for part in object_path.split("/"))
    request = urllib.request.Request(
        f"{url}/storage/v1/object/{urllib.parse.quote(bucket, safe='')}/{encoded_path}",
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": content_type or "application/octet-stream",
            "x-upsert": "false",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        response_text = exc.read().decode("utf-8", errors="replace").lower()
        if "bucket not found" in response_text or "bucket does not exist" in response_text:
            raise StorageConfigurationError("Configured Supabase Storage bucket was not found") from exc
        if (
            exc.code in {401, 403}
            or "row-level security policy" in response_text
            or '"code":"accessdenied"' in response_text.replace(" ", "")
        ):
            raise StorageConfigurationError(
                "Supabase Storage rejected the configured credentials or access policy"
            ) from exc
        if method == "GET" and exc.code == 404:
            raise StorageObjectNotFound("Brand logo object was not found") from exc
        raise RuntimeError(f"Supabase Storage request failed ({exc.code})") from exc
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise RuntimeError("Could not reach Supabase Storage; check its URL and network access") from exc


def get_or_create_brand_settings(db: Session, user_id: int) -> BrandSettings:
    settings = db.scalar(select(BrandSettings).where(BrandSettings.user_id == user_id))
    if settings is None:
        defaults = _read_default()
        settings = BrandSettings(
            user_id=user_id,
            name=str(defaults.get("name") or "Auto-Reel Studio")[:255],
            tagline=str(defaults.get("tagline") or "")[:500],
            primary_color=defaults.get("primary_color") or "#000000",
            secondary_color=defaults.get("secondary_color") or "#FFFFFF",
            text_color=defaults.get("text_color") or "#FFFFFF",
            options={"logo_placement": defaults.get("logo_placement", "start")},
        )
        try:
            db.add(settings)
            db.commit()
            db.refresh(settings)
        except IntegrityError:
            db.rollback()
            settings = db.scalar(select(BrandSettings).where(BrandSettings.user_id == user_id))
            if settings is None:
                raise
    return settings


def update_brand_settings(db: Session, user_id: int, **values) -> BrandSettings:
    settings = get_or_create_brand_settings(db, user_id)
    for key in ("name", "tagline", "primary_color", "secondary_color", "text_color", "options"):
        if key in values and values[key] is not None:
            setattr(settings, key, values[key])
    db.commit()
    db.refresh(settings)
    return settings


def brand_config_for_user(db: Session, user_id: int) -> BrandConfig:
    settings = get_or_create_brand_settings(db, user_id)
    return BrandConfig(
        name=settings.name,
        tagline=settings.tagline,
        logo=settings.logo_storage_path,
        primary_color=settings.primary_color,
        secondary_color=settings.secondary_color,
        text_color=settings.text_color,
    )


def get_brand_config() -> BrandConfig:
    """Built-in public default, retained for unauthenticated landing pages."""
    try:
        return BrandConfig(**_read_default())
    except Exception:
        return _FALLBACK


def get_brand_name() -> str:
    return get_brand_config().name


def get_brand_logo_path() -> Path | None:
    data = _read_default()
    filename = data.get("logo")
    if not isinstance(filename, str) or Path(filename).name != filename:
        return None
    candidate = (BRANDING_DIR / filename).resolve()
    if candidate.is_relative_to(BRANDING_DIR.resolve()) and candidate.is_file():
        return candidate
    return None


def get_logo_placement(settings: BrandSettings | None = None) -> str:
    placement = (settings.options or {}).get("logo_placement") if settings else _read_default().get("logo_placement")
    return placement if placement in {"start", "entire"} else "start"


def set_logo_placement(db: Session, user_id: int, placement: str) -> BrandSettings:
    if placement not in {"start", "entire"}:
        raise ValueError("Logo placement must be 'start' or 'entire'")
    settings = get_or_create_brand_settings(db, user_id)
    settings.options = {**(settings.options or {}), "logo_placement": placement}
    db.commit()
    db.refresh(settings)
    return settings


def validate_logo(file_bytes: bytes, extension: str) -> None:
    if extension.lower() not in _ALLOWED_LOGO_EXTENSIONS:
        raise ValueError("Unsupported logo extension")
    try:
        with Image.open(io.BytesIO(file_bytes)) as image:
            image.verify()
        with Image.open(io.BytesIO(file_bytes)) as image:
            if image.width * image.height > 25_000_000:
                raise ValueError("Logo dimensions exceed maximum allowable size")
    except Exception as exc:
        raise ValueError("Invalid image file content") from exc


def save_user_logo(db: Session, user_id: int, file_bytes: bytes, extension: str,
                   placement: str) -> str:
    if placement not in {"start", "entire"}:
        raise ValueError("Logo placement must be 'start' or 'entire'")
    validate_logo(file_bytes, extension)
    settings = get_or_create_brand_settings(db, user_id)
    object_path = f"{user_id}/{uuid.uuid4().hex}{extension.lower()}"
    mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}[extension.lower()]
    _storage_request("POST", object_path, file_bytes, mime)
    old_path = settings.logo_storage_path
    settings.logo_storage_path = object_path
    settings.options = {**(settings.options or {}), "logo_placement": placement}
    try:
        db.commit()
        db.refresh(settings)
    except Exception:
        db.rollback()
        try:
            _storage_request("DELETE", object_path)
        except Exception:
            pass
        raise
    if old_path and old_path.startswith(f"{user_id}/"):
        try:
            _storage_request("DELETE", old_path)
        except Exception:
            pass
    return object_path


def get_user_logo(db: Session, user_id: int) -> tuple[bytes, str] | None:
    settings = db.scalar(select(BrandSettings).where(BrandSettings.user_id == user_id))
    if settings is None or not settings.logo_storage_path:
        return None
    path = settings.logo_storage_path
    parts = PurePosixPath(path).parts
    if len(parts) != 2 or parts[0] != str(user_id) or parts[1] in {"", ".", ".."}:
        return None
    data = _storage_request("GET", path)
    extension = Path(path).suffix.lower()
    media_type = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}.get(extension, "application/octet-stream")
    return data, media_type


def delete_user_logo(db: Session, user_id: int) -> None:
    settings = db.scalar(select(BrandSettings).where(BrandSettings.user_id == user_id))
    if settings is None or not settings.logo_storage_path:
        return
    path = settings.logo_storage_path
    parts = PurePosixPath(path).parts
    if len(parts) != 2 or parts[0] != str(user_id) or parts[1] in {"", ".", ".."}:
        raise ValueError("Logo ownership validation failed")
    settings.logo_storage_path = None
    db.commit()
    try:
        _storage_request("DELETE", path)
    except Exception:
        # The database no longer references the private object; an orphaned
        # object is safer than a broken logo reference and can be cleaned up.
        pass


def download_user_logo(db: Session, user_id: int, destination: Path) -> Path | None:
    logo = get_user_logo(db, user_id)
    if logo is None:
        return None
    destination.write_bytes(logo[0])
    return destination
