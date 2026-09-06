from enum import Enum

from pydantic import BaseModel

from app.schemas.batch import BatchClip


class ShotRole(str, Enum):
    HERO = "HERO"
    FULL_VIEW = "FULL_VIEW"
    MOVEMENT = "MOVEMENT"
    DETAIL = "DETAIL"
    SIDE_VIEW = "SIDE_VIEW"
    PRODUCT_SHOWCASE = "PRODUCT_SHOWCASE"
    ENDING = "ENDING"
    UNKNOWN = "UNKNOWN"


class ClassifiedClip(BaseModel):
    """A BatchClip (Phase 4) with a deterministic, rule-based shot-role
    label attached. Not a learned/AI classifier - see shot_classifier.py.
    """

    clip: BatchClip
    shot_role: ShotRole
    role_confidence: float


class TransitionType(str, Enum):
    NONE = "none"
    FADE = "fade"
    ZOOM_IN = "zoom_in"
    ZOOM_OUT = "zoom_out"
    SLIDE_LEFT = "slide_left"
    SLIDE_RIGHT = "slide_right"


# Transitions that visually overlap the tail of the previous clip with the
# head of this one (implemented via ffmpeg xfade/acrossfade), and therefore
# shorten the combined timeline by their duration. Zoom transitions are an
# in-place animation on the incoming clip's own footage - they don't touch
# the previous clip at all, so they add no overlap.
CROSSFADE_TRANSITION_TYPES = {TransitionType.FADE, TransitionType.SLIDE_LEFT, TransitionType.SLIDE_RIGHT}
ZOOM_TRANSITION_TYPES = {TransitionType.ZOOM_IN, TransitionType.ZOOM_OUT}


class TransitionConfig(BaseModel):
    """Belongs to the INCOMING clip (the one this transition leads into)."""

    type: TransitionType = TransitionType.NONE
    duration: float = 0.0


class PlannedReelClip(BaseModel):
    position: int
    source_file: str
    original_start: float
    original_end: float
    planned_start: float
    planned_end: float
    planned_duration: float
    score: int
    shot_role: ShotRole
    role_confidence: float
    transition_in: TransitionConfig = TransitionConfig()
    thumbnail_url: str | None = None


class BrandingConfig(BaseModel):
    # Not a real client name - a safe, generic placeholder. The actual brand
    # identity always comes from the central config (assets/branding/
    # brand.json, via app.services.brand_service) at plan-creation and
    # render time; this default only covers a BrandingConfig constructed
    # directly (e.g. in a test) without going through either of those.
    brand_name: str = "Auto-Reel Studio"
    brand_color: str | None = None  # e.g. "#c9a227" - used sparingly as an accent, never a full-screen overlay
    logo_path: str | None = None
    logo_position: str = "top_left"  # top_left | top_right | bottom_left | bottom_right
    logo_size: int = 120  # pixel width; height scales proportionally
    show_logo_at_start: bool = True
    show_logo_at_end: bool = False
    show_watermark: bool = False
    intro_duration: float = 2.0


class ProductOverlayInfo(BaseModel):
    product_name: str | None = None
    material: str | None = None
    color: str | None = None
    product_code: str | None = None
    price: str | None = None
    category: str | None = None


class FontConfig(BaseModel):
    """Typography for overlays. font_family is a path to a font file; if it
    doesn't exist at render time, the renderer falls back to a bundled
    system font rather than failing.
    """

    font_family: str | None = None
    headline_size: int = 42
    body_size: int = 32
    price_size: int = 38
    font_weight: str = "normal"  # normal | bold (best-effort; ignored if unsupported)
    text_color: str = "white"
    accent_color: str | None = None


class MusicSelection(BaseModel):
    """Phase 9: background music, fitted to the Reel's final duration.
    volume is 0.0-1.0. loop_if_needed allows a shorter track to be looped
    cleanly to cover the full duration instead of leaving silence.
    """

    track_id: str
    track_name: str
    source_path: str
    source_duration: float
    start_time: float = 0.0
    end_time: float | None = None
    volume: float = 0.7
    loop_if_needed: bool = True
    preserve_original_audio: bool = False


# Placement string values (kept as plain strings rather than a shared enum
# since each field has a different valid set - see Phase 8 spec section 12):
#   brand_placement:    beginning | end | beginning_and_end | watermark | none
#   product_placement:  beginning | end | none
#   material_placement: selected_clip | detail_clip | beginning | end | none
#   price_placement:    final_clip | end | beginning | none
class OverlayConfig(BaseModel):
    brand_placement: str = "beginning"
    product_placement: str = "beginning"
    material_placement: str = "none"
    material_clip_position: int | None = None
    price_placement: str = "none"
    material_duration: float = 2.0
    price_duration: float = 2.5


class ReelPlan(BaseModel):
    target_duration: float
    estimated_duration: float
    duration_difference: float
    clips: list[PlannedReelClip]
    processing_time_seconds: float

    # Phase 8 additions - the ReelPlan is the single source of truth for the
    # editor, so branding/product/overlay configuration and transition-aware
    # duration accounting live here too.
    branding: BrandingConfig = BrandingConfig()
    product: ProductOverlayInfo = ProductOverlayInfo()
    overlays: OverlayConfig = OverlayConfig()
    font: FontConfig = FontConfig()
    content_duration: float = 0.0
    transition_overlap_duration: float = 0.0
    estimated_final_duration: float = 0.0

    # Phase 9 additions
    music: MusicSelection | None = None
    duration_status: str = "ok"  # "ok" | "insufficient_content"

    # Phase 9 (branding revision) additions: reserved, real branded bumper
    # segments prepended/appended to the render - NOT the same thing as
    # branding.intro_duration above (which times a text/logo overlay drawn
    # ON TOP of the first content clip). Default 0.0 so every ReelPlan built
    # by hand in existing code/tests is unaffected; plan_reel() is the only
    # place that sets these to real values for actual generated Reels.
    intro_seconds: float = 0.0
    outro_seconds: float = 0.0
