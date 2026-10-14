
import json
import logging
import os
import signal
import shutil
import subprocess
import time
from threading import local
from pathlib import Path

logger = logging.getLogger(__name__)
def _timeout_from_env(name: str, fallback: int) -> int:
    try:
        return max(1, int(os.environ.get(name, str(fallback))))
    except ValueError:
        logger.warning("Invalid %s value; using default timeout", name)
        return fallback


FFMPEG_TIMEOUT_SECONDS = _timeout_from_env("AUTOREEL_FFMPEG_TIMEOUT_SECONDS", 1800)
FFPROBE_TIMEOUT_SECONDS = _timeout_from_env("AUTOREEL_FFPROBE_TIMEOUT_SECONDS", 120)
_render_context = local()


def set_render_deadline(deadline: float | None) -> None:
    _render_context.deadline = deadline


def _bounded_timeout(configured: int) -> int:
    deadline = getattr(_render_context, "deadline", None)
    if deadline is None:
        return configured
    return max(0, min(configured, int(deadline - time.monotonic())))


def _run_process(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    """Run a media tool in its own process group and reap its full process tree."""
    if timeout <= 0:
        raise subprocess.TimeoutExpired(command, timeout)
    kwargs: dict[str, object] = {
        "stdout": subprocess.PIPE,
        "stderr": subprocess.PIPE,
        "text": True,
        "encoding": "utf-8",
        "errors": "replace",
    }
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    process = subprocess.Popen(command, **kwargs)  # type: ignore[arg-type]
    try:
        stdout, stderr = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        if os.name == "nt":
            try:
                result = subprocess.run(
                    ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                    capture_output=True,
                    timeout=10,
                    check=False,
                )
                if getattr(result, "returncode", 0) != 0:
                    process.kill()
            except (OSError, subprocess.TimeoutExpired):
                process.kill()
        else:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass
            # Kill any descendants that ignored SIGTERM even if the leader exited.
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        stdout, stderr = process.communicate()
        raise subprocess.TimeoutExpired(command, timeout, output=stdout, stderr=stderr)
    return subprocess.CompletedProcess(command, process.returncode, stdout, stderr)


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
        result = _run_process(command, _bounded_timeout(FFPROBE_TIMEOUT_SECONDS))
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
        result = _run_process(command, _bounded_timeout(FFMPEG_TIMEOUT_SECONDS))
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
