from pathlib import Path

import pytest

from app.services.video_processor import (
    OutputValidationError,
    compute_reframe_params,
    process_video,
    validate_output,
)


def test_compute_reframe_params_landscape_covers_target_without_stretching():
    params = compute_reframe_params(1920, 1080, 1080, 1920)

    # Covers the target box on both axes (no stretching, no letterboxing).
    assert params["scale_width"] >= 1080
    assert params["scale_height"] >= 1920
    # Landscape source needs no vertical crop, only horizontal.
    assert params["crop_y"] == 0
    assert params["crop_x"] > 0
    # Scaled aspect ratio must match the source aspect ratio (within rounding).
    src_aspect = 1920 / 1080
    scaled_aspect = params["scale_width"] / params["scale_height"]
    assert scaled_aspect == pytest.approx(src_aspect, abs=0.01)


def test_compute_reframe_params_portrait_already_9_16_needs_no_crop():
    params = compute_reframe_params(1080, 1920, 1080, 1920)

    assert params["scale_width"] == 1080
    assert params["scale_height"] == 1920
    assert params["crop_x"] == 0
    assert params["crop_y"] == 0


def test_compute_reframe_params_square_source():
    params = compute_reframe_params(1000, 1000, 1080, 1920)

    assert params["scale_width"] == 1920
    assert params["scale_height"] == 1920
    assert params["crop_x"] == 420
    assert params["crop_y"] == 0


def test_validate_output_missing_file():
    with pytest.raises(OutputValidationError):
        validate_output(Path("does_not_exist.mp4"), 1080, 1920, expect_audio=False)


def test_process_video_landscape_with_audio(tmp_path: Path, synthetic_video_with_audio: Path):
    output_path = tmp_path / "output_with_audio.mp4"

    result = process_video(synthetic_video_with_audio, output_path)

    assert output_path.exists()
    assert result.output_metadata.width == 1080
    assert result.output_metadata.height == 1920
    assert result.output_metadata.video_codec == "h264"
    assert result.output_metadata.audio_codec == "aac"
    assert "mp4" in result.output_metadata.format
    assert result.output_metadata.duration > 0
    assert result.processing_time_seconds > 0


def test_process_video_without_audio_omits_audio_track(
    tmp_path: Path, synthetic_video_no_audio: Path
):
    output_path = tmp_path / "output_no_audio.mp4"

    result = process_video(synthetic_video_no_audio, output_path)

    assert result.output_metadata.width == 1080
    assert result.output_metadata.height == 1920
    assert result.output_metadata.audio_codec is None
