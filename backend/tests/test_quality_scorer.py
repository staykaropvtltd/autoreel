from app.schemas.analysis import QualityMetrics, VideoSegment
from app.services.quality_scorer import (
    ScoringThresholds,
    exposure_score,
    motion_score,
    ramp_score,
    score_clip,
    sharpness_score,
    trapezoid_score,
)

THRESHOLDS = ScoringThresholds()


def test_ramp_score_boundaries():
    assert ramp_score(0.0, 30.0, 600.0) == 0.0
    assert ramp_score(600.0, 30.0, 600.0) == 100.0
    assert ramp_score(1000.0, 30.0, 600.0) == 100.0


def test_sharpness_score_low_and_high():
    assert sharpness_score(THRESHOLDS.sharpness_low, THRESHOLDS) == 0.0
    assert sharpness_score(THRESHOLDS.sharpness_high, THRESHOLDS) == 100.0
    assert sharpness_score(1000.0, THRESHOLDS) == 100.0


def test_trapezoid_score_ideal_band_and_extremes():
    assert trapezoid_score(50.0, 0.0, 40.0, 60.0, 100.0) == 100.0
    assert trapezoid_score(0.0, 0.0, 40.0, 60.0, 100.0) == 0.0
    assert trapezoid_score(100.0, 0.0, 40.0, 60.0, 100.0) == 0.0


def test_exposure_score_well_lit_vs_dark_vs_bright():
    well_lit = exposure_score(120.0, THRESHOLDS)
    too_dark = exposure_score(5.0, THRESHOLDS)
    too_bright = exposure_score(250.0, THRESHOLDS)

    assert well_lit == 100.0
    assert too_dark == 0.0
    assert too_bright == 0.0


def test_motion_score_ideal_vs_static_vs_excessive():
    ideal = motion_score(15.0, THRESHOLDS)
    static = motion_score(0.0, THRESHOLDS)
    excessive = motion_score(200.0, THRESHOLDS)

    assert ideal == 100.0
    assert static == 0.0
    assert excessive == 0.0


def _metrics(**overrides) -> QualityMetrics:
    defaults = dict(
        avg_sharpness=500.0,
        avg_brightness=130.0,
        dark_frame_ratio=0.0,
        avg_motion=15.0,
        sampled_frame_count=4,
    )
    defaults.update(overrides)
    return QualityMetrics(**defaults)


def _segment(duration: float = 4.0) -> VideoSegment:
    return VideoSegment(source_file="clip.mp4", start_time=0.0, end_time=duration, duration=duration)


def test_score_clip_good_metrics_scores_high_with_positive_reasons():
    result = score_clip(_segment(), _metrics(), uniqueness=100.0, is_duplicate=False)

    assert result.score >= 70
    assert "Good sharpness" in result.reasons
    assert "Good exposure" in result.reasons
    assert "No significant dark frames" in result.reasons
    assert "Visually distinct" in result.reasons


def test_score_clip_bad_metrics_scores_low_with_negative_reasons():
    bad_metrics = _metrics(avg_sharpness=5.0, avg_brightness=5.0, dark_frame_ratio=0.9, avg_motion=0.0)

    result = score_clip(_segment(), bad_metrics, uniqueness=5.0, is_duplicate=True)

    assert result.score < 35
    assert "Low sharpness" in result.reasons
    assert "Too dark" in result.reasons
    assert "Low frame-to-frame change" in result.reasons
    assert "Contains dark/underexposed frames" in result.reasons
    assert "Highly similar to another clip" in result.reasons


def test_score_clip_returns_integer_score_in_range():
    result = score_clip(_segment(), _metrics(), uniqueness=50.0, is_duplicate=False)

    assert isinstance(result.score, int)
    assert 0 <= result.score <= 100
