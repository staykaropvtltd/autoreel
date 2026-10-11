
"""Brand configuration and logo storage.

Built-in branding remains read-only under assets/branding/.
Runtime branding edits are stored under storage/branding/.

Note: this is shared demo branding until authenticated per-user storage
is integrated.
"""

import json
from pathlib import Path

from app.schemas.branding import BrandConfig

PROJECT_ROOT = Path(__file__).resolve().parents[3]

BRANDING_DIR = PROJECT_ROOT / "assets" / "branding"
BRAND_CONFIG_PATH = BRANDING_DIR / "brand.json"

USER_BRANDING_DIR = PROJECT_ROOT / "storage" / "branding"
USER_BRAND_CONFIG_PATH = USER_BRANDING_DIR / "brand.json"

_FALLBACK = BrandConfig(name="Auto-Reel Studio")
_ALLOWED_LOGO_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg"}


def _read_json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _write_user_config(data: dict) -> None:
    USER_BRANDING_DIR.mkdir(parents=True, exist_ok=True)
    temp_path = USER_BRAND_CONFIG_PATH.with_suffix(".tmp")
    temp_path.write_text(
        json.dumps(data, indent=2),
        encoding="utf-8",
    )
    temp_path.replace(USER_BRAND_CONFIG_PATH)


def get_brand_config() -> BrandConfig:
    """Read editable runtime branding first, then fall back to built-in branding."""
    user_config = _read_json(USER_BRAND_CONFIG_PATH)
    default_config = _read_json(BRAND_CONFIG_PATH)

    merged = {**default_config, **user_config}

    try:
        return BrandConfig(**merged)
    except Exception:
        try:
            return BrandConfig(**default_config)
        except Exception:
            return _FALLBACK


def get_brand_name() -> str:
    return get_brand_config().name


def get_brand_logo_path() -> Path | None:
    """Resolve the runtime logo first, then the configured built-in logo."""
    if USER_BRANDING_DIR.exists():
        for candidate in sorted(USER_BRANDING_DIR.glob("logo.*")):
            if (
                candidate.is_file()
                and candidate.suffix.lower() in _ALLOWED_LOGO_EXTENSIONS
            ):
                return candidate

    config = get_brand_config()
    if config.logo:
        filename = Path(config.logo).name

        # Only accept a filename, never a path supplied in the config.
        if filename == config.logo and Path(filename).suffix.lower() in _ALLOWED_LOGO_EXTENSIONS:
            default_logo = BRANDING_DIR / filename
            if default_logo.is_file():
                return default_logo

    if BRANDING_DIR.exists():
        for candidate in sorted(BRANDING_DIR.glob("logo.*")):
            if (
                candidate.is_file()
                and candidate.suffix.lower() in _ALLOWED_LOGO_EXTENSIONS
            ):
                return candidate

    return None


def save_user_logo(file_bytes: bytes, extension: str, placement: str) -> Path:
    if placement not in {"start", "entire"}:
        raise ValueError("Logo placement must be 'start' or 'entire'")

    extension = extension.lower()
    if extension not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise ValueError("Unsupported logo extension")

    USER_BRANDING_DIR.mkdir(parents=True, exist_ok=True)
    logo_path = USER_BRANDING_DIR / f"logo{extension}"

    # Write the new logo before removing older runtime logo variants.
    temp_path = USER_BRANDING_DIR / f"logo_upload_tmp{extension}"
    temp_path.write_bytes(file_bytes)
    temp_path.replace(logo_path)

    for existing in USER_BRANDING_DIR.glob("logo.*"):
        if existing != logo_path and existing.is_file():
            existing.unlink(missing_ok=True)

    config = _read_json(USER_BRAND_CONFIG_PATH)
    config["logo"] = logo_path.name
    config["logo_placement"] = placement
    _write_user_config(config)

    return logo_path


def get_logo_placement() -> str:
    user_config = _read_json(USER_BRAND_CONFIG_PATH)
    placement = user_config.get("logo_placement")

    if placement not in {"start", "entire"}:
        placement = _read_json(BRAND_CONFIG_PATH).get("logo_placement", "start")

    return placement if placement in {"start", "entire"} else "start"


def set_logo_placement(placement: str) -> None:
    if placement not in {"start", "entire"}:
        raise ValueError("Logo placement must be 'start' or 'entire'")

    config = _read_json(USER_BRAND_CONFIG_PATH)
    config["logo_placement"] = placement
    _write_user_config(config)
