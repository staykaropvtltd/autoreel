from pathlib import Path

from app.schemas.analysis import AnalysisResult, AnalyzedClip, ClipScore, QualityMetrics, VideoSegment
from app.schemas.batch import BatchClip, SelectionStatus
from app.services.batch_selector import (
    BatchSelectionConfig,
    aggregate_clips,
    analyze_and_select_batch,
    filter_quality_candidates,
    remove_cross_file_duplicates,
    select_best_clips,
    select_diverse_clips,
)


def _analyzed_clip(
    source_file: str,
    start: float,
    end: float,
    score: int,
    accepted: bool = True,
    hash_int: int = 0,
) -> AnalyzedClip:
    segment = VideoSegment(source_file=source_file, start_time=start, end_time=end, duration=end - start)
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
        segment=segment,
        metrics=metrics,
        score=clip_score,
        accepted=accepted,
        perceptual_hash=format(hash_int, "016x"),
    )


def _analysis_result(source: str, clips: list[AnalyzedClip]) -> AnalysisResult:
    return AnalysisResult(
        source=source,
        processing_time_seconds=1.0,
        total_segments_detected=len(clips),
        accepted_count=sum(1 for c in clips if c.accepted),
        rejected_count=sum(1 for c in clips if not c.accepted),
        clips=clips,
    )


# 1. Aggregating multiple video analysis results
def test_aggregate_clips_combines_multiple_videos():
    video1 = _analysis_result("video_01.mp4", [_analyzed_clip("video_01.mp4", 0, 2, score=90)])
    video2 = _analysis_result("video_02.mp4", [_analyzed_clip("video_02.mp4", 0, 2, score=80, hash_int=1)])

    aggregated = aggregate_clips([video1, video2])

    assert len(aggregated) == 2
    assert {clip.segment.source_file for clip, _ in aggregated} == {"video_01.mp4", "video_02.mp4"}


# 5. Quality threshold filtering
def test_filter_quality_candidates_rejects_low_score_and_phase3_rejected():
    good = _analyzed_clip("v.mp4", 0, 2, score=70)
    low_score = _analyzed_clip("v.mp4", 2, 4, score=40)
    phase3_rejected = _analyzed_clip("v.mp4", 4, 6, score=90, accepted=False)

    candidates, rejected = filter_quality_candidates(
        [(good, 0), (low_score, 1), (phase3_rejected, 2)], min_score=60
    )

    assert len(candidates) == 1
    assert candidates[0][0] is good
    assert len(rejected) == 2
    assert all(r.status == SelectionStatus.REJECTED_LOW_QUALITY for r in rejected)
    assert all(r.selected is False for r in rejected)


# 2 & 3. Cross-file duplicate detection, keeping the higher-scoring duplicate
def test_remove_cross_file_duplicates_keeps_higher_scoring_clip_across_files():
    clip_a = _analyzed_clip("video_01.mp4", 0, 2, score=95, hash_int=0b0000)
    clip_b = _analyzed_clip("video_02.mp4", 0, 2, score=80, hash_int=0b0001)

    kept, rejected = remove_cross_file_duplicates([(clip_a, 0b0000), (clip_b, 0b0001)], duplicate_distance_threshold=5)

    assert len(kept) == 1
    assert kept[0][0] is clip_a
    assert len(rejected) == 1
    assert rejected[0].source_file == "video_02.mp4"
    assert rejected[0].status == SelectionStatus.REJECTED_DUPLICATE
    assert rejected[0].duplicate_of == "video_01.mp4@0.00"


# 4. Preserving genuinely different clips
def test_remove_cross_file_duplicates_preserves_genuinely_different_clips():
    front_view = _analyzed_clip("video_01.mp4", 0, 2, score=90, hash_int=0b0000_0000)
    close_up = _analyzed_clip("video_02.mp4", 0, 2, score=85, hash_int=0b1111_1111)

    kept, rejected = remove_cross_file_duplicates(
        [(front_view, 0b0000_0000), (close_up, 0b1111_1111)], duplicate_distance_threshold=5
    )

    assert len(kept) == 2
    assert rejected == []


# 6. Diversity-aware selection (the README-style A/B/C/D/E example)
def test_select_diverse_clips_prefers_diversity_over_a_near_redundant_higher_score():
    front_a = _analyzed_clip("v.mp4", 0, 3, score=96, hash_int=0b0000_0000)
    front_b = _analyzed_clip("v.mp4", 3, 6, score=95, hash_int=0b0000_0001)  # distance 1 from A: redundant
    close_up = _analyzed_clip("v.mp4", 6, 9, score=92, hash_int=0b0000_1111)  # distance 4
    side_view = _analyzed_clip("v.mp4", 9, 12, score=89, hash_int=0b1111_0000)  # distance 4
    walking = _analyzed_clip("v.mp4", 12, 15, score=87, hash_int=0b1010_1010)  # distance 4

    candidates = [
        (front_a, 0b0000_0000),
        (front_b, 0b0000_0001),
        (close_up, 0b0000_1111),
        (side_view, 0b1111_0000),
        (walking, 0b1010_1010),
    ]
    config = BatchSelectionConfig(max_clips=4, diversity_distance_threshold=3, max_total_duration=60.0)

    selected, not_selected = select_diverse_clips(candidates, config)

    selected_keys = {(c.source_file, c.start_time) for c in selected}
    assert selected_keys == {("v.mp4", 0.0), ("v.mp4", 6.0), ("v.mp4", 9.0), ("v.mp4", 12.0)}
    assert len(not_selected) == 1
    assert not_selected[0].source_file == "v.mp4" and not_selected[0].start_time == 3.0
    assert not_selected[0].status == SelectionStatus.REJECTED_NOT_SELECTED


# 7. Maximum clip count
def test_select_diverse_clips_respects_max_clips():
    candidates = [
        (_analyzed_clip("v.mp4", i * 3, i * 3 + 3, score=100 - i, hash_int=1 << i), 1 << i) for i in range(6)
    ]
    config = BatchSelectionConfig(max_clips=3, diversity_distance_threshold=0, max_total_duration=1000.0)

    selected, not_selected = select_diverse_clips(candidates, config)

    assert len(selected) == 3
    assert len(not_selected) == 3


# 8. Minimum/maximum duration constraints
def test_select_diverse_clips_respects_max_total_duration():
    candidates = [
        (_analyzed_clip("v.mp4", i * 10, i * 10 + 10, score=100 - i, hash_int=1 << i), 1 << i) for i in range(4)
    ]
    config = BatchSelectionConfig(max_clips=10, diversity_distance_threshold=0, max_total_duration=25.0)

    selected, not_selected = select_diverse_clips(candidates, config)

    total_duration = sum(c.duration for c in selected)
    assert total_duration <= 25.0
    assert len(selected) == 2
    assert len(not_selected) == 2


def test_select_diverse_clips_backfills_to_meet_min_total_duration():
    # All three clips are mutually redundant (hash distance 1), so a pure
    # diversity-only pass would keep just the first. Backfill should still
    # pull in the rest to satisfy min_total_duration.
    candidates = [
        (_analyzed_clip("v.mp4", 0, 4, score=90, hash_int=0b000), 0b000),
        (_analyzed_clip("v.mp4", 4, 8, score=85, hash_int=0b001), 0b001),
        (_analyzed_clip("v.mp4", 8, 12, score=80, hash_int=0b010), 0b010),
    ]
    config = BatchSelectionConfig(
        max_clips=10, diversity_distance_threshold=3, min_total_duration=10.0, max_total_duration=60.0
    )

    selected, not_selected = select_diverse_clips(candidates, config)

    assert sum(c.duration for c in selected) >= 10.0
    assert len(selected) == 3
    assert not_selected == []


# 9. Manual selection/lock fields
def test_batch_clip_supports_manual_override_fields():
    clip = BatchClip(
        source_file="v.mp4",
        start_time=0.0,
        end_time=2.0,
        duration=2.0,
        score=90,
        metrics=QualityMetrics(
            avg_sharpness=300.0, avg_brightness=130.0, dark_frame_ratio=0.0, avg_motion=15.0, sampled_frame_count=4
        ),
        reasons=[],
        perceptual_hash="0" * 16,
        status=SelectionStatus.SELECTED,
        selected=True,
    )

    assert clip.locked is False  # default, ready for future human-in-the-loop editing

    locked_clip = clip.model_copy(update={"locked": True, "selected": False})
    assert locked_clip.locked is True
    assert locked_clip.selected is False


# Full pipeline
def test_select_best_clips_end_to_end_with_synthetic_batch():
    video1 = _analysis_result(
        "video_01.mp4",
        [
            _analyzed_clip("video_01.mp4", 0, 4, score=90, hash_int=0b0000_0000),
            _analyzed_clip("video_01.mp4", 4, 8, score=20, accepted=False, hash_int=0b1111_0000),
        ],
    )
    video2 = _analysis_result(
        "video_02.mp4",
        [
            _analyzed_clip("video_02.mp4", 0, 3, score=88, hash_int=0b0000_0001),  # near-dup of video1 clip 1
            # Genuinely distinct: distance 64 from hash 0 clears both the
            # duplicate threshold (5) and the looser diversity threshold (12).
            _analyzed_clip("video_02.mp4", 3, 6, score=91, hash_int=0xFFFFFFFFFFFFFFFF),
        ],
    )

    result = select_best_clips([video1, video2])

    assert result.input_video_count == 2
    assert result.total_segments == 4
    assert result.accepted_before_dedupe == 3  # the accepted=False clip is excluded
    assert result.duplicates_removed == 1
    assert result.final_selected_count == 2
    assert result.processing_time_seconds >= 0

    selected_sources = {(c.source_file, c.start_time) for c in result.selected_clips}
    assert ("video_01.mp4", 0.0) in selected_sources  # higher score than its video_02 near-duplicate
    assert ("video_02.mp4", 3.0) in selected_sources
    assert len(result.all_clips) == 4


def test_analyze_and_select_batch_with_real_synthetic_videos(
    synthetic_video_with_audio: Path, synthetic_two_scene_video: Path
):
    per_video_results, batch_result = analyze_and_select_batch(
        [synthetic_video_with_audio, synthetic_two_scene_video],
        analyze_kwargs={"min_segment_duration": 0.1},
    )

    assert len(per_video_results) == 2
    assert batch_result.input_video_count == 2
    assert batch_result.total_segments == sum(r.total_segments_detected for r in per_video_results)
    assert batch_result.processing_time_seconds >= 0
