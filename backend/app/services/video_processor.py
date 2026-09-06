import time
from pathlib import Path

from app.schemas.video import ProcessingResult, VideoMetadata
from app.services.ffmpeg_service import run_ffmpeg
from app.services.video_metadata import get_video_metadata, get_video_stream_duration


class OutputValidationError(RuntimeError):
    pass


def compute_reframe_params(
    src_width: int, src_height: int, target_width: int, target_height: int
) -> dict[str, int]:
    """Compute a center-crop-to-fill scale+crop plan that maps src -> target
    without stretching. Scales the source up/down so it fully covers the
    target box, then center-crops the overflow.
    """
    src_aspect = src_width / src_height
    target_aspect = target_width / target_height

    if src_aspect > target_aspect:
        scale_height = target_height
        scale_width = round(target_height * src_aspect)
    else:
        scale_width = target_width
        scale_height = round(target_width / src_aspect)

    scale_width = max(scale_width, target_width)
    scale_height = max(scale_height, target_height)

    crop_x = (scale_width - target_width) // 2
    crop_y = (scale_height - target_height) // 2

    return {
        "scale_width": scale_width,
        "scale_height": scale_height,
        "crop_x": crop_x,
        "crop_y": crop_y,
    }


def build_reframe_filter(params: dict[str, int], target_width: int, target_height: int) -> str:
    return (
        f"scale={params['scale_width']}:{params['scale_height']},"
        f"crop={target_width}:{target_height}:{params['crop_x']}:{params['crop_y']},"
        "setsar=1"
    )


# Aspect ratios at or above this are treated as "landscape or square" for
# fitting purposes; a 9:16 source is 0.5625, so anything from a hair below
# 1:1 up to ultra-wide all clearly needs the blurred-background treatment
# rather than losing most of the frame to a center crop.
_LANDSCAPE_OR_SQUARE_ASPECT_THRESHOLD = 1.0

# Softens the background enough that it reads as an ambient backdrop, not a
# ghost of the sharp foreground; darkened slightly so the foreground video
# is unambiguously the focal point.
_BACKGROUND_BLUR_SIGMA = 25
_BACKGROUND_BRIGHTNESS_ADJUST = -0.06


def compute_smart_fit_plan(
    src_width: int, src_height: int, target_width: int, target_height: int
) -> dict:
    """Decides how to fit an arbitrary-aspect-ratio source into the target
    box without ever independently resizing width and height (no stretch or
    squash, ever - a uniform scale factor is always used).

    Portrait sources (9:16, 4:5, 3:4, ...) are close enough in shape to a
    9:16 target that scale-to-cover + a centered crop only trims modest
    overflow - a genuinely 9:16 source needs no crop at all. Landscape or
    square sources (16:9, 4:3, 1:1, ...) would lose most of their width to
    that same crop, so they instead get a blurred, full-frame copy of
    themselves as a background, with the whole original frame scaled down
    to fit (never cropped) and centered on top - see
    build_smart_fit_filter_complex.
    """
    src_aspect = src_width / src_height
    if src_aspect < _LANDSCAPE_OR_SQUARE_ASPECT_THRESHOLD:
        cover_params = compute_reframe_params(src_width, src_height, target_width, target_height)
        return {"mode": "cover", **cover_params}
    return {"mode": "blur_fit"}


def build_smart_fit_filter_complex(
    plan: dict, target_width: int, target_height: int, input_label: str, output_label: str
) -> str:
    """Returns one filter_complex fragment - possibly spanning several
    filters chained with ';' - that reframes `input_label` into
    target_width x target_height per `plan`, producing `[output_label]`.
    """
    if plan["mode"] == "cover":
        reframe = build_reframe_filter(plan, target_width, target_height)
        return f"[{input_label}]{reframe}[{output_label}]"

    bg_src, fg_src = f"{output_label}_bgsrc", f"{output_label}_fgsrc"
    bg, fg = f"{output_label}_bg", f"{output_label}_fg"
    return (
        f"[{input_label}]split=2[{bg_src}][{fg_src}];"
        f"[{bg_src}]scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
        f"crop={target_width}:{target_height},"
        f"gblur=sigma={_BACKGROUND_BLUR_SIGMA},eq=brightness={_BACKGROUND_BRIGHTNESS_ADJUST},setsar=1[{bg}];"
        f"[{fg_src}]scale={target_width}:{target_height}:force_original_aspect_ratio=decrease,setsar=1[{fg}];"
        f"[{bg}][{fg}]overlay=(W-w)/2:(H-h)/2[{output_label}]"
    )


def validate_output(
    output_path: Path, target_width: int, target_height: int, expect_audio: bool
) -> VideoMetadata:
    if not output_path.exists():
        raise OutputValidationError(f"Output file does not exist: {output_path}")

    try:
        metadata = get_video_metadata(output_path)
    except Exception as exc:
        raise OutputValidationError(f"Output file is not readable: {output_path} ({exc})") from exc

    errors = []
    if metadata.width != target_width:
        errors.append(f"width {metadata.width} != {target_width}")
    if metadata.height != target_height:
        errors.append(f"height {metadata.height} != {target_height}")
    if metadata.duration <= 0:
        errors.append("duration is not > 0")
    if metadata.video_codec != "h264":
        errors.append(f"video codec '{metadata.video_codec}' != h264")
    if "mp4" not in metadata.format:
        errors.append(f"container '{metadata.format}' does not include mp4")
    if expect_audio and metadata.audio_codec != "aac":
        errors.append(f"expected aac audio, got '{metadata.audio_codec}'")

    # Guards against a corrupted transition chain (or any other bug) that
    # truncates the video stream while audio/container keep running to the
    # intended length - metadata.duration alone can't catch this, since it
    # reflects the container's (longest-stream) duration, which still looks
    # correct in exactly this failure mode.
    video_stream_duration = get_video_stream_duration(output_path)
    duration_gap = metadata.duration - video_stream_duration
    if duration_gap > max(1.0, metadata.duration * 0.1):
        errors.append(
            f"video stream ends at {video_stream_duration:.2f}s but the container "
            f"runs to {metadata.duration:.2f}s - the video track terminated early"
        )

    if errors:
        raise OutputValidationError(
            f"Output validation failed for {output_path}: {'; '.join(errors)}"
        )

    return metadata


def process_video(
    input_path: str | Path,
    output_path: str | Path,
    target_width: int = 1080,
    target_height: int = 1920,
) -> ProcessingResult:
    input_path = Path(input_path)
    output_path = Path(output_path)

    if not input_path.exists():
        raise FileNotFoundError(f"Input video not found: {input_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    input_metadata = get_video_metadata(input_path)
    has_audio = input_metadata.audio_codec is not None

    params = compute_reframe_params(
        input_metadata.width, input_metadata.height, target_width, target_height
    )
    reframe_filter = build_reframe_filter(params, target_width, target_height)

    args = [
        "-i",
        str(input_path),
        "-vf",
        reframe_filter,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
    ]
    args += ["-c:a", "aac", "-b:a", "128k"] if has_audio else ["-an"]
    args += ["-movflags", "+faststart", str(output_path)]

    start = time.perf_counter()
    run_ffmpeg(args)
    processing_time_seconds = round(time.perf_counter() - start, 3)

    output_metadata = validate_output(output_path, target_width, target_height, has_audio)

    return ProcessingResult(
        input_path=str(input_path),
        output_path=str(output_path),
        processing_time_seconds=processing_time_seconds,
        input_metadata=input_metadata,
        output_metadata=output_metadata,
    )
