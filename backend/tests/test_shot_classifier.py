from app.schemas.analysis import QualityMetrics
from app.schemas.batch import BatchClip, SelectionStatus
from app.schemas.story import ShotRole
from app.services.shot_classifier import classify_clips


def _clip(
    source_file: str,
    start: float,
    end: float,
    score: int,
    avg_motion: float = 15.0,
    avg_sharpness: float = 300.0,
    duration_override: float | None = None,
    closest_neighbor_distance: int | None = 30,
    hash_int: int = 0,
) -> BatchClip:
    duration = duration_override if duration_override is not None else end - start
    metrics = QualityMetrics(
        avg_sharpness=avg_sharpness, avg_brightness=130.0, dark_frame_ratio=0.0, avg_motion=avg_motion,
        sampled_frame_count=4,
    )
    return BatchClip(
        source_file=source_file,
        start_time=start,
        end_time=start + duration,
        duration=duration,
        score=score,
        metrics=metrics,
        reasons=[],
        perceptual_hash=format(hash_int, "016x"),
        status=SelectionStatus.SELECTED,
        selected=True,
        closest_neighbor_distance=closest_neighbor_distance,
    )


def test_classify_clips_empty_pool_returns_empty():
    assert classify_clips([]) == []


def test_classify_clips_highest_score_moderate_motion_is_hero():
    # Motion values must vary across the pool - a moderate *percentile* rank
    # requires something to be lower and something higher to rank against.
    clips = [
        _clip("v.mp4", 0, 4, score=98, avg_motion=15.0, hash_int=0),
        _clip("v.mp4", 4, 8, score=60, avg_motion=5.0, hash_int=1),
        _clip("v.mp4", 8, 12, score=55, avg_motion=40.0, hash_int=2),
    ]

    results = classify_clips(clips)

    hero = next(r for r in results if r.clip.start_time == 0)
    assert hero.shot_role == ShotRole.HERO
    assert 0.0 < hero.role_confidence <= 1.0


def test_classify_clips_high_motion_is_movement():
    # The outlier is placed mid-sequence (not last-in-source) so the ENDING
    # rule can't pre-empt it before the MOVEMENT rule is reached.
    clips = [
        _clip("v.mp4", 0, 4, score=70, avg_motion=5.0, hash_int=0),
        _clip("v.mp4", 4, 8, score=70, avg_motion=60.0, hash_int=1),  # clear outlier: high motion
        _clip("v.mp4", 8, 12, score=70, avg_motion=5.0, hash_int=2),
    ]

    results = classify_clips(clips)

    fast = next(r for r in results if r.clip.start_time == 4)
    assert fast.shot_role == ShotRole.MOVEMENT


def test_classify_clips_last_segment_in_source_can_be_ending():
    clips = [
        _clip("v.mp4", 0, 4, score=70, avg_motion=15.0, hash_int=0),
        _clip("v.mp4", 4, 8, score=70, avg_motion=15.0, hash_int=1),
        _clip("v.mp4", 8, 12, score=75, avg_motion=15.0, hash_int=2),  # last in source, decent score
    ]

    results = classify_clips(clips)

    last = next(r for r in results if r.clip.start_time == 8)
    assert last.shot_role in (ShotRole.ENDING, ShotRole.HERO, ShotRole.PRODUCT_SHOWCASE)


def test_classify_clips_never_returns_role_confidence_above_one():
    clips = [_clip("v.mp4", 0, 4, score=100, avg_motion=15.0, hash_int=0)]

    results = classify_clips(clips)

    assert 0.0 <= results[0].role_confidence <= 1.0


def test_classify_clips_low_signal_clip_can_be_unknown():
    # A single mid-everything clip with no other candidates to stand out
    # against should not be forced into a confident role.
    clips = [_clip("v.mp4", 0, 4, score=52, avg_motion=15.0, avg_sharpness=100.0, closest_neighbor_distance=None)]

    results = classify_clips(clips)

    assert results[0].shot_role in (ShotRole.UNKNOWN, ShotRole.PRODUCT_SHOWCASE, ShotRole.ENDING)
