import uuid
import os
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.core.storage import OUTPUTS_DIR
from uuid import uuid4
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal
from app.services.music_service import resolve_music_track

from app.services.credit_service import (
    get_balance,
    deduct_credits,
    refund_credits,
    REEL_GENERATION_COST,
)

from app.core.job_store import (
    create_reel_job,
    get_reel_job_by_request_id,
    get_analysis_job,
    get_reel_job,
    get_template_image,
    update_reel_job,
)
from app.core.security import safe_filename
from app.schemas.batch import BatchClip, SelectionStatus
from app.schemas.reel import (
    ReelGenerateResponse,
    ReelJobAcceptedResponse,
    ReelJobStatusResponse,
    ReelResult,
)
from app.schemas.story import ReelPlan
from app.services.ffmpeg_service import (
    FFmpegNotAvailableError,
    FFmpegProcessingError,
    set_render_deadline,
)
from app.services.reel_composer import (
    BrandConfig,
    EmptySelectionError,
    InvalidTimestampError,
    MissingSourceVideoError,
    ProductInfo,
    ReelCompositionConfig,
    compose_reel,
)
from app.services.clip_identity import clips_by_id, ensure_analysis_clip_ids
from app.services.brand_service import (
    get_brand_config,
    get_brand_logo_path,
    get_brand_name,
)
from app.services.reel_editor_renderer import compose_reel_from_editor_plan
from app.services.product_end_card import END_CARD_DURATION
from app.services.reel_duration import get_template_duration_seconds
from app.services.reel_planner import (
    DEFAULT_MIN_CLIP_DURATION,
    PlanningConfig,
    extend_plan_for_transitions,
    plan_reel,
)
import logging
from threading import BoundedSemaphore
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)
from app.services.thumbnail_service import attach_thumbnails
from app.services.video_processor import OutputValidationError



THUMBNAIL_CACHE_DIR = (
    Path(__file__).resolve().parents[3]
    / "storage"
    / "temp"
    / "thumbnails"
)

router = APIRouter()

# Resolved from this file's location (not the process cwd) so the API works
# the same whether uvicorn/pytest is launched from the repo root or backend/.
_PROJECT_ROOT = Path(__file__).resolve().parents[3]

RAW_UPLOADS_DIR = _PROJECT_ROOT / "storage" / "uploads" / "templates"
TEMPLATE_IMAGES_DIR = _PROJECT_ROOT / "storage" / "templates"
OUTPUTS_DIR = _PROJECT_ROOT / "storage" / "outputs"
MUSIC_DIR = _PROJECT_ROOT / "assets" / "music"
CUSTOM_MUSIC_DIR = _PROJECT_ROOT / "storage" / "music"

MUSIC_LIBRARIES = [
    (MUSIC_DIR, False),
    (CUSTOM_MUSIC_DIR, True),
]

# Temporary user ID until authentication is implemented
DEMO_USER_ID = "user_demo"
_REEL_SLOTS = BoundedSemaphore(2)
_REEL_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="reel-render")
try:
    _REEL_JOB_TIMEOUT_SECONDS = max(1, int(os.getenv("AUTOREEL_REEL_TIMEOUT_SECONDS", "7200")))
except ValueError:
    _REEL_JOB_TIMEOUT_SECONDS = 7200


class BrandRequest(BaseModel):
    text: str | None = Field(
        default_factory=get_brand_name,
        max_length=100,
    )
    font_size: int = Field(
        default=42,
        ge=12,
        le=120,
    )
    font_color: str = Field(
        default="#FFFFFF",
        pattern=r"^#[0-9A-Fa-f]{6}$",
    )
    position: Literal["top", "bottom"] = "bottom"


class ProductInfoRequest(BaseModel):
    product_name: str | None = None
    product_code: str | None = None
    price: str | None = None
    category: str | None = None


class GenerateReelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    selected_clips: list[BatchClip] = Field(default=[], max_length=100)
    reel_plan: ReelPlan | None = None
    selected_clip_ids: list[uuid.UUID] | None = Field(default=None, max_length=100)
    output_filename: str | None = Field(default=None, max_length=255)
    analysis_job_id: uuid.UUID | None = None
    request_id: uuid.UUID | None = None
    min_total_duration: float = Field(default=10.0, gt=0.0, le=300.0, allow_inf_nan=False)
    max_total_duration: float = Field(default=15.0, gt=0.0, le=300.0, allow_inf_nan=False)
    transition: Literal["cut", "fade", "none", "zoom_in", "zoom_out", "slide_left", "slide_right"] = "cut"
    music_filename: str | None = Field(default=None, max_length=255)
    brand: BrandRequest = Field(default_factory=BrandRequest)
    product: ProductInfoRequest | None = None

    @field_validator("selected_clip_ids")
    @classmethod
    def reject_duplicate_generation_clip_ids(
        cls, value: list[uuid.UUID] | None
    ) -> list[uuid.UUID] | None:
        if value is not None and len(value) != len(set(value)):
            raise ValueError("selected_clip_ids must not contain duplicates")
        return value


class PlanReelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    analysis_job_id: uuid.UUID
    selected_clip_ids: list[uuid.UUID] | None = Field(default=None, max_length=100)
    target_duration: float = Field(
        default=15.0,
        ge=END_CARD_DURATION,
        le=300.0,
        allow_inf_nan=False,
        description="Requested total output duration including all rendered segments.",
    )
    min_clip_duration: float = Field(default=DEFAULT_MIN_CLIP_DURATION, gt=0.0, le=60.0, allow_inf_nan=False)
    max_clip_duration: float = Field(default=8.0, gt=0.0, le=60.0, allow_inf_nan=False)
    min_quality_score: float = Field(default=50.0, ge=0.0, le=100.0, allow_inf_nan=False)

    @field_validator("selected_clip_ids")
    @classmethod
    def reject_duplicate_clip_ids(
        cls, value: list[uuid.UUID] | None
    ) -> list[uuid.UUID] | None:
        if value is not None and len(value) != len(set(value)):
            raise ValueError("selected_clip_ids must not contain duplicates")
        return value


def _resolve_source_dir(analysis_job_id: str | None) -> Path:
    """Defaults to the flat RAW_UPLOADS_DIR (Phase 5 behavior) when no
    analysis_job_id is given. When one is given, resolves to wherever that
    job's source videos actually live (a per-upload job folder, or the demo
    footage directory) - set by app.api.analysis.start_analysis.
    """
    if not analysis_job_id:
        return RAW_UPLOADS_DIR

    analysis_job = get_analysis_job(analysis_job_id)

    if analysis_job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Analysis job not found: {analysis_job_id}",
        )

    return analysis_job["source_dir"]


def _resolve_template_image(analysis_job_id: str | None) -> Path | None:
    """Resolve the template image selected for an analysis job."""

    if not analysis_job_id:
        return None

    analysis_job = get_analysis_job(analysis_job_id)

    if analysis_job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Analysis job not found: {analysis_job_id}",
        )

    template_id = analysis_job.get("template_id")

    if not template_id:
        return None

    # Validate template_id before using it as a filesystem path.
    try:
        template_uuid = uuid.UUID(str(template_id))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid template_id",
        )

    # Resolve the path and make sure it stays inside storage/templates.
    templates_root = TEMPLATE_IMAGES_DIR.resolve()

    template_record = get_template_image(str(template_uuid))
    if template_record and template_record.get("path"):
        template_file = Path(template_record["path"]).resolve()
        if not template_file.is_relative_to(templates_root):
            raise HTTPException(
                status_code=400,
                detail="Invalid template path",
            )
        if template_file.exists() and template_file.is_file():
            return template_file

    template_dir = (
        TEMPLATE_IMAGES_DIR / str(template_uuid)
    ).resolve()

    if not template_dir.is_relative_to(templates_root):
        raise HTTPException(
            status_code=400,
            detail="Invalid template path",
        )

    if not template_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Template image not found: {template_id}",
        )

    allowed_extensions = {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    }

    template_files = [
        path
        for path in template_dir.iterdir()
        if path.is_file() and path.suffix.lower() in allowed_extensions
    ]

    if not template_files:
        raise HTTPException(
            status_code=404,
            detail=f"Template image file not found: {template_id}",
        )

    resolved_path = template_files[0].resolve()
    if not resolved_path.is_relative_to(templates_root):
        raise HTTPException(
            status_code=400,
            detail="Invalid template path",
        )

    return resolved_path


def _get_candidate_pool(
    analysis_job_id: str | None,
) -> list[BatchClip] | None:
    """Best-effort lookup of the analysis job's quality-passed candidate
    pool, used to top up a plan that would otherwise render short of its
    target duration (Phase 9 section 5). Returns None (not an error) when
    unavailable - the caller falls back to slack-only compensation.
    """
    if not analysis_job_id:
        return None

    analysis_job = get_analysis_job(analysis_job_id)

    if analysis_job is None or analysis_job.get("status") != "completed":
        return None

    batch_result = analysis_job["result"]
    candidate_pool = [
        clip
        for clip in batch_result.all_clips
        if clip.status
        in (
            SelectionStatus.SELECTED,
            SelectionStatus.REJECTED_NOT_SELECTED,
        )
    ]
    if not candidate_pool and batch_result.all_clips:
        candidate_pool = sorted(
            batch_result.all_clips,
            key=lambda c: c.score,
            reverse=True,
        )

    return candidate_pool

def _resolve_music_path(identifier: str | None) -> Path | None:
    if not identifier:
        return None

    track = resolve_music_track(identifier, MUSIC_LIBRARIES)

    if track is None:
        raise HTTPException(
            status_code=400,
            detail="Selected music track was not found",
        )

    path = Path(track["_path"]).resolve()

    allowed_roots = [
        MUSIC_DIR.resolve(),
        CUSTOM_MUSIC_DIR.resolve(),
    ]

    if not any(path.is_relative_to(root) for root in allowed_roots):
        logger.warning("Rejected music path outside allowed directories")
        raise HTTPException(
            status_code=400,
            detail="Invalid music file location",
        )

    if not path.is_file():
        logger.warning("Selected music file is missing: %s", path)
        raise HTTPException(
            status_code=400,
            detail="Selected music track was not found",
        )

    return path


@router.post("/reels/plan", response_model=ReelPlan)
def create_reel_plan(request: PlanReelRequest) -> ReelPlan:
    """Phase 7: builds a story-ordered, target-duration-aware ReelPlan from
    an analysis job's full candidate pool (Phase 4's quality-passed, deduped
    clips - not just its own max-clips-capped selection). Returned for the
    frontend to display/reorder/trim before generation.
    """

    analysis_job = get_analysis_job(str(request.analysis_job_id))

    if analysis_job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Analysis job not found: {request.analysis_job_id}",
        )

    if analysis_job.get("status") != "completed":
        raise HTTPException(
            status_code=400,
            detail="Analysis job has not completed yet",
        )

    batch_result = analysis_job["result"]
    ensure_analysis_clip_ids(str(request.analysis_job_id), batch_result)

    if request.selected_clip_ids is not None:
        if not request.selected_clip_ids:
            raise HTTPException(status_code=422, detail="Select at least one clip to create a reel plan")
        available_by_id = clips_by_id(batch_result.all_clips)
        missing_ids = [clip_id for clip_id in request.selected_clip_ids if clip_id not in available_by_id]
        if missing_ids:
            raise HTTPException(
                status_code=422,
                detail="One or more selected clip IDs do not belong to this analysis job. Refresh analysis and select the clips again.",
            )
        candidate_pool = [available_by_id[clip_id] for clip_id in request.selected_clip_ids]
    else:
        candidate_pool = [
            clip
            for clip in batch_result.all_clips
            if clip.status
            in (
                SelectionStatus.SELECTED,
                SelectionStatus.REJECTED_NOT_SELECTED,
            )
        ]
        if not candidate_pool and batch_result.all_clips:
            candidate_pool = sorted(
                batch_result.all_clips,
                key=lambda c: c.score,
                reverse=True,
            )

    template_image_path = _resolve_template_image(str(request.analysis_job_id))
    template_seconds = get_template_duration_seconds() if template_image_path is not None else 0.0
    if request.target_duration < template_seconds + END_CARD_DURATION:
        raise HTTPException(
            status_code=422,
            detail="Target duration must fit the selected template and full end card",
        )

    config = PlanningConfig(
        target_duration=request.target_duration,
        min_clip_duration=request.min_clip_duration,
        max_clip_duration=request.max_clip_duration,
        min_quality_score=(
            0.0 if request.selected_clip_ids is not None else request.min_quality_score
        ),
        template_duration=template_seconds,
    )

    reel_plan = plan_reel(candidate_pool, config)

    if request.selected_clip_ids is not None:
        planned_clip_ids = {clip.clip_id for clip in reel_plan.clips}
        if planned_clip_ids != set(request.selected_clip_ids):
            short_clips = [
                c for c in candidate_pool
                if c.duration < config.min_clip_duration
            ]
            if short_clips:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"One or more selected clips are shorter than the minimum clip duration "
                        f"({config.min_clip_duration}s). Choose clips that meet the duration requirement."
                    ),
                )
            raise HTTPException(
                status_code=422,
                detail="The selected clips do not fit the target duration. Choose fewer clips or increase the target duration.",
            )

    # The editor should already show the real, currently-configured brand
    # identity before the user touches anything - pulled fresh from
    # assets/branding/brand.json on every plan, never a hard-coded name/logo
    # (the render path re-applies this same config independently, so this
    # is purely about what the editor displays before that point).
    brand_config = get_brand_config()
    brand_logo_path = get_brand_logo_path()

    reel_plan = reel_plan.model_copy(
        update={
            "branding": reel_plan.branding.model_copy(
                update={
                    "brand_name": brand_config.name,
                    "logo_path": (
                        str(brand_logo_path)
                        if brand_logo_path
                        else None
                    ),
                }
            )
        }
    )

    # Keep a small, persistent brand watermark visible during the product
    # portion too (spec PART 3) - a subtler identity than the intro/outro's
    # full logo treatment. Only applied to a freshly generated plan; the
    # user can still turn it off in the editor.
    if reel_plan.overlays.brand_placement == "beginning":
        reel_plan = reel_plan.model_copy(
            update={
                "overlays": reel_plan.overlays.model_copy(
                    update={
                        "brand_placement": "watermark"
                    }
                )
            }
        )

    attach_thumbnails(
        reel_plan.clips,
        analysis_job["source_dir"],
        THUMBNAIL_CACHE_DIR,
    )

    return reel_plan


@router.post(
    "/reels/generate",
    response_model=ReelJobAcceptedResponse,
    status_code=202,
)
def generate_reel(
    request: GenerateReelRequest,
) -> ReelJobAcceptedResponse:
    if request.request_id is not None:
        existing_id = get_reel_job_by_request_id(str(request.request_id))
        if existing_id is not None:
            return ReelJobAcceptedResponse(reel_id=existing_id, status="queued")
    if not _REEL_SLOTS.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="Reel rendering is busy. Please try again shortly.")
    reel_id = str(uuid.uuid4())
    if not create_reel_job(reel_id, str(request.request_id) if request.request_id else None):
        _REEL_SLOTS.release()
        existing_id = get_reel_job_by_request_id(str(request.request_id))
        return ReelJobAcceptedResponse(reel_id=existing_id, status="queued")
    try:
        _REEL_EXECUTOR.submit(_run_reel_job, request, reel_id)
    except Exception as exc:
        update_reel_job(reel_id, status="failed", stage="failed", error="Reel rendering could not be queued.")
        _REEL_SLOTS.release()
        raise HTTPException(status_code=503, detail="Reel rendering is unavailable. Please try again.") from exc
    return ReelJobAcceptedResponse(reel_id=reel_id, status="queued")


def _run_reel_job(request: GenerateReelRequest, reel_id: str) -> None:
    try:
        set_render_deadline(time.monotonic() + _REEL_JOB_TIMEOUT_SECONDS)
        update_reel_job(reel_id, status="processing", stage="preparing")
        response = _generate_reel_blocking(request, reel_id)
        update_reel_job(
            reel_id,
            status="completed",
            stage="completed",
            response=response.model_dump(mode="json"),
            output_path=str(OUTPUTS_DIR / f"{reel_id}.mp4"),
        )
    except HTTPException as exc:
        (OUTPUTS_DIR / f"{reel_id}.mp4").unlink(missing_ok=True)
        update_reel_job(
            reel_id,
            status="failed",
            stage="failed",
            error=str(exc.detail),
        )
    except Exception:
        logger.exception("Background reel job failed: %s", reel_id)
        (OUTPUTS_DIR / f"{reel_id}.mp4").unlink(missing_ok=True)
        update_reel_job(
            reel_id,
            status="failed",
            stage="failed",
            error="Reel rendering failed. Please try again.",
        )
    finally:
        set_render_deadline(None)
        _REEL_SLOTS.release()


def _generate_reel_blocking(
    request: GenerateReelRequest,
    reel_id: str,
) -> ReelGenerateResponse:


    source_dir = _resolve_source_dir(
        str(request.analysis_job_id) if request.analysis_job_id else None
    )

    selected_generation_clips: list[BatchClip] | None = None
    if request.selected_clip_ids is not None:
        if not request.selected_clip_ids:
            raise HTTPException(status_code=422, detail="Select at least one clip to generate a reel")
        if request.reel_plan is None or request.analysis_job_id is None:
            raise HTTPException(status_code=422, detail="Selected clip IDs require a reel plan and analysis job")
        analysis_job = get_analysis_job(str(request.analysis_job_id))
        if analysis_job is None:
            raise HTTPException(status_code=404, detail="Analysis job not found")
        if analysis_job.get("status") != "completed":
            raise HTTPException(status_code=400, detail="Analysis job has not completed yet")
        batch_result = analysis_job["result"]
        ensure_analysis_clip_ids(str(request.analysis_job_id), batch_result)
        available_by_id = clips_by_id(batch_result.all_clips)
        if any(clip_id not in available_by_id for clip_id in request.selected_clip_ids):
            raise HTTPException(status_code=422, detail="One or more selected clip IDs do not belong to this analysis job")
        planned_ids = [clip.clip_id for clip in request.reel_plan.clips]
        if (
            any(clip_id is None for clip_id in planned_ids)
            or len(planned_ids) != len(set(planned_ids))
            or set(planned_ids) != set(request.selected_clip_ids)
        ):
            raise HTTPException(status_code=422, detail="The reel plan does not match the selected clip IDs")
        selected_generation_clips = [available_by_id[clip_id] for clip_id in request.selected_clip_ids]
        for planned_clip in request.reel_plan.clips:
            source_clip = available_by_id[planned_clip.clip_id]
            if (
                planned_clip.source_file != source_clip.source_file
                or abs(planned_clip.original_start - source_clip.start_time) > 1e-6
                or abs(planned_clip.original_end - source_clip.end_time) > 1e-6
                or planned_clip.score != source_clip.score
                or planned_clip.planned_start < source_clip.start_time - 1e-6
                or planned_clip.planned_end > source_clip.end_time + 1e-6
            ):
                raise HTTPException(status_code=422, detail="The reel plan contains clip metadata that does not match the analysis")

    template_image_path = _resolve_template_image(
        str(request.analysis_job_id) if request.analysis_job_id else None
    )

    if request.reel_plan is not None:
        template_seconds = (
            get_template_duration_seconds() if template_image_path is not None else 0.0
        )
        if (
            template_seconds
            + request.reel_plan.intro_seconds
            + request.reel_plan.outro_seconds
            + END_CARD_DURATION
            > request.reel_plan.target_duration + 1e-6
        ):
            raise HTTPException(
                status_code=422,
                detail="Reel plan segments exceed the requested total duration",
            )
        request.reel_plan = request.reel_plan.model_copy(
            update={
                "template_seconds": template_seconds,
                "end_card_seconds": END_CARD_DURATION,
            }
        )

    music_path = _resolve_music_path(request.music_filename)

    config = ReelCompositionConfig(
        min_total_duration=request.min_total_duration,
        max_total_duration=request.max_total_duration,
        transition=request.transition,
        music_path=music_path,
        brand=BrandConfig(
            **request.brand.model_dump()
        ),
        product=(
            ProductInfo(
                **request.product.model_dump()
            )
            if request.product
            else None
        ),
    )

    output_path = OUTPUTS_DIR / f"{reel_id}.mp4"

    # ============================================================
    # CREDIT CHECK & DEDUCTION
    # ============================================================

    
    try:
        deduct_credits(
            DEMO_USER_ID,
            REEL_GENERATION_COST,
        )

    except ValueError as exc:
        logger.warning("Invalid reel request: %s", exc)
        detail = (
            str(exc)
            if str(exc).startswith("Insufficient credits.")
            else "Invalid reel request. Please check your input."
        )
        raise HTTPException(
            status_code=400,
            detail=detail,
        ) from exc


    # ============================================================
    # REEL GENERATION
    # ============================================================

    try:

        update_reel_job(str(reel_id), stage="rendering")

        if request.reel_plan is not None:

            # Phase 8: the ReelPlan is the single source of truth
            # (clip order/trims/transitions/branding/product overlays
            # all live on it) - the outer request-level brand/product/
            # transition fields above are irrelevant on this path and
            # only apply to the legacy selected_clips path below.

            # Phase 9 critical fix: transitions must not shrink the Reel
            # below its target duration. Top up the plan (existing-clip
            # slack first, then extra candidates from the analysis pool)
            # before rendering, so this stays a single render pass.
            candidate_pool = selected_generation_clips or _get_candidate_pool(
                str(request.analysis_job_id) if request.analysis_job_id else None
            )

            compensated_plan = extend_plan_for_transitions(
                request.reel_plan,
                candidate_pool,
            )

            # Phase 9 security: reel_plan.music.source_path arrives from
            # the client as JSON, so it must never be trusted as a real
            # filesystem path. Re-resolve it against MUSIC_DIR by filename
            # only (stripping any directory components), same as the
            # legacy music_filename field just above.
            if compensated_plan.music is not None:
                resolved_music_path = _resolve_music_path(
                    compensated_plan.music.source_path
                )

                if resolved_music_path is None:
                    raise HTTPException(
                        status_code=400,
                        detail="Selected music track was not found",
                    )

                compensated_plan = compensated_plan.model_copy(
                    update={
                        "music": compensated_plan.music.model_copy(
                            update={
                                "source_path": str(resolved_music_path)
                            }
                        )
                    }
                )

            result: ReelResult = compose_reel_from_editor_plan(
                compensated_plan,
                source_dir=source_dir,
                output_path=output_path,
                music_path=music_path,
                template_image_path=template_image_path,
            )

        else:

            # Unchanged from Phase 5/6: compose_reel raises
            # EmptySelectionError itself (message contains "empty")
            # when selected_clips is [].
            result = compose_reel(
                request.selected_clips,
                source_dir=source_dir,
                output_path=output_path,
                config=config,
            )

    # ============================================================
    # GENERATION FAILED → REFUND CREDITS
    # ============================================================

    except (
        EmptySelectionError,
        MissingSourceVideoError,
        InvalidTimestampError,
    ) as exc:
        logger.warning(
            "Generate reel client error (400): %s: %s",
            type(exc).__name__,
            exc,
            exc_info=True,
        )

        # Refund because reel generation failed
        refund_credits(
            DEMO_USER_ID,
            REEL_GENERATION_COST,
        )
        if isinstance(exc, EmptySelectionError):
            detail = "Cannot generate a reel from an empty clip selection."
        elif isinstance(exc, MissingSourceVideoError):
            detail = "Source video not found."
        else:
            detail = "Invalid clip timestamp."

        raise HTTPException(
            status_code=400,
            detail=detail,
        ) from exc


    except ValueError as exc:
        logger.warning("Reel request validation failed: %s", exc)

        refund_credits(
            DEMO_USER_ID,
            REEL_GENERATION_COST,
        )

        raise HTTPException(
            status_code=400,
            detail="Invalid reel request. Please check your input.",
        ) from exc

    
    except FFmpegNotAvailableError as exc:
        logger.exception("FFmpeg is unavailable during reel generation")

        refund_credits(
            DEMO_USER_ID,
            REEL_GENERATION_COST,
        )

        raise HTTPException(
            status_code=503,
            detail="Video rendering service is unavailable. Please try again later.",
        ) from exc

    except (
        FFmpegProcessingError,
        OutputValidationError,
    ) as exc:
        logger.exception("Reel rendering or output validation failed")

        refund_credits(
            DEMO_USER_ID,
            REEL_GENERATION_COST,
        )

        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while generating the reel.",
        ) from exc
    except HTTPException:
        refund_credits(DEMO_USER_ID, REEL_GENERATION_COST)
        raise

    except Exception as exc:
        logger.exception("Unexpected error during reel generation")

        refund_credits(
            DEMO_USER_ID,
            REEL_GENERATION_COST,
        )

        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while generating the reel.",
        ) from exc

    except Exception as exc:
        logger.exception("Unexpected error during reel generation")

        refund_credits(
            DEMO_USER_ID,
            REEL_GENERATION_COST,
        )

        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while generating the reel.",
        ) from exc


    # ============================================================
    # GENERATION SUCCESS
    # ============================================================

    update_reel_job(str(reel_id), stage="finalizing")
    response = ReelGenerateResponse(
    **result.model_dump(exclude={"output_path"}),
    reel_id=reel_id,
    status="completed",
    download_url=f"/api/reels/{reel_id}/download",
)

    return response


@router.get(
    "/reels/{reel_id}",
    response_model=ReelJobStatusResponse,
)
def get_reel(
    reel_id: uuid.UUID,
) -> ReelJobStatusResponse:

    reel_id = str(reel_id)
    job = get_reel_job(reel_id)

    if job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Reel not found",
        )

    return ReelJobStatusResponse(
        reel_id=reel_id,
        status=job["status"],
        stage=job["stage"],
        error=job.get("error"),
        result=ReelGenerateResponse(**job["response"]) if job.get("response") else None,
    )


@router.post("/reels/import", status_code=410)
def import_rendered_reel() -> None:
    """Reject browser-rendered uploads until photo exports use server rendering and credits."""
    raise HTTPException(
        status_code=410,
        detail=(
            "Browser-rendered reel imports are disabled. Photo Reel export will return "
            "when photo slides can be rendered through the credit-accounted server pipeline."
        ),
    )


@router.get("/reels/{reel_id}/download")
def download_reel(
    reel_id: uuid.UUID,
) -> FileResponse:
    reel_id = str(reel_id)
    job = get_reel_job(reel_id)
    if job is not None:
        stored_path = job.get("output_path")
        if not stored_path:
            raise HTTPException(status_code=404, detail="Reel file not found")
        output_path = Path(stored_path).resolve()
        if not output_path.is_relative_to(OUTPUTS_DIR.resolve()):
            logger.warning("Rejected reel output outside storage for reel_id=%s", reel_id)
            raise HTTPException(status_code=404, detail="Reel file not found")
    else:
        # Reel metadata is held in the in-memory job store. Keep saved files
        # playable after a backend restart by resolving only the UUID filename.
        output_path = next(
            (OUTPUTS_DIR / f"{reel_id}{suffix}" for suffix in (".mp4", ".webm")
             if (OUTPUTS_DIR / f"{reel_id}{suffix}").is_file()),
            OUTPUTS_DIR / f"{reel_id}.mp4",
        )

    if not output_path.is_file():
        logger.warning(
            "Reel output file missing for reel_id=%s",
            reel_id,
        )
        raise HTTPException(
            status_code=404,
            detail="Reel file not found",
        )

    return FileResponse(
        path=output_path,
        media_type="video/webm" if output_path.suffix.lower() == ".webm" else "video/mp4",
        filename=output_path.name,
    )
