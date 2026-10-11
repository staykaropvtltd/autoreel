from pathlib import Path

import numpy as np

from app.schemas.analysis import VideoSegment
from app.services.frame_analyzer import (
    analyze_segment,
    compute_average_hash,
    sample_timestamps,
)


def test_sample_timestamps_respects_rate_and_bounds():
    timestamps = sample_timestamps(0.0, 2.0, sample_fps=2.0)

    assert timestamps[0] == 0.0
    assert all(0.0 <= t < 2.0 for t in timestamps)
    assert len(timestamps) == 4


def test_sample_timestamps_always_returns_at_least_one():
    timestamps = sample_timestamps(5.0, 5.05, sample_fps=2.0)

    assert timestamps == [5.0]


def test_compute_average_hash_identical_frames_match():
    frame = np.full((100, 100), 128, dtype=np.uint8)

    assert compute_average_hash(frame) == compute_average_hash(frame.copy())


def test_compute_average_hash_distinguishes_different_patterns():
    # Split-orientation matters: an average hash can't tell two flat colors
    # apart (every pixel equals the average), so use frames with spatial
    # structure that differs between them.
    left_dark_right_light = np.zeros((64, 64), dtype=np.uint8)
    left_dark_right_light[:, 32:] = 255

    top_dark_bottom_light = np.zeros((64, 64), dtype=np.uint8)
    top_dark_bottom_light[32:, :] = 255

    hash_a = compute_average_hash(left_dark_right_light)
    hash_b = compute_average_hash(top_dark_bottom_light)

    assert bin(hash_a ^ hash_b).count("1") > 0


def test_analyze_segment_returns_sane_metrics(synthetic_video_with_audio: Path):
    segment = VideoSegment(source_file=synthetic_video_with_audio.name, start_time=0.0, end_time=1.0, duration=1.0)

    analysis = analyze_segment(synthetic_video_with_audio, segment, sample_fps=2.0)

    assert analysis.metrics.sampled_frame_count > 0
    assert analysis.metrics.avg_sharpness >= 0.0
    assert 0.0 <= analysis.metrics.avg_brightness <= 255.0
    assert 0.0 <= analysis.metrics.dark_frame_ratio <= 1.0
    assert analysis.metrics.avg_motion >= 0.0
    assert isinstance(analysis.perceptual_hash, int)


def test_analyze_segment_detects_darkness(synthetic_dark_video: Path):
    segment = VideoSegment(source_file=synthetic_dark_video.name, start_time=0.0, end_time=1.0, duration=1.0)

    analysis = analyze_segment(synthetic_dark_video, segment, sample_fps=2.0)

    assert analysis.metrics.avg_brightness < 20.0
    assert analysis.metrics.dark_frame_ratio == 1.0
