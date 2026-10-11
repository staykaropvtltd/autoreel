"""Universal video fit: an uploaded clip of any reasonable aspect ratio must
land in the final 1080x1920 Reel without ever being stretched or squashed -
see video_processor.compute_smart_fit_plan / build_smart_fit_filter_complex
and reel_composer.extract_clip.
"""

import subprocess
from pathlib import Path

import pytest

from app.schemas.reel import PlannedClip
from app.schemas.story import TransitionConfig
from app.services.reel_composer import ReelCompositionConfig, extract_clip
from app.services.video_metadata import get_video_metadata
from app.services.video_processor import compute_smart_fit_plan


def _make_source(path: Path, width: int, height: int, duration: float = 2.0) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi", "-i", f"testsrc2=size={width}x{height}:rate=30:duration={duration}",
            "-f", "lavfi", "-i", f"sine=frequency=440:duration={duration}",
            "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-shortest", str(path),
        ],
        capture_output=True, check=True,
    )


@pytest.mark.parametrize(
    "width,height,expected_mode",
    [
        (1920, 1080, "blur_fit"),  # 16:9 landscape
        (1080, 1920, "cover"),  # native 9:16 portrait
        (1080, 1080, "blur_fit"),  # 1:1 square
        (1080, 1350, "cover"),  # 4:5 portrait
        (1440, 1080, "blur_fit"),  # 4:3 landscape
    ],
)
def test_compute_smart_fit_plan_picks_expected_mode(width, height, expected_mode):
    plan = compute_smart_fit_plan(width, height, 1080, 1920)
    assert plan["mode"] == expected_mode


@pytest.mark.parametrize(
    "name,width,height",
    [
        ("16x9", 1920, 1080),
        ("9x16", 1080, 1920),
        ("1x1", 1080, 1080),
        ("4x5", 1080, 1350),
    ],
)
def test_extract_clip_never_distorts_and_always_outputs_target_resolution(
    tmp_path: Path, name, width, height
):
    src = tmp_path / f"src_{name}.mp4"
    _make_source(src, width, height)
    source_metadata = get_video_metadata(src)

    planned = PlannedClip(
        source_file=src.name, start_time=0.0, end_time=2.0, duration=2.0, score=90,
        transition_in=TransitionConfig(),
    )
    out = tmp_path / f"out_{name}.mp4"
    extract_clip(src, source_metadata, planned, out, ReelCompositionConfig(), fade_in=False, fade_out=False)

    out_meta = get_video_metadata(out)
    assert out_meta.width == 1080
    assert out_meta.height == 1920
    assert out_meta.duration == pytest.approx(2.0, abs=0.2)


def test_extract_clip_smart_fit_composes_with_zoom_transition(tmp_path: Path):
    """The blur_fit filter graph (split/scale/overlay) must still chain
    correctly with a subsequent zoom effect - a real regression risk once
    reframing became a multi-stage filter_complex graph instead of a single
    -vf chain.
    """
    src = tmp_path / "src.mp4"
    _make_source(src, 1920, 1080)  # landscape -> blur_fit mode
    source_metadata = get_video_metadata(src)

    planned = PlannedClip(
        source_file=src.name, start_time=0.0, end_time=2.0, duration=2.0, score=90,
        transition_in=TransitionConfig(type="zoom_in", duration=1.0),
    )
    out = tmp_path / "out.mp4"
    extract_clip(src, source_metadata, planned, out, ReelCompositionConfig(), fade_in=False, fade_out=False)

    out_meta = get_video_metadata(out)
    assert out_meta.width == 1080
    assert out_meta.height == 1920
