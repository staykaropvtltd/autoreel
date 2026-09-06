import pytest

from app.schemas.analysis import QualityMetrics
from app.schemas.batch import BatchClip, SelectionStatus
from app.schemas.story import PlannedReelClip, ReelPlan, ShotRole, TransitionConfig, TransitionType
from app.services.reel_planner import (
    PlanningConfig,
    compute_duration_summary,
    plan_reel,
    suggest_overlay_placement,
    to_composer_planned_clips,
)


def _clip(
    source_file: str,
    start: float,
    duration: float,
    score: int,
    avg_motion: float = 15.0,
    avg_sharpness: float = 300.0,
    hash_int: int = 0,
) -> BatchClip:
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
        closest_neighbor_distance=30,
    )


def _varied_pool(n: int, base_score: int = 90) -> list[BatchClip]:
    """A pool with enough spread in motion/duration/score/hash to avoid
    percentile ties, for exercising the planner realistically.
    """
    clips = []
    for i in range(n):
        clips.append(
            _clip(
                f"v{i}.mp4",
                0.0,
                duration=3.0 + (i % 4),
                score=base_score - i,
                avg_motion=5.0 + (i * 7) % 50,
                avg_sharpness=200.0 + i * 10,
                hash_int=i * 997,  # spread hashes out for diversity
            )
        )
    return clips


# --- target duration presets ---
def test_plan_reel_15_second_target():
    plan = plan_reel(_varied_pool(10), PlanningConfig(target_duration=15.0))
    assert plan.target_duration == 15.0
    assert plan.estimated_duration <= 15.0 + 1e-6
    assert plan.estimated_duration > 0


def test_plan_reel_30_second_target():
    plan = plan_reel(_varied_pool(14), PlanningConfig(target_duration=30.0))
    assert plan.estimated_duration <= 30.0 + 1e-6


def test_plan_reel_45_second_target():
    plan = plan_reel(_varied_pool(14), PlanningConfig(target_duration=45.0))
    assert plan.estimated_duration <= 45.0 + 1e-6


def test_plan_reel_60_second_target():
    plan = plan_reel(_varied_pool(14), PlanningConfig(target_duration=60.0))
    assert plan.estimated_duration <= 60.0 + 1e-6


# --- intro/outro bumper reservation (spec: total = intro + content + outro) ---
@pytest.mark.parametrize(
    # Content ceiling = target - intro(2) - outro(2) + the two bumper
    # crossfades reserved back (0.4 each) - see BUMPER_TRANSITION_SECONDS.
    "target,expected_content_ceiling",
    [(15.0, 11.8), (30.0, 26.8), (45.0, 41.8), (60.0, 56.8)],
)
def test_plan_reel_reserves_intro_outro_out_of_total_duration(target, expected_content_ceiling):
    plan = plan_reel(_varied_pool(20), PlanningConfig(target_duration=target))

    assert plan.target_duration == target
    assert plan.intro_seconds == 2.0
    assert plan.outro_seconds == 2.0
    # Content is planned to fit target - intro - outro, never the full total.
    assert plan.estimated_duration <= expected_content_ceiling + 1e-6


def test_plan_reel_insufficient_footage_still_reserves_bumpers():
    # Only ~6s of good footage exists for a 60s target - content comes up
    # short, but the bumpers are still reserved/reported, not silently
    # dropped because there wasn't enough footage to matter.
    clips = [_clip(f"v{i}.mp4", 0.0, 3.0, score=90 - i, hash_int=i * 997) for i in range(2)]
    plan = plan_reel(clips, PlanningConfig(target_duration=60.0))

    assert plan.intro_seconds == 2.0
    assert plan.outro_seconds == 2.0
    assert plan.estimated_duration < 56.0


# --- never pad with poor footage ---
def test_plan_reel_insufficient_high_quality_footage_returns_shorter_reel():
    # Only ~12s of genuinely good footage exists; requesting 60s must not
    # pull in the two low-score clips to pad the gap.
    good = [_clip(f"v{i}.mp4", 0.0, 4.0, score=90 - i, hash_int=i * 997) for i in range(3)]
    bad = [_clip("bad1.mp4", 0.0, 5.0, score=20, hash_int=5000), _clip("bad2.mp4", 0.0, 5.0, score=15, hash_int=6000)]

    plan = plan_reel(good + bad, PlanningConfig(target_duration=60.0, min_quality_score=50.0))

    assert plan.estimated_duration < 60.0
    used_sources = {c.source_file for c in plan.clips}
    assert "bad1.mp4" not in used_sources
    assert "bad2.mp4" not in used_sources


# --- trimming ---
def test_plan_reel_trims_clip_to_fit_remaining_budget():
    clips = [_clip("v.mp4", 2.0, 6.0, score=95, hash_int=1)]
    plan = plan_reel(clips, PlanningConfig(target_duration=4.0, min_clip_duration=1.0, max_clip_duration=8.0))

    assert len(plan.clips) == 1
    planned = plan.clips[0]
    assert planned.planned_duration <= 4.0
    assert planned.original_start == 2.0
    assert planned.original_end == 8.0
    # Trimmed from the end - keeps the original start.
    assert planned.planned_start == 2.0
    assert planned.planned_end == planned.planned_start + planned.planned_duration


def test_plan_reel_respects_max_clip_duration():
    clips = [_clip("v.mp4", 0.0, 10.0, score=95, hash_int=1)]
    plan = plan_reel(clips, PlanningConfig(target_duration=30.0, max_clip_duration=5.0))

    assert plan.clips[0].planned_duration <= 5.0


def test_plan_reel_respects_min_clip_duration():
    # A clip shorter than min_clip_duration should never be selected.
    clips = [_clip("v.mp4", 0.0, 0.5, score=95, hash_int=1)]
    plan = plan_reel(clips, PlanningConfig(target_duration=15.0, min_clip_duration=1.0))

    assert plan.clips == []


# --- role assignment / story ordering ---
def test_plan_reel_starts_with_hero_or_high_role_match():
    plan = plan_reel(_varied_pool(10), PlanningConfig(target_duration=20.0))
    assert len(plan.clips) > 0
    assert plan.clips[0].position == 1


def test_plan_reel_positions_are_sequential():
    plan = plan_reel(_varied_pool(10), PlanningConfig(target_duration=20.0))
    assert [c.position for c in plan.clips] == list(range(1, len(plan.clips) + 1))


def test_plan_reel_every_clip_has_a_role_and_confidence():
    plan = plan_reel(_varied_pool(8), PlanningConfig(target_duration=20.0))
    for clip in plan.clips:
        assert isinstance(clip.shot_role, ShotRole)
        assert 0.0 <= clip.role_confidence <= 1.0


# --- diversity / duplicate avoidance ---
def test_plan_reel_does_not_pick_near_identical_hashes_back_to_back_when_alternative_exists():
    near_duplicate_a = _clip("a.mp4", 0.0, 4.0, score=95, hash_int=0b0000)
    near_duplicate_b = _clip("b.mp4", 0.0, 4.0, score=94, hash_int=0b0001)  # 1 bit different: near-identical
    distinct = _clip("c.mp4", 0.0, 4.0, score=80, hash_int=0xFFFFFFFFFFFFFFFF)

    plan = plan_reel(
        # +4s to offset the intro/outro bumper reservation (spec: bumpers
        # come out of the total, not on top of it) - leaves the original
        # 8s of content budget the diversity check below assumes.
        [near_duplicate_a, near_duplicate_b, distinct],
        PlanningConfig(target_duration=12.0, max_clip_duration=4.0),
    )

    sources = [c.source_file for c in plan.clips]
    # With only 8s of budget for two ~4s slots, diversity should favor
    # picking the distinct clip over the near-duplicate of the first pick.
    assert "a.mp4" in sources
    assert "c.mp4" in sources


# --- duration calculation ---
def test_plan_reel_duration_difference_calculation():
    plan = plan_reel(_varied_pool(10), PlanningConfig(target_duration=15.0))
    assert plan.duration_difference == round(plan.estimated_duration - plan.target_duration, 3)


def test_plan_reel_empty_pool_returns_empty_plan():
    plan = plan_reel([], PlanningConfig(target_duration=15.0))
    assert plan.clips == []
    assert plan.estimated_duration == 0.0


# --- composer adapter ---
def test_to_composer_planned_clips_preserves_order_and_trims():
    plan = plan_reel(_varied_pool(5), PlanningConfig(target_duration=10.0))
    composer_clips = to_composer_planned_clips(plan)

    assert len(composer_clips) == len(plan.clips)
    for reel_clip, composer_clip in zip(sorted(plan.clips, key=lambda c: c.position), composer_clips):
        assert composer_clip.source_file == reel_clip.source_file
        assert composer_clip.start_time == reel_clip.planned_start
        assert composer_clip.end_time == reel_clip.planned_end
        assert composer_clip.duration == reel_clip.planned_duration


# --- Phase 8: transition-aware duration accounting ---


def _planned_reel_clip(
    position: int, source_file: str, duration: float, shot_role: ShotRole = ShotRole.HERO,
    transition: TransitionConfig | None = None,
) -> PlannedReelClip:
    return PlannedReelClip(
        position=position,
        source_file=source_file,
        original_start=0.0,
        original_end=duration,
        planned_start=0.0,
        planned_end=duration,
        planned_duration=duration,
        score=90,
        shot_role=shot_role,
        role_confidence=0.8,
        transition_in=transition or TransitionConfig(),
    )


def test_compute_duration_summary_matches_spec_example():
    # Fade is a duration-preserving effect baked into clip 2's own footage,
    # not a crossfade - clip 1 = 5s, clip 2 = 5s -> total 10s, no overlap.
    clips = [
        _planned_reel_clip(1, "a.mp4", 5.0),
        _planned_reel_clip(2, "b.mp4", 5.0, transition=TransitionConfig(type=TransitionType.FADE, duration=2.0)),
    ]

    summary = compute_duration_summary(clips)

    assert summary["content_duration"] == 10.0
    assert summary["transition_overlap_duration"] == 0.0
    assert summary["estimated_final_duration"] == 10.0


def test_compute_duration_summary_zoom_transition_adds_no_overlap():
    clips = [
        _planned_reel_clip(1, "a.mp4", 5.0),
        _planned_reel_clip(2, "b.mp4", 5.0, transition=TransitionConfig(type=TransitionType.ZOOM_IN, duration=2.0)),
    ]

    summary = compute_duration_summary(clips)

    assert summary["content_duration"] == 10.0
    assert summary["transition_overlap_duration"] == 0.0
    assert summary["estimated_final_duration"] == 10.0


def test_compute_duration_summary_no_transition_no_overlap():
    clips = [_planned_reel_clip(1, "a.mp4", 5.0), _planned_reel_clip(2, "b.mp4", 5.0)]

    summary = compute_duration_summary(clips)

    assert summary["transition_overlap_duration"] == 0.0
    assert summary["estimated_final_duration"] == 10.0


def test_compute_duration_summary_first_clip_transition_never_counts():
    # Clip 1 has no predecessor, so any transition_in set on it (shouldn't
    # normally happen, but must be harmless) is never consulted.
    clips = [
        _planned_reel_clip(1, "a.mp4", 5.0, transition=TransitionConfig(type=TransitionType.FADE, duration=2.0)),
        _planned_reel_clip(2, "b.mp4", 5.0),
    ]

    summary = compute_duration_summary(clips)

    assert summary["transition_overlap_duration"] == 0.0
    assert summary["estimated_final_duration"] == 10.0


# --- Phase 8: smart overlay placement suggestions ---


def test_suggest_overlay_placement_detail_clip_suggests_material():
    clips = [
        _planned_reel_clip(1, "a.mp4", 5.0, shot_role=ShotRole.HERO),
        _planned_reel_clip(2, "b.mp4", 3.0, shot_role=ShotRole.DETAIL),
    ]

    overlays = suggest_overlay_placement(clips)

    assert overlays.material_placement == "detail_clip"
    assert overlays.material_clip_position == 2


def test_suggest_overlay_placement_final_hero_suggests_price():
    clips = [
        _planned_reel_clip(1, "a.mp4", 5.0, shot_role=ShotRole.FULL_VIEW),
        _planned_reel_clip(2, "b.mp4", 3.0, shot_role=ShotRole.HERO),
    ]

    overlays = suggest_overlay_placement(clips)

    assert overlays.price_placement == "final_clip"


def test_suggest_overlay_placement_defaults_without_special_roles():
    clips = [_planned_reel_clip(1, "a.mp4", 5.0, shot_role=ShotRole.MOVEMENT)]

    overlays = suggest_overlay_placement(clips)

    assert overlays.material_placement == "none"
    assert overlays.price_placement == "none"
    assert overlays.brand_placement == "beginning"


def test_plan_reel_populates_phase8_defaults():
    plan = plan_reel(_varied_pool(6), PlanningConfig(target_duration=15.0))

    # A plan_reel() plan doesn't itself resolve the central brand config
    # (the /api/reels/plan endpoint and the renderer each do that
    # independently - see test_reels_api.py and test_reel_branding_config.py)
    # - it just carries whatever generic default the schema provides.
    assert plan.branding.brand_name
    assert isinstance(plan.branding.brand_name, str)
    assert plan.content_duration == plan.estimated_duration
    assert plan.transition_overlap_duration == 0.0
    assert plan.estimated_final_duration == plan.content_duration
    for clip in plan.clips:
        assert clip.transition_in.type.value == "none"


def test_reel_plan_serialization_round_trip():
    plan = plan_reel(_varied_pool(6), PlanningConfig(target_duration=15.0))

    payload = plan.model_dump_json()
    restored = type(plan).model_validate_json(payload)

    assert restored.target_duration == plan.target_duration
    assert len(restored.clips) == len(plan.clips)
    assert restored.branding.brand_name == plan.branding.brand_name


# --- Phase 9: transition-overlap compensation (critical duration fix) ---


def _reel_plan(clips: list, target_duration: float) -> ReelPlan:
    summary = compute_duration_summary(clips)
    return ReelPlan(
        target_duration=target_duration,
        estimated_duration=summary["content_duration"],
        duration_difference=summary["content_duration"] - target_duration,
        clips=clips,
        processing_time_seconds=0.0,
        **summary,
    )


def test_extend_plan_for_transitions_uses_existing_slack():
    from app.services.reel_planner import extend_plan_for_transitions

    # Clip 1: trimmed to 5s out of an available 8s (3s slack).
    clip1 = PlannedReelClip(
        position=1, source_file="a.mp4", original_start=0.0, original_end=8.0,
        planned_start=0.0, planned_end=5.0, planned_duration=5.0, score=90,
        shot_role=ShotRole.HERO, role_confidence=0.9,
    )
    # Clip 2: trimmed to 5s out of an available 5s (no slack). The fade is
    # a duration-preserving effect now - kept here for realism, but it
    # doesn't create the shortfall; the target below does.
    clip2 = PlannedReelClip(
        position=2, source_file="b.mp4", original_start=0.0, original_end=5.0,
        planned_start=0.0, planned_end=5.0, planned_duration=5.0, score=90,
        shot_role=ShotRole.FULL_VIEW, role_confidence=0.9,
        transition_in=TransitionConfig(type=TransitionType.FADE, duration=2.0),
    )
    # Content is 10s; a 12s target leaves a genuine 2s shortfall to fill
    # from clip 1's own slack.
    plan = _reel_plan([clip1, clip2], target_duration=12.0)
    assert plan.estimated_final_duration == 10.0

    compensated = extend_plan_for_transitions(plan, candidate_pool=None)

    assert compensated.duration_status == "ok"
    assert compensated.estimated_final_duration == pytest.approx(12.0, abs=0.15)
    # Clip 1 absorbed the 2s shortfall using its own slack; clip 2 unchanged.
    extended_clip1 = next(c for c in compensated.clips if c.source_file == "a.mp4")
    assert extended_clip1.planned_duration == pytest.approx(7.0, abs=0.01)


def test_extend_plan_for_transitions_pulls_from_candidate_pool_when_slack_insufficient():
    from app.services.reel_planner import extend_plan_for_transitions

    clip1 = PlannedReelClip(
        position=1, source_file="a.mp4", original_start=0.0, original_end=5.0,
        planned_start=0.0, planned_end=5.0, planned_duration=5.0, score=90,
        shot_role=ShotRole.HERO, role_confidence=0.9,
    )
    clip2 = PlannedReelClip(
        position=2, source_file="b.mp4", original_start=0.0, original_end=5.0,
        planned_start=0.0, planned_end=5.0, planned_duration=5.0, score=90,
        shot_role=ShotRole.FULL_VIEW, role_confidence=0.9,
        transition_in=TransitionConfig(type=TransitionType.FADE, duration=2.0),
    )
    # Content is 10s with no slack in either clip; a 12s target leaves a
    # genuine 2s shortfall only the candidate pool can fill.
    plan = _reel_plan([clip1, clip2], target_duration=12.0)

    pool = [_clip("c.mp4", 0.0, 4.0, score=85, hash_int=99)]
    compensated = extend_plan_for_transitions(plan, candidate_pool=pool)

    assert compensated.duration_status == "ok"
    assert compensated.estimated_final_duration == pytest.approx(12.0, abs=0.15)
    assert any(c.source_file == "c.mp4" for c in compensated.clips)


def test_extend_plan_for_transitions_reports_insufficient_content_honestly():
    from app.services.reel_planner import extend_plan_for_transitions

    clip1 = PlannedReelClip(
        position=1, source_file="a.mp4", original_start=0.0, original_end=5.0,
        planned_start=0.0, planned_end=5.0, planned_duration=5.0, score=90,
        shot_role=ShotRole.HERO, role_confidence=0.9,
    )
    clip2 = PlannedReelClip(
        position=2, source_file="b.mp4", original_start=0.0, original_end=5.0,
        planned_start=0.0, planned_end=5.0, planned_duration=5.0, score=90,
        shot_role=ShotRole.FULL_VIEW, role_confidence=0.9,
        transition_in=TransitionConfig(type=TransitionType.FADE, duration=2.0),
    )
    # Content is 10s with no slack in either clip; nothing can close a 12s
    # target's 2s shortfall.
    plan = _reel_plan([clip1, clip2], target_duration=12.0)

    # No pool, no slack -> genuinely cannot reach 12s; must not fabricate.
    compensated = extend_plan_for_transitions(plan, candidate_pool=None)

    assert compensated.duration_status == "insufficient_content"
    assert compensated.estimated_final_duration == pytest.approx(10.0, abs=0.01)


def test_extend_plan_for_transitions_never_reuses_a_low_quality_candidate():
    from app.services.reel_planner import extend_plan_for_transitions

    clip1 = PlannedReelClip(
        position=1, source_file="a.mp4", original_start=0.0, original_end=5.0,
        planned_start=0.0, planned_end=5.0, planned_duration=5.0, score=90,
        shot_role=ShotRole.HERO, role_confidence=0.9,
    )
    clip2 = PlannedReelClip(
        position=2, source_file="b.mp4", original_start=0.0, original_end=5.0,
        planned_start=0.0, planned_end=5.0, planned_duration=5.0, score=90,
        shot_role=ShotRole.FULL_VIEW, role_confidence=0.9,
        transition_in=TransitionConfig(type=TransitionType.FADE, duration=2.0),
    )
    # Content is 10s with no slack; a 12s target leaves a genuine 2s
    # shortfall that only a real (quality-passing) candidate could fill.
    plan = _reel_plan([clip1, clip2], target_duration=12.0)

    low_quality_pool = [_clip("bad.mp4", 0.0, 4.0, score=10, hash_int=99)]
    compensated = extend_plan_for_transitions(
        plan, candidate_pool=low_quality_pool, config=PlanningConfig(target_duration=12.0, min_quality_score=50.0)
    )

    assert compensated.duration_status == "insufficient_content"
    assert not any(c.source_file == "bad.mp4" for c in compensated.clips)


def test_extend_plan_for_transitions_noop_when_already_at_target():
    from app.services.reel_planner import extend_plan_for_transitions

    clip1 = PlannedReelClip(
        position=1, source_file="a.mp4", original_start=0.0, original_end=5.0,
        planned_start=0.0, planned_end=5.0, planned_duration=5.0, score=90,
        shot_role=ShotRole.HERO, role_confidence=0.9,
    )
    plan = _reel_plan([clip1], target_duration=5.0)

    compensated = extend_plan_for_transitions(plan, candidate_pool=None)

    assert compensated.duration_status == "ok"
    assert compensated.clips[0].planned_duration == 5.0
