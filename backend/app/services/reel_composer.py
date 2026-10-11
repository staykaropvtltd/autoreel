"""Phase 5: turns a Phase 4 clip selection into one publish-ready 9:16 Reel.

Pipeline (per compose_reel call):

    selected clips (Phase 4 BatchClip list)
        -> order deterministically (hero shot first, by score)
        -> plan segments to fit the target total duration
        -> validate each clip's timestamps against its source file
        -> extract + reframe (1080x1920) + normalize each clip to its own
           temp file (identical codec/fps/pix_fmt/audio layout so they can
           be concatenated safely)
        -> concatenate (fast stream copy - no re-encode, since every temp
           clip already shares identical encoding parameters)
        -> one final pass: brand/product drawtext overlay + optional
           background music + faststart
        -> validate output (reuses Phase 2's validate_output)

Reuses Phase 2 (app.services.video_processor / ffmpeg_service) for the
reframe math and ffmpeg subprocess plumbing, and Phase 3's
get_video_metadata for cheap (ffprobe-only) source inspection - no clip is
ever re-analyzed frame-by-frame.

Audio policy: Phase 2 omits audio entirely when a source has none. Phase 5
instead synthesizes silence for audio-less segments so every extracted clip
has exactly one video + one audio stream, which concatenation requires.
"""

import tempfile
import time
import uuid
import re
from dataclasses import dataclass, field
from pathlib import Path

from app.schemas.batch import BatchClip
from app.schemas.reel import PlannedClip, ReelResult
from app.schemas.story import ZOOM_TRANSITION_TYPES, TransitionConfig, TransitionType
from app.schemas.video import VideoMetadata
from app.services.brand_service import get_brand_name
from app.services.ffmpeg_service import run_ffmpeg
from app.services.video_metadata import get_video_metadata
from app.services.video_processor import (
    OutputValidationError,
    build_smart_fit_filter_complex,
    compute_smart_fit_plan,
    validate_output,
)

DEFAULT_TARGET_WIDTH = 1080
DEFAULT_TARGET_HEIGHT = 1920
DEFAULT_FPS = 30
DEFAULT_MIN_TOTAL_DURATION = 10.0
DEFAULT_MAX_TOTAL_DURATION = 15.0
DEFAULT_MIN_FRAGMENT_DURATION = 0.5
DEFAULT_TRANSITION_DURATION = 0.3

_WINDOWS_DEFAULT_FONT = "C:/Windows/Fonts/arial.ttf"
_LINUX_DEFAULT_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


class ReelCompositionError(RuntimeError):
    pass


class EmptySelectionError(ReelCompositionError):
    pass


class MissingSourceVideoError(ReelCompositionError):
    pass


class InvalidTimestampError(ReelCompositionError):
    pass


@dataclass
class BrandConfig:
    text: str | None = field(default_factory=get_brand_name)
    font_file: str | None = None
    font_size: int = 42
    font_color: str = "white"
    position: str = "bottom"

    def __post_init__(self):
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

        if not isinstance(self.font_color, str):
            raise ValueError("Invalid font color")

        if (
            self.font_color.lower() not in allowed_colors
            and not re.fullmatch(
                r"#[0-9A-Fa-f]{6}",
                self.font_color,
            )
        ):
            raise ValueError("Invalid font color")

        if not isinstance(self.font_size, (int, float)):
            raise ValueError("Invalid font size")

        if not 12 <= self.font_size <= 200:
            raise ValueError("Invalid font size")

        allowed_positions = {
            "top",
            "bottom",
        }

        if self.position not in allowed_positions:
            raise ValueError("Invalid brand position")

@dataclass
class ProductInfo:
    product_name: str | None = None
    product_code: str | None = None
    price: str | None = None
    category: str | None = None

    def as_overlay_line(self) -> str | None:
        parts = [p for p in (self.product_name, self.category, self.price, self.product_code) if p]
        return "  |  ".join(parts) if parts else None


@dataclass
class ReelCompositionConfig:
    target_width: int = DEFAULT_TARGET_WIDTH
    target_height: int = DEFAULT_TARGET_HEIGHT
    fps: int = DEFAULT_FPS
    min_total_duration: float = DEFAULT_MIN_TOTAL_DURATION
    max_total_duration: float = DEFAULT_MAX_TOTAL_DURATION
    min_fragment_duration: float = DEFAULT_MIN_FRAGMENT_DURATION
    transition: str = "cut"  # "cut" | "fade"
    transition_duration: float = DEFAULT_TRANSITION_DURATION
    music_path: str | Path | None = None
    brand: BrandConfig = field(default_factory=BrandConfig)
    product: ProductInfo | None = None


def order_clips_for_reel(selected_clips: list[BatchClip]) -> list[BatchClip]:
    """Deterministic ordering: highest-scoring ("hero") clip first, then the
    rest by descending score. Phase 4's selection already excludes redundant
    near-duplicates, so score-descending naturally yields hero -> diverse
    supporting shots without needing shot-type classification (which would
    require subject/scene understanding not yet implemented). Ties break on
    source_file/start_time for full determinism.
    """
    return sorted(selected_clips, key=lambda c: (-c.score, c.source_file, c.start_time))


def plan_reel_segments(
    ordered_clips: list[BatchClip], config: ReelCompositionConfig
) -> list[PlannedClip]:
    """Greedily includes ordered clips until max_total_duration is reached,
    trimming the last included clip down to fit exactly. Stops early (rather
    than including a sliver) once min_total_duration is already satisfied.
    Does not force every selected clip into the output.
    """
    planned: list[PlannedClip] = []
    accumulated = 0.0

    for clip in ordered_clips:
        if accumulated >= config.max_total_duration:
            break

        remaining_budget = config.max_total_duration - accumulated
        effective_duration = min(clip.duration, remaining_budget)

        if effective_duration < config.min_fragment_duration and accumulated >= config.min_total_duration:
            break
        if effective_duration <= 0:
            continue

        planned.append(
            PlannedClip(
                source_file=clip.source_file,
                start_time=clip.start_time,
                end_time=clip.start_time + effective_duration,
                duration=effective_duration,
                score=clip.score,
            )
        )
        accumulated += effective_duration

    return planned


def resolve_source_path(source_file: str, source_dir: str | Path) -> Path:
    """
    Safely resolve a client-provided source filename inside source_dir.

    Prevents:
    - ../ path traversal
    - absolute-path escapes
    - symlink-based escapes outside source_dir
    """
    if not source_file or ".." in source_file or Path(source_file).is_absolute():
        raise MissingSourceVideoError("Invalid source file path")

    source_root = Path(source_dir).resolve()
    safe_name = Path(source_file).name
    candidate = (source_root / safe_name).resolve()

    # Candidate must remain inside the intended source directory.
    if not candidate.is_relative_to(source_root):
        raise MissingSourceVideoError(
            "Invalid source file path: file must remain inside the upload directory"
        )

    if not candidate.is_file():
        raise MissingSourceVideoError(
            f"Source video not found: {safe_name}"
        )

    return candidate

def validate_clip_timestamps(planned: PlannedClip, source_metadata: VideoMetadata) -> None:
    epsilon = 0.05
    if planned.start_time < 0:
        raise InvalidTimestampError(f"{planned.source_file}: start_time {planned.start_time} < 0")
    if planned.end_time <= planned.start_time:
        raise InvalidTimestampError(
            f"{planned.source_file}: end_time {planned.end_time} <= start_time {planned.start_time}"
        )
    if planned.end_time > source_metadata.duration + epsilon:
        raise InvalidTimestampError(
            f"{planned.source_file}: end_time {planned.end_time} exceeds source duration "
            f"{source_metadata.duration}"
        )


def _default_font_file() -> str | None:
    for candidate in (_WINDOWS_DEFAULT_FONT, _LINUX_DEFAULT_FONT):
        if Path(candidate).exists():
            return candidate
    return None


def _escape_drawtext(text: str) -> str:
    text = text.replace("\\", "\\\\").replace(":", "\\:").replace("%", "\\%")
    return text.replace("'", "")


def _escape_font_path(path: str) -> str:
    posix_path = Path(path).as_posix()
    return posix_path.replace(":", "\\:")


def build_overlay_filter(config: ReelCompositionConfig) -> str | None:
    """Builds a drawtext filter chain for the brand name and, if provided,
    a product-info line. Returns None if there's nothing to draw or no font
    file could be resolved (branding is cosmetic, not fatal).
    """
    font_file = config.brand.font_file or _default_font_file()
    if font_file is None:
        return None

    lines = []
    brand_y = "h-th-40" if config.brand.position == "bottom" else "40"
    if config.brand.text:
        lines.append(
            f"drawtext=fontfile='{_escape_font_path(font_file)}':"
            f"text='{_escape_drawtext(config.brand.text)}':"
            f"fontcolor={config.brand.font_color}:fontsize={config.brand.font_size}:"
            f"x=(w-text_w)/2:y={brand_y}"
        )

    product_line = config.product.as_overlay_line() if config.product else None
    if product_line:
        product_y = "h-th-90" if config.brand.position == "bottom" else "90"
        lines.append(
            f"drawtext=fontfile='{_escape_font_path(font_file)}':"
            f"text='{_escape_drawtext(product_line)}':"
            f"fontcolor={config.brand.font_color}:fontsize={max(config.brand.font_size - 12, 16)}:"
            f"x=(w-text_w)/2:y={product_y}"
        )

    return ",".join(lines) if lines else None


def build_zoom_filter(
    transition: TransitionConfig, clip_duration: float, fps: int, target_width: int, target_height: int
) -> str | None:
    """Phase 8: a zoompan clause animating the INCOMING clip's own opening
    frames - not a crossfade with the previous clip. Returns None for
    non-zoom transitions or a non-positive duration.

    zoom_in:  starts zoomed in (1.3x), settles to normal framing by the end
              of the transition window (spec: "first N seconds zoomed,
              gradually return to normal framing").
    zoom_out: the spec only fully defines zoom_in's curve. zoom_out is
              implemented as a brief zoom pulse (normal -> zoomed -> normal)
              entirely within the window, so both effects always leave the
              clip at normal framing afterward, while remaining visually
              distinct from one another.
    """
    if transition.type not in ZOOM_TRANSITION_TYPES or transition.duration <= 0:
        return None

    window_seconds = min(transition.duration, clip_duration)
    window_frames = max(1, round(window_seconds * fps))
    zoom_peak = 1.3
    zoom_range = zoom_peak - 1.0

    if transition.type == TransitionType.ZOOM_IN:
        expr = f"if(lte(on,{window_frames}),{zoom_peak}-{zoom_range}*on/{window_frames},1.0)"
    else:
        half = max(1, window_frames // 2)
        expr = (
            f"if(lte(on,{half}),1.0+{zoom_range}*on/{half},"
            f"if(lte(on,{window_frames}),{zoom_peak}-{zoom_range}*(on-{half})/{half},1.0))"
        )

    x_expr = "iw/2-(iw/zoom/2)"
    y_expr = "ih/2-(ih/zoom/2)"
    return f"zoompan=z='{expr}':x='{x_expr}':y='{y_expr}':d=1:s={target_width}x{target_height}:fps={fps}"


def build_fade_in_filter(transition: TransitionConfig, clip_duration: float) -> tuple[str | None, str | None]:
    """A duration-preserving fade-in baked into the INCOMING clip's own
    opening frames - not a crossfade with the previous clip. Returns
    (video_filter, audio_filter), either of which may be None.

    slide_left/slide_right degrade to a clean cut (no filter): a true
    single-clip slide-in needs padding/cropping tricks that risk their own
    edge cases, and a plain cut is always duration-safe, which matters more
    here than the visual effect (see reel_editor_renderer's compute_timeline_plan).
    """
    if transition.type != TransitionType.FADE or transition.duration <= 0:
        return None, None

    d = min(transition.duration, clip_duration)
    if d <= 0:
        return None, None
    return f"fade=t=in:st=0:d={d:.3f}", f"afade=t=in:st=0:d={d:.3f}"


def extract_clip(
    source_path: Path,
    source_metadata: VideoMetadata,
    planned: PlannedClip,
    output_path: Path,
    config: ReelCompositionConfig,
    fade_in: bool,
    fade_out: bool,
) -> None:
    """Trims exactly [start_time, end_time) from the source, fits it into the
    target 9:16 resolution WITHOUT ever stretching/squashing it, and
    normalizes fps/codec/audio so the result can be safely concatenated with
    other clips.

    Fitting is aspect-ratio aware (see compute_smart_fit_plan): a portrait
    source close enough in shape to 9:16 is scaled to cover the frame and
    center-cropped (unavoidable for a genuinely different portrait ratio,
    but a native 9:16 source needs no crop at all); a landscape or square
    source instead gets a blurred, full-frame copy of itself as a
    background, with the whole original frame scaled to fit and centered on
    top - never losing most of the frame to a crop.
    """
    fit_plan = compute_smart_fit_plan(
        source_metadata.width, source_metadata.height, config.target_width, config.target_height
    )

    filter_stages = [
        build_smart_fit_filter_complex(fit_plan, config.target_width, config.target_height, "0:v", "fit"),
        f"[fit]fps={config.fps}[fpsed]",
    ]
    cur_label = "fpsed"
    af_parts = []

    zoom_filter = build_zoom_filter(
        planned.transition_in, planned.duration, config.fps, config.target_width, config.target_height
    )
    if zoom_filter:
        filter_stages.append(f"[{cur_label}]{zoom_filter}[zoomed]")
        cur_label = "zoomed"

    transition_fade_v, transition_fade_a = build_fade_in_filter(planned.transition_in, planned.duration)
    if transition_fade_v:
        filter_stages.append(f"[{cur_label}]{transition_fade_v}[transfaded]")
        cur_label = "transfaded"
    if transition_fade_a:
        af_parts.append(transition_fade_a)

    if config.transition == "fade":
        d = config.transition_duration
        if fade_in:
            filter_stages.append(f"[{cur_label}]fade=t=in:st=0:d={d}[fadein]")
            cur_label = "fadein"
            af_parts.append(f"afade=t=in:st=0:d={d}")
        if fade_out:
            fade_start = max(planned.duration - d, 0.0)
            filter_stages.append(f"[{cur_label}]fade=t=out:st={fade_start}:d={d}[fadeout]")
            cur_label = "fadeout"
            af_parts.append(f"afade=t=out:st={fade_start}:d={d}")

    filter_complex = ";".join(filter_stages)
    has_audio = source_metadata.audio_codec is not None

    args = ["-ss", str(planned.start_time), "-t", str(planned.duration), "-i", str(source_path)]
    if has_audio:
        args += ["-map", f"[{cur_label}]", "-map", "0:a:0"]
        if af_parts:
            args += ["-af", ",".join(af_parts)]
    else:
        # Synthesize silence so every extracted clip has an audio stream -
        # required for safe concatenation regardless of source audio.
        args += ["-f", "lavfi", "-t", str(planned.duration), "-i", "anullsrc=r=44100:cl=stereo"]
        args += ["-map", f"[{cur_label}]", "-map", "1:a:0"]

    args += [
        "-filter_complex", filter_complex,
        # Real-world (phone-shot) footage is often variable frame rate;
        # -fps_mode cfr forces genuinely constant frame timing on output so
        # every extracted clip's actual duration is predictable and the
        # xfade/acrossfade transition chain downstream doesn't drift against
        # the timing it was built for.
        "-fps_mode", "cfr",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", str(config.fps),
        "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k",
        "-shortest",
        str(output_path),
    ]
    run_ffmpeg(args)


def concatenate_clips(clip_paths: list[Path], output_path: Path, work_dir: Path) -> None:
    """Fast stream-copy concat - safe because every clip in `clip_paths` was
    produced by extract_clip with identical encoding parameters.
    """
    list_file = work_dir / "concat_list.txt"
    lines = [f"file '{p.as_posix()}'" for p in clip_paths]
    list_file.write_text("\n".join(lines), encoding="utf-8")

    run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(list_file), "-c", "copy", str(output_path)])


def apply_overlay_and_music(intermediate_path: Path, output_path: Path, config: ReelCompositionConfig) -> None:
    overlay_filter = build_overlay_filter(config)

    args = ["-i", str(intermediate_path)]
    if config.music_path:
        args += ["-stream_loop", "-1", "-i", str(config.music_path), "-map", "0:v:0", "-map", "1:a:0"]
    if overlay_filter:
        args += ["-vf", overlay_filter]
    args += [
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k",
        "-shortest",
        "-movflags", "+faststart",
        str(output_path),
    ]
    run_ffmpeg(args)


def compose_reel(
    selected_clips: list[BatchClip],
    source_dir: str | Path,
    output_path: str | Path,
    config: ReelCompositionConfig | None = None,
) -> ReelResult:
    if not selected_clips:
        raise EmptySelectionError("Cannot compose a Reel from an empty clip selection")

    config = config or ReelCompositionConfig()

    ordered = order_clips_for_reel(selected_clips)
    planned_clips = plan_reel_segments(ordered, config)
    if not planned_clips:
        raise EmptySelectionError("No clips survived duration planning")

    return _render_planned_clips(planned_clips, source_dir, output_path, config)


def compose_reel_from_plan(
    planned_clips: list[PlannedClip],
    source_dir: str | Path,
    output_path: str | Path,
    config: ReelCompositionConfig | None = None,
) -> ReelResult:
    """Phase 7 entry point: renders an already-ordered, already-trimmed clip
    sequence exactly as given (e.g. from app.services.reel_planner), instead
    of deriving ordering/duration-fit here via order_clips_for_reel /
    plan_reel_segments. The FFmpeg rendering pipeline itself (extract, concat,
    overlay) is fully shared with compose_reel via _render_planned_clips.
    """
    if not planned_clips:
        raise EmptySelectionError("Cannot compose a Reel from an empty clip plan")

    config = config or ReelCompositionConfig()

    return _render_planned_clips(planned_clips, source_dir, output_path, config)


def _render_planned_clips(
    planned_clips: list[PlannedClip],
    source_dir: str | Path,
    output_path: str | Path,
    config: ReelCompositionConfig,
) -> ReelResult:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    start = time.perf_counter()

    source_metadata_cache: dict[str, VideoMetadata] = {}
    resolved_sources: dict[str, Path] = {}
    for planned in planned_clips:
        if planned.source_file not in resolved_sources:
            resolved_sources[planned.source_file] = resolve_source_path(planned.source_file, source_dir)
            source_metadata_cache[planned.source_file] = get_video_metadata(
                resolved_sources[planned.source_file]
            )
        validate_clip_timestamps(planned, source_metadata_cache[planned.source_file])

    with tempfile.TemporaryDirectory(prefix="autoreel_") as tmp_dir_str:
        tmp_dir = Path(tmp_dir_str)
        clip_paths = []

        for i, planned in enumerate(planned_clips):
            clip_output = tmp_dir / f"clip_{i:03d}.mp4"
            extract_clip(
                resolved_sources[planned.source_file],
                source_metadata_cache[planned.source_file],
                planned,
                clip_output,
                config,
                fade_in=(i > 0),
                fade_out=(i < len(planned_clips) - 1),
            )
            clip_paths.append(clip_output)

        intermediate_path = tmp_dir / "concatenated.mp4"
        if len(clip_paths) == 1:
            intermediate_path = clip_paths[0]
        else:
            concatenate_clips(clip_paths, intermediate_path, tmp_dir)

        apply_overlay_and_music(intermediate_path, output_path, config)

    processing_time_seconds = round(time.perf_counter() - start, 3)

    output_metadata = validate_output(
        output_path, config.target_width, config.target_height, expect_audio=True
    )

    return ReelResult(
        output_path=str(output_path),
        duration=output_metadata.duration,
        width=output_metadata.width,
        height=output_metadata.height,
        video_codec=output_metadata.video_codec,
        audio_codec=output_metadata.audio_codec,
        clip_count=len(planned_clips),
        planned_clips=planned_clips,
        processing_time_seconds=processing_time_seconds,
    )
