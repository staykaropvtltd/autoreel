from pathlib import Path

from app.schemas.analysis import VideoSegment
from app.services.scene_detector import detect_scenes, split_candidate_windows


def test_video_segment_model_shape():
    segment = VideoSegment(source_file="clip.mp4", start_time=0.0, end_time=4.5, duration=4.5)

    assert segment.source_file == "clip.mp4"
    assert segment.duration == segment.end_time - segment.start_time


def test_detect_scenes_no_cuts_returns_whole_video_as_one_segment(
    synthetic_video_with_audio: Path,
):
    segments = detect_scenes(synthetic_video_with_audio, min_segment_duration=0.1)

    assert len(segments) == 1
    assert segments[0].source_file == synthetic_video_with_audio.name
    assert segments[0].start_time == 0.0
    assert segments[0].duration > 0.0


def test_detect_scenes_finds_hard_cut(synthetic_two_scene_video: Path):
    segments = detect_scenes(synthetic_two_scene_video, min_segment_duration=0.1)

    assert len(segments) == 2
    assert segments[0].end_time == segments[1].start_time


def test_detect_scenes_filters_segments_below_min_duration(synthetic_video_with_audio: Path):
    segments = detect_scenes(synthetic_video_with_audio, min_segment_duration=100.0)

    assert segments == []


def test_long_scene_is_split_into_overlapping_planner_windows():
    segment = VideoSegment(source_file="long.mp4", start_time=0.0, end_time=20.0, duration=20.0)
    windows = split_candidate_windows(segment)

    assert [(window.start_time, window.end_time) for window in windows] == [
        (0.0, 8.0), (7.0, 15.0), (14.0, 20.0)
    ]
    assert all(window.duration > 0 for window in windows)
