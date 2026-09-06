"""Deterministic, rule-based shot-role classification.

No deep learning / subject detection - roles are inferred purely from
signals Phase 3/4 already computed (score, sharpness, motion, duration,
temporal position within its source file, perceptual-hash uniqueness).
Each candidate's stats are ranked as a percentile against the rest of the
candidate pool, then a fixed rule table (evaluated top to bottom, first
match wins) assigns a role and a confidence in [0, 1]. Confidence reflects
how strongly the signals matched the rule, not a probability from a model -
low-confidence / no-match candidates are labeled UNKNOWN rather than
guessed.
"""

from statistics import median

from app.schemas.batch import BatchClip
from app.schemas.story import ClassifiedClip, ShotRole


def _percentile_rank(value: float, values: list[float]) -> float:
    if not values:
        return 0.5
    less_equal = sum(1 for v in values if v <= value)
    return less_equal / len(values)


def _classify_single(
    clip: BatchClip,
    motion_pct: float,
    duration_pct: float,
    score_pct: float,
    uniqueness_pct: float,
    is_last_in_source: bool,
    median_sharpness: float,
) -> tuple[ShotRole, float]:
    if score_pct >= 0.9 and 0.3 <= motion_pct <= 0.8:
        return ShotRole.HERO, min(1.0, 0.5 + 0.5 * score_pct)
    if is_last_in_source and score_pct >= 0.5:
        return ShotRole.ENDING, min(1.0, 0.4 + 0.4 * score_pct)
    if motion_pct >= 0.75:
        return ShotRole.MOVEMENT, min(1.0, 0.4 + 0.5 * motion_pct)
    if duration_pct <= 0.25 and clip.metrics.avg_sharpness > median_sharpness:
        return ShotRole.DETAIL, min(1.0, 0.4 + 0.4 * (1 - duration_pct))
    if duration_pct >= 0.75 and motion_pct <= 0.5:
        return ShotRole.FULL_VIEW, min(1.0, 0.4 + 0.4 * duration_pct)
    if uniqueness_pct >= 0.75:
        return ShotRole.SIDE_VIEW, min(1.0, 0.35 + 0.4 * uniqueness_pct)
    if score_pct >= 0.6 and motion_pct <= 0.4:
        return ShotRole.PRODUCT_SHOWCASE, min(1.0, 0.35 + 0.4 * score_pct)
    return ShotRole.UNKNOWN, 0.2


def classify_clips(candidates: list[BatchClip]) -> list[ClassifiedClip]:
    if not candidates:
        return []

    motions = [c.metrics.avg_motion for c in candidates]
    durations = [c.duration for c in candidates]
    scores = [c.score for c in candidates]
    sharpnesses = [c.metrics.avg_sharpness for c in candidates]
    distances = [c.closest_neighbor_distance for c in candidates if c.closest_neighbor_distance is not None]

    median_sharpness = median(sharpnesses)

    by_source: dict[str, list[BatchClip]] = {}
    for clip in candidates:
        by_source.setdefault(clip.source_file, []).append(clip)
    last_in_source = [max(clips, key=lambda c: c.start_time) for clips in by_source.values()]

    results = []
    for clip in candidates:
        motion_pct = _percentile_rank(clip.metrics.avg_motion, motions)
        duration_pct = _percentile_rank(clip.duration, durations)
        score_pct = _percentile_rank(clip.score, scores)
        uniqueness_pct = (
            _percentile_rank(clip.closest_neighbor_distance, distances)
            if clip.closest_neighbor_distance is not None and distances
            else 0.5
        )
        is_last_in_source = clip in last_in_source

        role, confidence = _classify_single(
            clip, motion_pct, duration_pct, score_pct, uniqueness_pct, is_last_in_source, median_sharpness
        )
        results.append(ClassifiedClip(clip=clip, shot_role=role, role_confidence=round(confidence, 2)))

    return results
