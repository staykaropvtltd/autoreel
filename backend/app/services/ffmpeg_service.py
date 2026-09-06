import json
import shutil
import subprocess
from pathlib import Path


class FFmpegNotAvailableError(RuntimeError):
    pass


class FFprobeError(RuntimeError):
    pass


class FFmpegProcessingError(RuntimeError):
    pass


def check_ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def require_ffmpeg() -> None:
    if not check_ffmpeg_available():
        raise FFmpegNotAvailableError(
            "ffmpeg and/or ffprobe were not found on PATH. Install FFmpeg to use the video engine."
        )


def probe(input_path: Path) -> dict:
    require_ffmpeg()

    if not input_path.exists():
        raise FileNotFoundError(f"Input video not found: {input_path}")

    command = [
        "ffprobe",
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(input_path),
    ]

    result = subprocess.run(command, capture_output=True, text=True)

    if result.returncode != 0:
        raise FFprobeError(f"ffprobe failed for {input_path}: {result.stderr.strip()}")

    return json.loads(result.stdout)


def run_ffmpeg(args: list[str]) -> None:
    require_ffmpeg()

    command = ["ffmpeg", "-y", *args]
    result = subprocess.run(command, capture_output=True, text=True)

    if result.returncode != 0:
        stderr_tail = "\n".join(result.stderr.strip().splitlines()[-20:])
        raise FFmpegProcessingError(f"ffmpeg failed (exit {result.returncode}):\n{stderr_tail}")
