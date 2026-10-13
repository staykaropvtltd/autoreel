import time
from pathlib import Path

from app.schemas.analysis import AnalysisResult, AnalyzedClip
from app.services.frame_analyzer import DEFAULT_SAMPLE_FPS, analyze_segment
from app.services.quality_scorer import ScoringThresholds, score_clip
from app.services.scene_detector import (
    DEFAULT_MIN_SEGMENT_DURATION,
    DEFAULT_SCENE_THRESHOLD,
    detect_scenes,
)
from app.services.similarity_analyzer import _BKTree, _hash_sequence, compute_uniqueness, signature_distance


def reject_lower_scored_duplicates(
    clips: list[AnalyzedClip], hashes: list[int | tuple[int, ...]], duplicate_distance_threshold: int
) -> None:
    """Among clips that are near-duplicates of each other, keeps only the
    higher-scoring one and rejects the rest (mutates `clips` in place).
    """
    tree = _BKTree()
    indexed: list[tuple[AnalyzedClip, tuple[int, ...]]] = sorted(
        ((clip, signature) for clip, signature in zip(clips, hashes) if clip.accepted),
        key=lambda pair: (-pair[0].score.score, pair[0].segment.source_file, pair[0].segment.start_time),
    )
    for clip, signature in indexed:
        signature = _hash_sequence(signature)
        nearby = tree.within(signature, duplicate_distance_threshold * len(signature))
        if nearby:
            clip.accepted = False
            if "Duplicate of a higher-quality clip" not in clip.score.reasons:
                clip.score.reasons.append("Duplicate of a higher-quality clip")
        else:
            tree.add(signature)


def rank_analyzed_clips(clips: list[AnalyzedClip]) -> list[AnalyzedClip]:
    """Best clips first: accepted clips ranked by score, then rejected clips
    (also ranked by score) appended after for visibility.
    """
    accepted = sorted((c for c in clips if c.accepted), key=lambda c: c.score.score, reverse=True)
    rejected = sorted((c for c in clips if not c.accepted), key=lambda c: c.score.score, reverse=True)
    return accepted + rejected


def analyze_video(
    video_path: str | Path,
    sample_fps: float = DEFAULT_SAMPLE_FPS,
    scene_threshold: float = DEFAULT_SCENE_THRESHOLD,
    min_segment_duration: float = DEFAULT_MIN_SEGMENT_DURATION,
    thresholds: ScoringThresholds | None = None,
) -> AnalysisResult:
    video_path = Path(video_path)
    thresholds = thresholds or ScoringThresholds()

    start = time.perf_counter()

    segments = detect_scenes(
        video_path, threshold=scene_threshold, min_segment_duration=min_segment_duration
    )
    segment_analyses = [analyze_segment(video_path, seg, sample_fps=sample_fps) for seg in segments]
    hashes = [sa.perceptual_hashes or (sa.perceptual_hash,) for sa in segment_analyses]

    uniqueness_scores, duplicate_flags = compute_uniqueness(
        hashes,
        full_score_distance=thresholds.uniqueness_full_score_distance,
        duplicate_distance_threshold=thresholds.duplicate_distance_threshold,
    )

    clips: list[AnalyzedClip] = []
    for segment, analysis, uniqueness, is_duplicate in zip(
        segments, segment_analyses, uniqueness_scores, duplicate_flags
    ):
        clip_score = score_clip(segment, analysis.metrics, uniqueness, is_duplicate, thresholds)
        accepted = (
            analysis.metrics.dark_frame_ratio < thresholds.dark_ratio_reject_threshold
            and analysis.metrics.avg_sharpness >= thresholds.sharpness_reject_floor
            and clip_score.score >= thresholds.reject_score_threshold
        )
        clip = AnalyzedClip(
                segment=segment,
                metrics=analysis.metrics,
                score=clip_score,
                accepted=accepted,
                perceptual_hash=format(analysis.perceptual_hash, "016x"),
            )
        clip._perceptual_hashes = analysis.perceptual_hashes or (analysis.perceptual_hash,)
        clips.append(clip)

    reject_lower_scored_duplicates(
        clips, hashes, duplicate_distance_threshold=thresholds.duplicate_distance_threshold
    )
    ranked_clips = rank_analyzed_clips(clips)

    processing_time_seconds = round(time.perf_counter() - start, 3)
    accepted_count = sum(1 for c in ranked_clips if c.accepted)

    return AnalysisResult(
        source=video_path.name,
        processing_time_seconds=processing_time_seconds,
        total_segments_detected=len(segments),
        accepted_count=accepted_count,
        rejected_count=len(ranked_clips) - accepted_count,
        clips=ranked_clips,
    )
