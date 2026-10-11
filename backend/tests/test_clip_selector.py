from pathlib import Path

from app.schemas.analysis import AnalyzedClip, ClipScore, QualityMetrics, VideoSegment
from app.services.clip_selector import (
    analyze_video,
    rank_analyzed_clips,
    reject_lower_scored_duplicates,
)


def _clip(score: int, accepted: bool) -> AnalyzedClip:
    segment = VideoSegment(source_file="clip.mp4", start_time=0.0, end_time=2.0, duration=2.0)
    metrics = QualityMetrics(
        avg_sharpness=300.0, avg_brightness=130.0, dark_frame_ratio=0.0, avg_motion=15.0, sampled_frame_count=4
    )
    clip_score = ClipScore(
        score=score,
        visual_quality_score=score,
        motion_score=score,
        exposure_score=score,
        usability_score=score,
        uniqueness_score=score,
        reasons=[],
    )
    return AnalyzedClip(
        segment=segment, metrics=metrics, score=clip_score, accepted=accepted, perceptual_hash="0" * 16
    )


def test_rank_analyzed_clips_accepted_first_then_by_score_desc():
    clips = [
        _clip(score=50, accepted=True),
        _clip(score=90, accepted=True),
        _clip(score=99, accepted=False),
        _clip(score=20, accepted=False),
    ]

    ranked = rank_analyzed_clips(clips)

    assert [c.score.score for c in ranked] == [90, 50, 99, 20]
    assert [c.accepted for c in ranked] == [True, True, False, False]


def test_analyze_video_single_segment(synthetic_video_with_audio: Path):
    result = analyze_video(synthetic_video_with_audio, min_segment_duration=0.1)

    assert result.source == synthetic_video_with_audio.name
    assert result.processing_time_seconds > 0
    assert result.total_segments_detected == 1
    assert len(result.clips) == 1
    assert result.accepted_count + result.rejected_count == len(result.clips)


def test_analyze_video_two_scenes_are_not_flagged_as_duplicates(synthetic_two_scene_video: Path):
    result = analyze_video(synthetic_two_scene_video, min_segment_duration=0.1)

    assert result.total_segments_detected == 2
    assert len(result.clips) == 2
    for clip in result.clips:
        assert "Duplicate of a higher-quality clip" not in clip.score.reasons

    # Best clip first.
    assert result.clips[0].score.score >= result.clips[-1].score.score


def test_reject_lower_scored_duplicates_keeps_the_higher_scoring_clip():
    # Two otherwise-accepted, high-quality clips with near-identical content
    # (hamming distance 1, well within the duplicate threshold).
    high_score_clip = _clip(score=90, accepted=True)
    low_score_clip = _clip(score=60, accepted=True)
    distinct_clip = _clip(score=70, accepted=True)
    hashes = [0b0000, 0b0001, 0b1111_1111]

    reject_lower_scored_duplicates(
        [high_score_clip, low_score_clip, distinct_clip], hashes, duplicate_distance_threshold=5
    )

    assert high_score_clip.accepted is True
    assert low_score_clip.accepted is False
    assert "Duplicate of a higher-quality clip" in low_score_clip.score.reasons
    assert distinct_clip.accepted is True
    assert "Duplicate of a higher-quality clip" not in distinct_clip.score.reasons


def test_reject_lower_scored_duplicates_skips_already_rejected_clips():
    already_rejected = _clip(score=10, accepted=False)
    accepted_clip = _clip(score=95, accepted=True)
    hashes = [0b0000, 0b0000]

    reject_lower_scored_duplicates([already_rejected, accepted_clip], hashes, duplicate_distance_threshold=5)

    # The already-rejected clip is left as-is; the accepted one is untouched
    # since one side of the pair was never eligible for comparison.
    assert accepted_clip.accepted is True


def test_analyze_video_dark_clip_is_rejected(synthetic_dark_video: Path):
    result = analyze_video(synthetic_dark_video, min_segment_duration=0.1)

    assert result.accepted_count == 0
    assert result.rejected_count == 1
    assert result.clips[0].accepted is False
