import subprocess
from pathlib import Path

import pytest


@pytest.fixture
def synthetic_video_with_audio(tmp_path: Path) -> Path:
    """Generates a tiny synthetic 1280x720, 1s H.264/AAC clip via ffmpeg lavfi.
    Avoids committing binary test fixtures to the repo.
    """
    output = tmp_path / "synthetic_with_audio.mp4"
    command = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=1280x720:rate=15:duration=1",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=1",
        "-shortest",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        str(output),
    ]
    subprocess.run(command, capture_output=True, text=True, check=True)
    return output


@pytest.fixture
def synthetic_video_no_audio(tmp_path: Path) -> Path:
    output = tmp_path / "synthetic_no_audio.mp4"
    command = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=1280x720:rate=15:duration=1",
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        str(output),
    ]
    subprocess.run(command, capture_output=True, text=True, check=True)
    return output


@pytest.fixture
def synthetic_dark_video(tmp_path: Path) -> Path:
    """A near-black, low-motion 1s clip for darkness-detection tests."""
    output = tmp_path / "synthetic_dark.mp4"
    command = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=0x030303:size=640x360:rate=15:duration=1",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        str(output),
    ]
    subprocess.run(command, capture_output=True, text=True, check=True)
    return output


@pytest.fixture
def synthetic_long_video(tmp_path: Path) -> Path:
    """A 70s, 1280x720 H.264/AAC clip - long enough to carve multiple
    non-overlapping trims from for Phase 9's duration-validation tests
    (15s/30s/45s/60s targets with transitions), without generating a
    separate large fixture per target duration.
    """
    output = tmp_path / "synthetic_long.mp4"
    command = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=15:duration=70",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=70",
        "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
        str(output),
    ]
    subprocess.run(command, capture_output=True, text=True, check=True)
    return output


@pytest.fixture
def synthetic_two_scene_video(tmp_path: Path) -> Path:
    """A 2s clip with a hard cut: 1s solid red followed by 1s solid blue.
    Used to verify scene-boundary detection and that visually distinct
    segments are not flagged as duplicates.
    """
    output = tmp_path / "synthetic_two_scene.mp4"
    command = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:size=640x360:rate=15:duration=1",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:size=640x360:rate=15:duration=1",
        "-filter_complex",
        "[0:v][1:v]concat=n=2:v=1:a=0",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        str(output),
    ]
    subprocess.run(command, capture_output=True, text=True, check=True)
    return output
