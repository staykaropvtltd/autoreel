"""Single source of truth for the application's brand identity.

Everything that displays a brand name/logo - the website header, the Reel's
generated intro/outro, its persistent watermark, and brand text overlays -
reads from assets/branding/brand.json through this module, rather than any
of them hard-coding a client's name. Switching brands (a new logo file, a
new name in brand.json) requires no source-code change anywhere.

The config is re-read from disk on every call rather than cached: the file
is tiny, and it means an edit to brand.json takes effect on the next
request/render without needing a server restart.
"""

import json
from pathlib import Path

from app.schemas.branding import BrandConfig

# Resolved from this file's location (not the process cwd or any
# developer-specific path), so this works unchanged on any machine.
PROJECT_ROOT = Path(__file__).resolve().parents[3]
BRANDING_DIR = PROJECT_ROOT / "assets" / "branding"
BRAND_CONFIG_PATH = BRANDING_DIR / "brand.json"
USER_BRANDING_DIR = PROJECT_ROOT / "storage" / "branding"
USER_LOGO_PATH = USER_BRANDING_DIR / "logo.png"

# Used only when brand.json is missing or unreadable - the application must
# never crash or show a blank identity just because branding isn't
# configured yet.
_FALLBACK = BrandConfig(name="Auto-Reel Studio")


def get_brand_config() -> BrandConfig:
    try:
        raw = json.loads(BRAND_CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return _FALLBACK

    try:
        return BrandConfig(**raw)
    except Exception:
        return _FALLBACK


def get_brand_name() -> str:
    return get_brand_config().name


def get_brand_logo_path() -> Path | None:
    """
    Resolves the configured branding logo.

    User-uploaded logos are stored in storage/branding/.
    Existing application logos remain supported from assets/branding/.
    """

    # First check user-uploaded branding directory
    if USER_BRANDING_DIR.exists():
        for candidate in sorted(USER_BRANDING_DIR.glob("logo.*")):
            if candidate.is_file() and candidate.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".svg"}:
                return candidate

    config = get_brand_config()

    if config.logo:
        filename = Path(config.logo).name
        # Check user branding with exact filename
        user_logo = USER_BRANDING_DIR / filename
        if user_logo.exists():
            return user_logo
        # Check default branding with exact filename
        default_logo = BRANDING_DIR / filename
        if default_logo.exists():
            return default_logo
        # Check default branding matching stem (e.g. logo.jpeg vs logo.jpg)
        stem = Path(filename).stem
        for candidate in sorted(BRANDING_DIR.glob(f"{stem}.*")):
            if candidate.is_file() and candidate.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".svg"}:
                return candidate

    # Fall back to any logo file in BRANDING_DIR
    if BRANDING_DIR.exists():
        for candidate in sorted(BRANDING_DIR.glob("logo.*")):
            if candidate.is_file() and candidate.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".svg"}:
                return candidate

    return None
def save_user_logo(
    file_bytes: bytes,
    extension: str,
    placement: str,
) -> Path:
    """
    Saves the user's uploaded logo and records its placement.

    placement:
        start  -> logo appears at the beginning of the reel
        entire -> logo appears throughout the reel
    """

    if placement not in {"start", "entire"}:
        raise ValueError(
            "Logo placement must be 'start' or 'entire'"
        )

    USER_BRANDING_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    # Always use a controlled filename.
    logo_path = USER_BRANDING_DIR / f"logo{extension}"

    # Remove previous uploaded logo files.
    for existing in USER_BRANDING_DIR.glob("logo.*"):
        if existing != logo_path:
            existing.unlink(missing_ok=True)

    logo_path.write_bytes(file_bytes)

    # Store the uploaded logo and placement in brand.json.
    BRANDING_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    try:
        raw = json.loads(
            BRAND_CONFIG_PATH.read_text(
                encoding="utf-8"
            )
        )
    except (OSError, ValueError):
        raw = {}

    raw["logo"] = logo_path.name
    raw["logo_placement"] = placement

    BRAND_CONFIG_PATH.write_text(
        json.dumps(
            raw,
            indent=2,
        ),
        encoding="utf-8",
    )

    return logo_path


def get_logo_placement() -> str:
    """
    Returns the configured logo placement.

    Defaults to 'start'.
    """

    try:
        raw = json.loads(
            BRAND_CONFIG_PATH.read_text(
                encoding="utf-8"
            )
        )
    except (OSError, ValueError):
        return "start"

    placement = raw.get(
        "logo_placement",
        "start",
    )

    if placement not in {"start", "entire"}:
        return "start"

    return placement
def set_logo_placement(placement: str) -> None:
    """Updates only the saved logo placement."""

    if placement not in {"start", "entire"}:
        raise ValueError(
            "Logo placement must be 'start' or 'entire'"
        )

    try:
        raw = json.loads(
            BRAND_CONFIG_PATH.read_text(
                encoding="utf-8"
            )
        )
    except (OSError, ValueError):
        raw = {}

    raw["logo_placement"] = placement

    BRAND_CONFIG_PATH.write_text(
        json.dumps(
            raw,
            indent=2,
        ),
        encoding="utf-8",
    )
