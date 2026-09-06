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
    """Resolves the configured logo file, always within BRANDING_DIR - the
    "logo" field is only ever treated as a bare filename (any directory
    component is stripped), so nothing in brand.json can point outside the
    branding directory. Returns None if no logo is configured, or the
    configured file doesn't actually exist (degrade gracefully rather than
    error - callers already handle a missing logo by falling back to
    text-only branding).
    """
    config = get_brand_config()
    if not config.logo:
        return None

    filename = Path(config.logo).name  # strips any path component
    if not filename:
        return None

    candidate = BRANDING_DIR / filename
    return candidate if candidate.exists() else None
