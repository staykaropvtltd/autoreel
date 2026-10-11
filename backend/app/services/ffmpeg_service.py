
import json
import logging
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


class FFmpegNotAvailableError(RuntimeError):
    pass


class FFprobeError(RuntimeError):
    pass


class FFmpegProcessingError(RuntimeError):
    pass


def check_ffmpeg_available() -> bool:
    return (
        shutil.which("ffmpeg") is not None
        and shutil.which("ffprobe") is not None
    )


def require_ffmpeg() -> None:
    if not check_ffmpeg_available():
        logger.error("FFmpeg or FFprobe is not available on PATH")
        raise FFmpegNotAvailableError(
            "Video processing is currently unavailable."
        )


def probe(input_path: Path) -> dict:
    require_ffmpeg()

    if not input_path.exists():
        # Keep the absolute path in server logs only.
        logger.warning("FFprobe input file not found: %s", input_path)
        raise FileNotFoundError("Input video not found.")

    command = [
        "ffprobe",
        "-v",
        "quiet",
        "-protocol_whitelist",
        "file,crypto,data",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(input_path),
    ]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
            check=False,
        )
    except subprocess.TimeoutExpired:
        logger.error("FFprobe timed out for input: %s", input_path)
        raise FFprobeError("Unable to inspect the media file.") from None
    except OSError:
        logger.exception("Unable to execute FFprobe for input: %s", input_path)
        raise FFprobeError("Unable to inspect the media file.") from None

    if result.returncode != 0:
        logger.error(
            "FFprobe failed for %s (exit %s): %s",
            input_path,
            result.returncode,
            result.stderr.strip()[-2000:],
        )
        raise FFprobeError("Unable to inspect the media file.")

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        logger.error("FFprobe returned invalid JSON for: %s", input_path)
        raise FFprobeError("Unable to inspect the media file.") from None


def run_ffmpeg(args: list[str]) -> None:
    require_ffmpeg()

    command = ["ffmpeg", "-y", *args]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=600,
            check=False,
        )
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg processing timed out")
        raise FFmpegProcessingError(
            "Video processing timed out. Please try again."
        ) from None
    except OSError:
        logger.exception("Unable to execute FFmpeg")
        raise FFmpegProcessingError(
            "Video processing could not be started."
        ) from None

    if result.returncode != 0:
        # Full stderr stays in server logs, not the API response.
        logger.error(
            "FFmpeg failed (exit %s): %s",
            result.returncode,
            result.stderr.strip()[-2000:],
        )
        raise FFmpegProcessingError(
            "Video processing failed. Please try again."
        )
