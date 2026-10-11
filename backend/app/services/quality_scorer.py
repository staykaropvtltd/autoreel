"""Deterministic, configurable clip scoring.

    FinalScore (0-100) =
          35% visual_quality_score   sharpness, penalized by dark-frame ratio
        + 25% motion_score           bell curve around a natural handheld/product-shot motion band
        + 20% exposure_score         brightness closeness to a well-lit midtone band
        + 10% usability_score        duration suitability + dark-frame penalty
        + 10% uniqueness_score       perceptual-hash distance to the closest other clip

All sub-scores are normalized to 0-100 before combining so the weights are
directly interpretable as percentage contributions.
"""

from dataclasses import dataclass

from app.schemas.analysis import ClipScore, QualityMetrics, VideoSegment

WEIGHT_VISUAL_QUALITY = 0.35
WEIGHT_MOTION = 0.25
WEIGHT_EXPOSURE = 0.20
WEIGHT_USABILITY = 0.10
WEIGHT_UNIQUENESS = 0.10


@dataclass
class ScoringThresholds:
    sharpness_low: float = 30.0
    sharpness_high: float = 600.0
    sharpness_reject_floor: float = 12.0

    brightness_floor: float = 20.0
    brightness_ideal_low: float = 80.0
    brightness_ideal_high: float = 190.0
    brightness_ceiling: float = 245.0

    motion_ideal_low: float = 4.0
    motion_ideal_high: float = 35.0
    motion_ceiling: float = 80.0

    ideal_duration_low: float = 1.5
    ideal_duration_high: float = 12.0
    duration_ceiling: float = 30.0

    dark_ratio_penalty_threshold: float = 0.3
    dark_ratio_reject_threshold: float = 0.6

    reject_score_threshold: float = 35.0

    uniqueness_full_score_distance: int = 16
    duplicate_distance_threshold: int = 5


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def ramp_score(value: float, low: float, high: float) -> float:
    """0 at/below `low`, 100 at/above `high`, linear in between."""
    if high <= low:
        return 100.0 if value >= high else 0.0
    return clamp((value - low) / (high - low) * 100.0)


def trapezoid_score(value: float, floor: float, ideal_low: float, ideal_high: float, ceiling: float) -> float:
    """0 at/below `floor` and at/above `ceiling`, 100 within [ideal_low, ideal_high],
    linear ramps in between.
    """
    if value <= floor or value >= ceiling:
        return 0.0
    if ideal_low <= value <= ideal_high:
        return 100.0
    if value < ideal_low:
        return clamp((value - floor) / (ideal_low - floor) * 100.0)
    return clamp((ceiling - value) / (ceiling - ideal_high) * 100.0)


def sharpness_score(avg_sharpness: float, t: ScoringThresholds) -> float:
    return ramp_score(avg_sharpness, t.sharpness_low, t.sharpness_high)


def exposure_score(avg_brightness: float, t: ScoringThresholds) -> float:
    return trapezoid_score(
        avg_brightness, t.brightness_floor, t.brightness_ideal_low, t.brightness_ideal_high, t.brightness_ceiling
    )


def motion_score(avg_motion: float, t: ScoringThresholds) -> float:
    return trapezoid_score(avg_motion, 0.0, t.motion_ideal_low, t.motion_ideal_high, t.motion_ceiling)


def visual_quality_score(metrics: QualityMetrics, t: ScoringThresholds) -> float:
    base = sharpness_score(metrics.avg_sharpness, t)
    # Intermittent dark/black frames degrade usable visual quality beyond
    # what the average sharpness/brightness alone would suggest.
    dark_penalty = min(metrics.dark_frame_ratio / t.dark_ratio_reject_threshold, 1.0) * 0.5
    return clamp(base * (1.0 - dark_penalty))


def usability_score(segment: VideoSegment, metrics: QualityMetrics, t: ScoringThresholds) -> float:
    duration_component = trapezoid_score(
        segment.duration, 0.0, t.ideal_duration_low, t.ideal_duration_high, t.duration_ceiling
    )
    darkness_component = clamp((1.0 - metrics.dark_frame_ratio) * 100.0)
    return clamp(0.5 * duration_component + 0.5 * darkness_component)


def build_reasons(
    metrics: QualityMetrics,
    sharpness: float,
    exposure: float,
    motion: float,
    uniqueness: float,
    is_duplicate: bool,
    t: ScoringThresholds,
) -> list[str]:
    reasons: list[str] = []

    if sharpness >= 70:
        reasons.append("Good sharpness")
    elif sharpness < 40:
        reasons.append("Low sharpness")

    if exposure >= 70:
        reasons.append("Good exposure")
    elif metrics.avg_brightness < t.brightness_ideal_low:
        reasons.append("Too dark")
    elif metrics.avg_brightness > t.brightness_ideal_high:
        reasons.append("Too bright")

    if metrics.avg_motion < t.motion_ideal_low:
        reasons.append("Very low motion")
    elif metrics.avg_motion > t.motion_ideal_high:
        reasons.append("Excessive motion/shake")
    elif motion >= 70:
        reasons.append("Moderate motion")

    if metrics.dark_frame_ratio >= t.dark_ratio_penalty_threshold:
        reasons.append("Contains dark/underexposed frames")
    else:
        reasons.append("No significant dark frames")

    if is_duplicate:
        reasons.append("Highly similar to another clip")
    elif uniqueness >= 70:
        reasons.append("Visually distinct")

    return reasons


def score_clip(
    segment: VideoSegment,
    metrics: QualityMetrics,
    uniqueness: float,
    is_duplicate: bool,
    thresholds: ScoringThresholds | None = None,
) -> ClipScore:
    t = thresholds or ScoringThresholds()

    sharpness = sharpness_score(metrics.avg_sharpness, t)
    exposure = exposure_score(metrics.avg_brightness, t)
    motion = motion_score(metrics.avg_motion, t)
    visual_quality = visual_quality_score(metrics, t)
    usability = usability_score(segment, metrics, t)

    final_score = (
        WEIGHT_VISUAL_QUALITY * visual_quality
        + WEIGHT_MOTION * motion
        + WEIGHT_EXPOSURE * exposure
        + WEIGHT_USABILITY * usability
        + WEIGHT_UNIQUENESS * uniqueness
    )

    reasons = build_reasons(metrics, sharpness, exposure, motion, uniqueness, is_duplicate, t)

    return ClipScore(
        score=round(clamp(final_score)),
        visual_quality_score=round(visual_quality, 2),
        motion_score=round(motion, 2),
        exposure_score=round(exposure, 2),
        usability_score=round(usability, 2),
        uniqueness_score=round(uniqueness, 2),
        reasons=reasons,
    )
