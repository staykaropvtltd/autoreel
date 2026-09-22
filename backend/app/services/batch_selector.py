"""Batch-level best-clip selection across an entire raw-footage upload.

Pipeline:

    multiple per-video Phase 3 AnalysisResult
        -> aggregate all analyzed clips
        -> cross-file similarity analysis (reuses Phase 3's perceptual hash)
        -> remove redundant (near-duplicate) clips, keeping the higher score
        -> quality filtering (reuses Phase 3 scores/accept flags; no re-scoring)
        -> diversity-aware ranking
        -> best clips

This module does not decode any video frames or recompute quality metrics —
it only consumes the AnalyzedClip objects already produced by
app.services.clip_selector.analyze_video, so batch selection stays fast
regardless of how many videos are in the shoot.

Similarity thresholds (hamming distance out of a 64-bit average hash, same
scheme as Phase 3):
  - duplicate_distance_threshold: near-identical takes / repeated shots ->
    hard-rejected, keeping only the higher-scoring one.
  - diversity_distance_threshold: looser than the duplicate threshold. Used
    only during final selection to avoid picking two clips that are visually
    similar-but-not-identical (e.g. two very similar front-view takes) ahead
    of a genuinely different angle, without permanently rejecting either.
"""

import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from app.schemas.analysis import AnalysisResult, AnalyzedClip
from app.schemas.batch import BatchAnalysisResult, BatchClip, SelectionStatus
from app.services.clip_selector import analyze_video
from app.services.similarity_analyzer import hamming_distance

DEFAULT_MIN_SCORE = 60.0
DEFAULT_DUPLICATE_DISTANCE_THRESHOLD = 5
DEFAULT_DIVERSITY_DISTANCE_THRESHOLD = 12
DEFAULT_MAX_CLIPS = 6
DEFAULT_MIN_TOTAL_DURATION = 0.0
DEFAULT_MAX_TOTAL_DURATION = 60.0


@dataclass
class BatchSelectionConfig:
    min_score: float = DEFAULT_MIN_SCORE
    duplicate_distance_threshold: int = DEFAULT_DUPLICATE_DISTANCE_THRESHOLD
    diversity_distance_threshold: int = DEFAULT_DIVERSITY_DISTANCE_THRESHOLD
    max_clips: int = DEFAULT_MAX_CLIPS
    min_total_duration: float = DEFAULT_MIN_TOTAL_DURATION
    max_total_duration: float = DEFAULT_MAX_TOTAL_DURATION


_Candidate = tuple[AnalyzedClip, int]


def clip_key(source_file: str, start_time: float) -> str:
    return f"{source_file}@{start_time:.2f}"


def _to_batch_clip(
    clip: AnalyzedClip,
    status: SelectionStatus,
    selected: bool,
    duplicate_of: str | None = None,
    closest_neighbor_distance: int | None = None,
) -> BatchClip:
    return BatchClip(
        source_file=clip.segment.source_file,
        start_time=clip.segment.start_time,
        end_time=clip.segment.end_time,
        duration=clip.segment.duration,
        score=clip.score.score,
        metrics=clip.metrics,
        reasons=clip.score.reasons,
        perceptual_hash=clip.perceptual_hash,
        status=status,
        selected=selected,
        locked=False,
        duplicate_of=duplicate_of,
        closest_neighbor_distance=closest_neighbor_distance,
    )


def aggregate_clips(analyzed_videos: list[AnalysisResult]) -> list[_Candidate]:
    """Flattens clips from multiple per-video Phase 3 results into one list,
    pairing each clip with its perceptual hash as an int for comparison.
    """
    return [
        (clip, int(clip.perceptual_hash, 16))
        for video_result in analyzed_videos
        for clip in video_result.clips
    ]


def _nearest_neighbor_distances(candidates: list[_Candidate]) -> dict[str, int]:
    distances: dict[str, int] = {}
    n = len(candidates)
    for i in range(n):
        clip_i, hash_i = candidates[i]
        if n <= 1:
            continue
        min_distance = min(
            hamming_distance(hash_i, candidates[j][1]) for j in range(n) if j != i
        )
        distances[clip_key(clip_i.segment.source_file, clip_i.segment.start_time)] = min_distance
    return distances


def filter_quality_candidates(
    aggregated: list[_Candidate], min_score: float
) -> tuple[list[_Candidate], list[BatchClip]]:
    """Reuses Phase 3's accept flag and score - no re-analysis. Clips that
    already failed Phase 3's hard gates, or fall below the batch-level
    min_score, are finalized here as REJECTED_LOW_QUALITY.
    """
    candidates: list[_Candidate] = []
    rejected: list[BatchClip] = []

    for clip, hash_int in aggregated:
        if not clip.accepted or clip.score.score < min_score:
            rejected.append(_to_batch_clip(clip, SelectionStatus.REJECTED_LOW_QUALITY, selected=False))
        else:
            candidates.append((clip, hash_int))

    return candidates, rejected


def remove_cross_file_duplicates(
    candidates: list[_Candidate], duplicate_distance_threshold: int
) -> tuple[list[_Candidate], list[BatchClip]]:
    """Greedy keep-the-best: processes candidates best-score-first, keeping a
    clip only if it isn't a near-duplicate (by perceptual hash) of a clip
    already kept - regardless of which source file either came from.
    """
    sorted_candidates = sorted(candidates, key=lambda pair: pair[0].score.score, reverse=True)
    kept: list[_Candidate] = []
    rejected: list[BatchClip] = []

    for clip, hash_int in sorted_candidates:
        match = next(
            (k for k in kept if hamming_distance(hash_int, k[1]) <= duplicate_distance_threshold),
            None,
        )
        if match is None:
            kept.append((clip, hash_int))
            continue

        kept_clip, kept_hash = match
        rejected.append(
            _to_batch_clip(
                clip,
                SelectionStatus.REJECTED_DUPLICATE,
                selected=False,
                duplicate_of=clip_key(kept_clip.segment.source_file, kept_clip.segment.start_time),
                closest_neighbor_distance=hamming_distance(hash_int, kept_hash),
            )
        )

    return kept, rejected


def select_diverse_clips(
    unique_candidates: list[_Candidate], config: BatchSelectionConfig
) -> tuple[list[BatchClip], list[BatchClip]]:
    """Deterministic greedy diversity selection (a simple MMR variant, no ML):
    best-score-first, skipping clips too visually similar to one already
    selected. If the diverse pass doesn't fill max_clips or reach
    min_total_duration, backfills from the deferred (redundant-but-decent)
    pool best-score-first - a slightly repetitive reel beats an under-length
    one.
    """
    sorted_candidates = sorted(unique_candidates, key=lambda pair: pair[0].score.score, reverse=True)
    selected: list[_Candidate] = []
    deferred: list[_Candidate] = []

    def total_duration() -> float:
        return sum(c.segment.duration for c, _ in selected)

    for clip, hash_int in sorted_candidates:
        if len(selected) >= config.max_clips:
            deferred.append((clip, hash_int))
            continue
        if selected and total_duration() + clip.segment.duration > config.max_total_duration:
            deferred.append((clip, hash_int))
            continue
        is_redundant = any(
            hamming_distance(hash_int, s_hash) <= config.diversity_distance_threshold
            for _, s_hash in selected
        )
        if is_redundant:
            deferred.append((clip, hash_int))
            continue
        selected.append((clip, hash_int))

    for clip, hash_int in sorted(deferred, key=lambda pair: pair[0].score.score, reverse=True):
        if len(selected) >= config.max_clips:
            break
        if total_duration() >= config.min_total_duration:
            break
        if total_duration() + clip.segment.duration > config.max_total_duration:
            continue
        selected.append((clip, hash_int))
        deferred.remove((clip, hash_int))

    selected_batch_clips = [
        _to_batch_clip(clip, SelectionStatus.SELECTED, selected=True) for clip, _ in selected
    ]
    not_selected_batch_clips = [
        _to_batch_clip(clip, SelectionStatus.REJECTED_NOT_SELECTED, selected=False)
        for clip, _ in deferred
    ]
    return selected_batch_clips, not_selected_batch_clips


def _apply_neighbor_distances(clips: list[BatchClip], distances: dict[str, int]) -> None:
    for clip in clips:
        distance = distances.get(clip_key(clip.source_file, clip.start_time))
        if distance is not None and clip.closest_neighbor_distance is None:
            clip.closest_neighbor_distance = distance


def select_best_clips(
    analyzed_videos: list[AnalysisResult], config: BatchSelectionConfig | None = None
) -> BatchAnalysisResult:
    config = config or BatchSelectionConfig()
    start = time.perf_counter()

    aggregated = aggregate_clips(analyzed_videos)
    total_segments = len(aggregated)

    quality_candidates, quality_rejected = filter_quality_candidates(aggregated, config.min_score)
    accepted_before_dedupe = len(quality_candidates)
    neighbor_distances = _nearest_neighbor_distances(quality_candidates)

    unique_candidates, duplicate_rejected = remove_cross_file_duplicates(
        quality_candidates, config.duplicate_distance_threshold
    )
    duplicates_removed = len(duplicate_rejected)

    selected_clips, not_selected_clips = select_diverse_clips(unique_candidates, config)

    if not selected_clips and aggregated:
        best_candidate_pair = max(aggregated, key=lambda pair: pair[0].score.score)
        fallback_clip = _to_batch_clip(best_candidate_pair[0], SelectionStatus.SELECTED, selected=True)
        selected_clips = [fallback_clip]
        quality_rejected = [
            c for c in quality_rejected
            if not (c.source_file == fallback_clip.source_file and abs(c.start_time - fallback_clip.start_time) < 1e-4)
        ]
        duplicate_rejected = [
            c for c in duplicate_rejected
            if not (c.source_file == fallback_clip.source_file and abs(c.start_time - fallback_clip.start_time) < 1e-4)
        ]

    _apply_neighbor_distances(selected_clips, neighbor_distances)
    _apply_neighbor_distances(not_selected_clips, neighbor_distances)

    all_clips = sorted(
        selected_clips + not_selected_clips + duplicate_rejected + quality_rejected,
        key=lambda c: c.score,
        reverse=True,
    )
    selected_clips_sorted = sorted(selected_clips, key=lambda c: c.score, reverse=True)

    processing_time_seconds = round(time.perf_counter() - start, 3)

    return BatchAnalysisResult(
        batch_id=str(uuid.uuid4()),
        input_video_count=len(analyzed_videos),
        total_segments=total_segments,
        accepted_before_dedupe=accepted_before_dedupe,
        duplicates_removed=duplicates_removed,
        final_selected_count=len(selected_clips_sorted),
        processing_time_seconds=processing_time_seconds,
        selected_clips=selected_clips_sorted,
        all_clips=all_clips,
    )


def analyze_and_select_batch(
    video_paths: list[str | Path],
    analyze_kwargs: dict | None = None,
    selection_config: BatchSelectionConfig | None = None,
) -> tuple[list[AnalysisResult], BatchAnalysisResult]:
    """Convenience wrapper for a full raw-footage upload: runs Phase 3
    per-video analysis (the only step that decodes frames) and feeds the
    results into Phase 4 batch selection. Returns both so callers/tests can
    inspect per-video timing separately from the (fast, metadata-only)
    batch-selection timing.
    """
    analyze_kwargs = analyze_kwargs or {}
    per_video_results = [analyze_video(path, **analyze_kwargs) for path in video_paths]
    batch_result = select_best_clips(per_video_results, selection_config)
    return per_video_results, batch_result
