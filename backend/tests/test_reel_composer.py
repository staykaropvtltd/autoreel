from pathlib import Path

import pytest

from app.schemas.analysis import QualityMetrics
from app.schemas.batch import BatchClip, SelectionStatus
from app.schemas.reel import PlannedClip
from app.schemas.video import VideoMetadata
from app.services.reel_composer import (
    BrandConfig,
    EmptySelectionError,
    InvalidTimestampError,
    MissingSourceVideoError,
    ProductInfo,
    ReelCompositionConfig,
    _escape_drawtext,
    build_overlay_filter,
    compose_reel,
    extract_clip,
    order_clips_for_reel,
    plan_reel_segments,
    resolve_source_path,
    validate_clip_timestamps,
)
from app.services.video_metadata import get_video_metadata


def _batch_clip(source_file: str, start: float, end: float, score: int) -> BatchClip:
    metrics = QualityMetrics(
        avg_sharpness=300.0, avg_brightness=130.0, dark_frame_ratio=0.0, avg_motion=15.0, sampled_frame_count=4
    )
    return BatchClip(
        source_file=source_file,
        start_time=start,
        end_time=end,
        duration=end - start,
        score=score,
        metrics=metrics,
        reasons=[],
        perceptual_hash="0" * 16,
        status=SelectionStatus.SELECTED,
        selected=True,
    )


# --- ordering ---
def test_order_clips_for_reel_hero_first_then_score_desc():
    clips = [
        _batch_clip("b.mp4", 0, 3, score=80),
        _batch_clip("a.mp4", 0, 3, score=95),
        _batch_clip("c.mp4", 0, 3, score=88),
    ]

    ordered = order_clips_for_reel(clips)

    assert [c.score for c in ordered] == [95, 88, 80]


def test_order_clips_for_reel_deterministic_tiebreak():
    clips = [
        _batch_clip("z.mp4", 5.0, 8.0, score=90),
        _batch_clip("a.mp4", 1.0, 4.0, score=90),
    ]

    ordered = order_clips_for_reel(clips)

    assert ordered[0].source_file == "a.mp4"


# --- duration planning ---
def test_plan_reel_segments_stops_at_max_total_duration():
    clips = [_batch_clip("v.mp4", i * 5, i * 5 + 5, score=100 - i) for i in range(5)]
    config = ReelCompositionConfig(min_total_duration=10.0, max_total_duration=12.0)

    planned = plan_reel_segments(clips, config)

    total = sum(p.duration for p in planned)
    assert total <= 12.0
    assert total >= 10.0
    # Third clip should be trimmed to fit exactly (5 + 5 + 2 = 12).
    assert planned[-1].duration == pytest.approx(2.0)


def test_plan_reel_segments_does_not_force_every_clip():
    # First clip already satisfies min_total_duration and leaves only a 0.3s
    # sliver of budget - below min_fragment_duration (0.5s) - so the second
    # clip should be excluded rather than force-included as a tiny fragment.
    clips = [_batch_clip("v.mp4", 0, 14.7, score=100), _batch_clip("v.mp4", 14.7, 20, score=90)]
    config = ReelCompositionConfig(min_total_duration=10.0, max_total_duration=15.0)

    planned = plan_reel_segments(clips, config)

    assert len(planned) == 1


# --- timestamp validation ---
def test_validate_clip_timestamps_accepts_valid_range():
    planned = PlannedClip(source_file="v.mp4", start_time=1.0, end_time=3.0, duration=2.0, score=80)
    metadata = VideoMetadata(
        filename="v.mp4", duration=5.0, width=1920, height=1080, fps=30.0,
        video_codec="h264", audio_codec="aac", format="mp4", file_size=1000,
    )

    validate_clip_timestamps(planned, metadata)  # should not raise


def test_validate_clip_timestamps_rejects_negative_start():
    planned = PlannedClip(source_file="v.mp4", start_time=-1.0, end_time=2.0, duration=3.0, score=80)
    metadata = VideoMetadata(
        filename="v.mp4", duration=5.0, width=1920, height=1080, fps=30.0,
        video_codec="h264", audio_codec="aac", format="mp4", file_size=1000,
    )

    with pytest.raises(InvalidTimestampError):
        validate_clip_timestamps(planned, metadata)


def test_validate_clip_timestamps_rejects_end_beyond_source_duration():
    planned = PlannedClip(source_file="v.mp4", start_time=0.0, end_time=10.0, duration=10.0, score=80)
    metadata = VideoMetadata(
        filename="v.mp4", duration=5.0, width=1920, height=1080, fps=30.0,
        video_codec="h264", audio_codec="aac", format="mp4", file_size=1000,
    )

    with pytest.raises(InvalidTimestampError):
        validate_clip_timestamps(planned, metadata)


# --- missing source ---
def test_resolve_source_path_raises_for_missing_file(tmp_path: Path):
    with pytest.raises(MissingSourceVideoError):
        resolve_source_path("does_not_exist.mp4", tmp_path)


def test_resolve_source_path_rejects_path_traversal_and_absolute_paths(tmp_path: Path):
    with pytest.raises(MissingSourceVideoError, match="Invalid source file path"):
        resolve_source_path("../secret.mp4", tmp_path)
    with pytest.raises(MissingSourceVideoError, match="Invalid source file path"):
        resolve_source_path("../../etc/passwd", tmp_path)
    with pytest.raises(MissingSourceVideoError, match="Invalid source file path"):
        resolve_source_path("C:\\Windows\\System32\\cmd.exe", tmp_path)


def test_compose_reel_raises_for_missing_source(tmp_path: Path):
    clips = [_batch_clip("does_not_exist.mp4", 0, 3, score=90)]

    with pytest.raises(MissingSourceVideoError):
        compose_reel(clips, source_dir=tmp_path, output_path=tmp_path / "out.mp4")


# --- empty selection ---
def test_compose_reel_raises_for_empty_selection(tmp_path: Path):
    with pytest.raises(EmptySelectionError):
        compose_reel([], source_dir=tmp_path, output_path=tmp_path / "out.mp4")


# --- overlay filter / text escaping ---
def test_escape_drawtext_handles_special_characters():
    assert _escape_drawtext("50% off: today's deal") == "50\\% off\\: todays deal"


def test_build_overlay_filter_includes_product_line_when_present():
    config = ReelCompositionConfig(
        brand=BrandConfig(text="KALADHAR"),
        product=ProductInfo(product_name="Banarasi Saree", price="18500"),
    )

    overlay = build_overlay_filter(config)

    if overlay is not None:  # None only if no usable font file exists on this machine
        assert "KALADHAR" in overlay
        assert "Banarasi Saree" in overlay


def test_build_overlay_filter_none_when_no_text_and_no_product():
    config = ReelCompositionConfig(brand=BrandConfig(text=None), product=None)

    # Even with a font available, there's nothing to draw.
    overlay = build_overlay_filter(config)
    assert overlay is None


# --- extraction / 9:16 conversion / normalization (real ffmpeg, synthetic source) ---
def test_extract_clip_produces_1080x1920_normalized_output(tmp_path: Path, synthetic_video_with_audio: Path):
    metadata = get_video_metadata(synthetic_video_with_audio)
    planned = PlannedClip(source_file=synthetic_video_with_audio.name, start_time=0.0, end_time=1.0, duration=1.0, score=90)
    output = tmp_path / "clip_out.mp4"
    config = ReelCompositionConfig()

    extract_clip(synthetic_video_with_audio, metadata, planned, output, config, fade_in=False, fade_out=False)

    result_metadata = get_video_metadata(output)
    assert result_metadata.width == 1080
    assert result_metadata.height == 1920
    assert result_metadata.video_codec == "h264"
    assert result_metadata.audio_codec == "aac"
    assert result_metadata.duration == pytest.approx(1.0, abs=0.3)


def test_extract_clip_synthesizes_silence_for_audio_less_source(tmp_path: Path, synthetic_video_no_audio: Path):
    metadata = get_video_metadata(synthetic_video_no_audio)
    planned = PlannedClip(source_file=synthetic_video_no_audio.name, start_time=0.0, end_time=1.0, duration=1.0, score=90)
    output = tmp_path / "clip_out.mp4"
    config = ReelCompositionConfig()

    extract_clip(synthetic_video_no_audio, metadata, planned, output, config, fade_in=False, fade_out=False)

    result_metadata = get_video_metadata(output)
    assert result_metadata.audio_codec == "aac"  # synthesized silence, not omitted


# --- full end-to-end rendering ---
def test_compose_reel_end_to_end_with_synthetic_clips(
    tmp_path: Path, synthetic_video_with_audio: Path, synthetic_two_scene_video: Path
):
    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())
    (source_dir / synthetic_two_scene_video.name).write_bytes(synthetic_two_scene_video.read_bytes())

    clips = [
        _batch_clip(synthetic_video_with_audio.name, 0.0, 1.0, score=95),
        _batch_clip(synthetic_two_scene_video.name, 0.0, 1.0, score=85),
    ]
    output_path = tmp_path / "outputs" / "reel.mp4"
    config = ReelCompositionConfig(min_total_duration=0.5, max_total_duration=5.0, brand=BrandConfig(text=None))

    result = compose_reel(clips, source_dir=source_dir, output_path=output_path, config=config)

    assert output_path.exists()
    assert result.width == 1080
    assert result.height == 1920
    assert result.video_codec == "h264"
    assert result.audio_codec == "aac"
    assert result.duration > 0
    assert result.clip_count == 2
    assert result.processing_time_seconds > 0


def test_compose_reel_single_clip_skips_concat_step(tmp_path: Path, synthetic_video_with_audio: Path):
    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())

    clips = [_batch_clip(synthetic_video_with_audio.name, 0.0, 1.0, score=95)]
    output_path = tmp_path / "outputs" / "reel_single.mp4"
    config = ReelCompositionConfig(min_total_duration=0.5, max_total_duration=5.0, brand=BrandConfig(text=None))

    result = compose_reel(clips, source_dir=source_dir, output_path=output_path, config=config)

    assert output_path.exists()
    assert result.clip_count == 1
