import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
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
    get_analysis_job,
    get_reel_job,
    get_template_image,
)
from app.core.security import safe_filename
from app.schemas.batch import BatchClip, SelectionStatus
from app.schemas.reel import ReelGenerateResponse, ReelResult
from app.schemas.story import ReelPlan
from app.services.ffmpeg_service import (
    FFmpegNotAvailableError,
    FFmpegProcessingError,
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
from app.services.brand_service import (
    get_brand_config,
    get_brand_logo_path,
    get_brand_name,
)
from app.services.reel_editor_renderer import compose_reel_from_editor_plan
from app.services.reel_planner import (
    PlanningConfig,
    extend_plan_for_transitions,
    plan_reel,
)
import logging

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
    selected_clips: list[BatchClip] = []
    reel_plan: ReelPlan | None = None
    output_filename: str | None = None
    analysis_job_id: str | None = None
    min_total_duration: float = 10.0
    max_total_duration: float = 15.0
    transition: str = "cut"
    music_filename: str | None = None
    brand: BrandRequest = Field(default_factory=BrandRequest)
    product: ProductInfoRequest | None = None


class PlanReelRequest(BaseModel):
    analysis_job_id: str
    target_duration: float = 15.0
    min_clip_duration: float = 1.0
    max_clip_duration: float = 8.0
    min_quality_score: float = 50.0


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

    return template_files[0]


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

    analysis_job = get_analysis_job(request.analysis_job_id)

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

    config = PlanningConfig(
        target_duration=request.target_duration,
        min_clip_duration=request.min_clip_duration,
        max_clip_duration=request.max_clip_duration,
        min_quality_score=request.min_quality_score,
    )

    reel_plan = plan_reel(candidate_pool, config)

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
    response_model=ReelGenerateResponse,
)
def generate_reel(
    request: GenerateReelRequest,
) -> ReelGenerateResponse:

    reel_id = str(uuid.uuid4())

    output_filename = safe_filename(
        request.output_filename
        or f"reel_{reel_id}.mp4"
    )

    source_dir = _resolve_source_dir(
        request.analysis_job_id
    )

    template_image_path = _resolve_template_image(
        request.analysis_job_id
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

    output_path = OUTPUTS_DIR / output_filename

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
        raise HTTPException(
            status_code=400,
            detail="Invalid reel request. Please check your input.",
        ) from exc


    # ============================================================
    # REEL GENERATION
    # ============================================================

    try:

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
            candidate_pool = _get_candidate_pool(
                request.analysis_job_id
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

        import traceback

        print(
            "!!! GENERATE REEL CLIENT ERROR (400): "
            f"{type(exc).__name__}: {exc}"
        )

        traceback.print_exc()

        # Refund because reel generation failed
        refund_credits(
            DEMO_USER_ID,
            REEL_GENERATION_COST,
        )

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

    except Exception:
        logger.exception("Unexpected error during reel generation")

        refund_credits(
            DEMO_USER_ID,
            REEL_GENERATION_COST,
        )

        raise


    # ============================================================
    # GENERATION SUCCESS
    # ============================================================

    response = ReelGenerateResponse(
    **result.model_dump(exclude={"output_path"}),
    reel_id=reel_id,
    status="completed",
    download_url=f"/api/reels/{reel_id}/download",
)

    create_reel_job(
    reel_id,
    response.model_dump(),
    str(output_path),
)

    return response


@router.get(
    "/reels/{reel_id}",
    response_model=ReelGenerateResponse,
)
def get_reel(
    reel_id: str,
) -> ReelGenerateResponse:

    job = get_reel_job(reel_id)

    if job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Reel not found",
        )

    return ReelGenerateResponse(
        **job["response"]
    )


@router.get("/reels/{reel_id}/download")
def download_reel(
    reel_id: str,
) -> FileResponse:
    job = get_reel_job(reel_id)

    logger.info("Download requested for reel_id=%s", reel_id)
    logger.info("Reel job found: %s", job is not None)

    if job is None:
        raise HTTPException(
            status_code=404,
            detail="Reel not found",
        )

    output_path = Path(job["output_path"])

    logger.info("Download path: %s", output_path.resolve())
    logger.info("Download file exists: %s", output_path.is_file())

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
        media_type="video/mp4",
        filename=output_path.name,
    )
