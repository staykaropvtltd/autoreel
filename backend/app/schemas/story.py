from enum import Enum
from typing import Literal
import uuid
import re

from pydantic import BaseModel, Field, field_validator

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
    duration: float = Field(
        default=0.0,
        ge=0.0,
        le=5.0,
        allow_inf_nan=False,
    )


class PlannedReelClip(BaseModel):
    clip_id: uuid.UUID | None = None
    position: int = Field(
        ge=1,
        le=1000,
    )

    source_file: str = Field(
        min_length=1,
        max_length=255,
    )

    original_start: float = Field(
        ge=0.0,
        le=86400.0,
        allow_inf_nan=False,
    )

    original_end: float = Field(
        ge=0.0,
        le=86400.0,
        allow_inf_nan=False,
    )

    planned_start: float = Field(
        ge=0.0,
        le=86400.0,
        allow_inf_nan=False,
    )

    planned_end: float = Field(
        ge=0.0,
        le=86400.0,
        allow_inf_nan=False,
    )

    planned_duration: float = Field(
        gt=0.0,
        le=60.0,
        allow_inf_nan=False,
    )

    score: int = Field(
        ge=0,
        le=100,
    )

    shot_role: ShotRole

    role_confidence: float = Field(
        ge=0.0,
        le=1.0,
        allow_inf_nan=False,
    )

    transition_in: TransitionConfig = Field(
        default_factory=TransitionConfig
    )

    thumbnail_url: str | None = Field(
        default=None,
        max_length=2048,
    )


class BrandingConfig(BaseModel):
    # Safe, generic placeholder.
    brand_name: str = Field(
        default="Auto-Reel Studio",
        min_length=1,
        max_length=100,
    )

    brand_color: str | None = Field(
        default=None,
        max_length=20,
    )

    logo_path: str | None = Field(
        default=None,
        max_length=2048,
    )

    logo_position: Literal[
        "top_left",
        "top_right",
        "bottom_left",
        "bottom_right",
    ] = "top_left"

    logo_size: int = Field(
        default=120,
        ge=40,
        le=500,
    )

    show_logo_at_start: bool = True
    show_logo_at_end: bool = False
    show_watermark: bool = False

    intro_duration: float = Field(
        default=2.0,
        ge=0.0,
        le=10.0,
        allow_inf_nan=False,
    )

    @field_validator("brand_color")
    @classmethod
    def validate_brand_color(cls, value: str | None) -> str | None:
        if value is None:
            return None

        allowed_colors = {
            "white",
            "black",
            "red",
            "green",
            "blue",
            "yellow",
            "orange",
            "purple",
            "pink",
            "gray",
            "grey",
        }

        if value.lower() in allowed_colors:
            return value.lower()

        if re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
            return value

        raise ValueError("Invalid brand color")


class ProductOverlayInfo(BaseModel):
    product_name: str | None = Field(default=None, max_length=200)
    material: str | None = Field(default=None, max_length=100)
    color: str | None = Field(default=None, max_length=100)
    product_code: str | None = Field(default=None, max_length=100)
    price: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=100)


class FontConfig(BaseModel):
    """Typography for overlays."""

    font_family: str | None = Field(
        default=None,
        max_length=2048,
    )

    headline_size: int = Field(
        default=42,
        ge=12,
        le=200,
    )

    body_size: int = Field(
        default=32,
        ge=12,
        le=200,
    )

    price_size: int = Field(
        default=38,
        ge=12,
        le=200,
    )

    font_weight: Literal[
        "normal",
        "bold",
    ] = "normal"

    text_color: str = Field(
        default="white",
        max_length=20,
    )

    accent_color: str | None = Field(
        default=None,
        max_length=20,
    )

    @field_validator("text_color", "accent_color")
    @classmethod
    def validate_font_color(cls, value: str | None) -> str | None:
        if value is None:
            return None

        allowed_colors = {
            "white",
            "black",
            "red",
            "green",
            "blue",
            "yellow",
            "orange",
            "purple",
            "pink",
            "gray",
            "grey",
        }

        if value.lower() in allowed_colors:
            return value.lower()

        if re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
            return value

        raise ValueError("Invalid font color")


class MusicSelection(BaseModel):
    """Background music fitted to the Reel's final duration."""

    track_id: str = Field(
        min_length=1,
        max_length=100,
    )

    track_name: str = Field(
        min_length=1,
        max_length=200,
    )

    source_path: str = Field(
        min_length=1,
        max_length=2048,
    )

    source_duration: float = Field(
        gt=0.0,
        le=86400.0,
        allow_inf_nan=False,
    )

    start_time: float = Field(
        default=0.0,
        ge=0.0,
        le=86400.0,
        allow_inf_nan=False,
    )

    end_time: float | None = Field(
        default=None,
        ge=0.0,
        le=86400.0,
        allow_inf_nan=False,
    )

    volume: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        allow_inf_nan=False,
    )

    loop_if_needed: bool = True
    preserve_original_audio: bool = False


# Placement string values (kept as plain strings rather than a shared enum
# since each field has a different valid set - see Phase 8 spec section 12):
#   brand_placement:    beginning | end | beginning_and_end | watermark | none
#   product_placement:  beginning | end | none
#   material_placement: selected_clip | detail_clip | beginning | end | none
#   price_placement:    final_clip | end | beginning | none
class OverlayConfig(BaseModel):
    brand_placement: Literal[
        "beginning",
        "end",
        "beginning_and_end",
        "watermark",
        "none",
    ] = "beginning"

    product_placement: Literal[
        "beginning",
        "end",
        "none",
    ] = "beginning"

    material_placement: Literal[
        "selected_clip",
        "detail_clip",
        "beginning",
        "end",
        "none",
    ] = "none"

    material_clip_position: int | None = Field(
        default=None,
        ge=1,
        le=1000,
    )

    price_placement: Literal[
        "final_clip",
        "end",
        "beginning",
        "none",
    ] = "none"

    material_duration: float = Field(
        default=2.0,
        gt=0.0,
        le=10.0,
        allow_inf_nan=False,
    )

    price_duration: float = Field(
        default=2.5,
        gt=0.0,
        le=10.0,
        allow_inf_nan=False,
    )


class ReelPlan(BaseModel):
    target_duration: float = Field(
        gt=0.0,
        le=300.0,
        allow_inf_nan=False,
        description=(
            "Requested whole-file duration, including template, intro, "
            "product content, outro, and the complete end card."
        ),
    )

    estimated_duration: float = Field(
        ge=0.0,
        le=300.0,
        allow_inf_nan=False,
        description="Estimated product-content duration only.",
    )

    duration_difference: float = Field(
        ge=-300.0,
        le=300.0,
        allow_inf_nan=False,
    )

    clips: list[PlannedReelClip] = Field(
        max_length=100,
    )

    processing_time_seconds: float = Field(
        ge=0.0,
        le=86400.0,
        allow_inf_nan=False,
    )

    branding: BrandingConfig = Field(
        default_factory=BrandingConfig
    )

    product: ProductOverlayInfo = Field(
        default_factory=ProductOverlayInfo
    )

    overlays: OverlayConfig = Field(
        default_factory=OverlayConfig
    )

    font: FontConfig = Field(
        default_factory=FontConfig
    )

    content_duration: float = Field(
        default=0.0,
        ge=0.0,
        le=300.0,
        allow_inf_nan=False,
    )

    transition_overlap_duration: float = Field(
        default=0.0,
        ge=0.0,
        le=300.0,
        allow_inf_nan=False,
    )

    estimated_final_duration: float = Field(
        default=0.0,
        ge=0.0,
        le=300.0,
        allow_inf_nan=False,
        description="Estimated duration of the complete rendered file.",
    )

    template_seconds: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        allow_inf_nan=False,
        description="Duration of the selected template segment in the final file.",
    )
    end_card_seconds: float = Field(
        default=5.0,
        ge=5.0,
        le=5.0,
        allow_inf_nan=False,
        description="The full product end-card duration; fixed at five seconds.",
    )

    music: MusicSelection | None = None

    duration_status: Literal[
        "ok",
        "insufficient_content",
    ] = "ok"

    intro_seconds: float = Field(
        default=0.0,
        ge=0.0,
        le=30.0,
        allow_inf_nan=False,
    )

    outro_seconds: float = Field(
        default=0.0,
        ge=0.0,
        le=30.0,
        allow_inf_nan=False,
    )
