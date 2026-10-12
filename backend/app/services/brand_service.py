
"""Brand configuration and logo storage.

Built-in branding remains read-only under assets/branding/.
Runtime branding edits are stored under storage/branding/.

Note: this is shared demo branding until authenticated per-user storage
is integrated.
"""

import io
import json
import threading
from pathlib import Path
from PIL import Image

from app.schemas.branding import BrandConfig

PROJECT_ROOT = Path(__file__).resolve().parents[3]

BRANDING_DIR = PROJECT_ROOT / "assets" / "branding"
BRAND_CONFIG_PATH = BRANDING_DIR / "brand.json"

USER_BRANDING_DIR = PROJECT_ROOT / "storage" / "branding"
USER_BRAND_CONFIG_PATH = USER_BRANDING_DIR / "brand.json"

_FALLBACK = BrandConfig(name="Auto-Reel Studio")
_ALLOWED_LOGO_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
_brand_lock = threading.Lock()


def _read_json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _write_user_config(data: dict) -> None:
    with _brand_lock:
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

    def resolve_logo(root: Path, filename: str | None) -> Path | None:
        if not isinstance(filename, str) or not filename or Path(filename).name != filename:
            return None
        if Path(filename).suffix.lower() not in _ALLOWED_LOGO_EXTENSIONS:
            return None

        resolved_root = root.resolve()
        candidate = (root / filename).resolve()
        if candidate.is_relative_to(resolved_root) and candidate.is_file():
            return candidate
        return None

    user_config = _read_json(USER_BRAND_CONFIG_PATH)
    configured_user_logo = resolve_logo(
        USER_BRANDING_DIR,
        user_config.get("logo"),
    )
    if configured_user_logo is not None:
        return configured_user_logo

    if USER_BRANDING_DIR.exists():
        for candidate in sorted(USER_BRANDING_DIR.glob("logo.*")):
            resolved = resolve_logo(USER_BRANDING_DIR, candidate.name)
            if resolved is not None:
                return resolved

    default_config = _read_json(BRAND_CONFIG_PATH)
    configured_default_logo = resolve_logo(
        BRANDING_DIR,
        default_config.get("logo"),
    )
    if configured_default_logo is not None:
        return configured_default_logo

    if BRANDING_DIR.exists():
        for candidate in sorted(BRANDING_DIR.glob("logo.*")):
            resolved = resolve_logo(BRANDING_DIR, candidate.name)
            if resolved is not None:
                return resolved

    return None



def save_user_logo(file_bytes: bytes, extension: str, placement: str) -> Path:
    if placement not in {"start", "entire"}:
        raise ValueError("Logo placement must be 'start' or 'entire'")

    extension = extension.lower()
    if extension not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise ValueError("Unsupported logo extension")

    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            img.verify()
        with Image.open(io.BytesIO(file_bytes)) as img:
            width, height = img.size
            if width * height > 25_000_000:
                raise ValueError("Logo dimensions exceed maximum allowable size")
    except Exception as exc:
        raise ValueError("Invalid image file content") from exc

    with _brand_lock:
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

    # Write the configuration after releasing the lock to avoid deadlock.
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
