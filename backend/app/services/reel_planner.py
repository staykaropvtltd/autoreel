"""Phase 7: target-duration-aware, story-ordered, diversity-conscious Reel
planning.

Consumes a QUALITY-PASSED, DEDUPED candidate pool - Phase 4's output
*before* its own max-clips/diversity cap (clips with status SELECTED or
REJECTED_NOT_SELECTED from a BatchAnalysisResult) - and produces a
ReelPlan: an ordered, trimmed clip sequence whose total duration
approaches a user-chosen target without ever padding with poor-quality
footage. Phase 4's own select_best_clips() is not modified or duplicated;
this module just reads a wider slice of its existing output.

Selection objective (recomputed at each fill step, for every remaining
candidate):

    combined_score = 0.40 * quality                 (clip.score / 100)
                    + 0.25 * diversity_vs_selected   (min hamming distance
                                                       to already-chosen
                                                       clips, normalized)
                    + 0.20 * story_role_match         (does this clip's role
                                                       fit what the current
                                                       point in the Reel
                                                       calls for?)
                    + 0.15 * duration_fit             (how much of the
                                                       clip's natural length
                                                       is actually used)

This is a deterministic, explainable GREEDY heuristic - not a learned/AI
model. No video frames are re-analyzed; only existing Phase 3/4 metrics
(score, perceptual hash, duration) are read.

Story structure (rolling by fraction of target duration filled so far):
  0-15%   START:  HERO > FULL_VIEW > PRODUCT_SHOWCASE
  15-35%  EARLY:  FULL_VIEW > HERO > PRODUCT_SHOWCASE
  35-80%  MIDDLE: MOVEMENT > DETAIL > SIDE_VIEW > PRODUCT_SHOWCASE
  80-95%  LATE:   role-agnostic (strongest remaining wins)
  95-100% END:    ENDING > HERO > PRODUCT_SHOWCASE

Trimming policy: a clip longer than the remaining budget (or configured
max) is trimmed from the END, keeping its original start (the beginning of
a shot is usually its most intentional framing).
"""

import time
from dataclasses import dataclass

from app.schemas.batch import BatchClip
from app.schemas.reel import PlannedClip as ComposerPlannedClip
from app.schemas.story import (
    OverlayConfig,
    PlannedReelClip,
    ReelPlan,
    ShotRole,
    TransitionConfig,
)
from app.services.shot_classifier import classify_clips
from app.services.similarity_analyzer import hamming_distance

DURATION_TOLERANCE_SECONDS = 0.1

QUALITY_WEIGHT = 0.40
DIVERSITY_WEIGHT = 0.25
STORY_WEIGHT = 0.20
DURATION_FIT_WEIGHT = 0.15

HASH_BITS = 64

DEFAULT_TARGET_DURATION = 15.0
DEFAULT_MIN_CLIP_DURATION = 1.0
DEFAULT_MAX_CLIP_DURATION = 8.0
DEFAULT_MIN_QUALITY_SCORE = 50.0

# Phase 9 (branding revision): every real generated Reel gets a branded
# intro and outro bumper (see reel_bumpers.py) - reserved out of the user's
# chosen TOTAL duration up front, not added on top of it. A 15s target with
# a 2s intro and 2s outro leaves 11s for product content.
INTRO_DURATION_SECONDS = 2.0
OUTRO_DURATION_SECONDS = 2.0
MIN_CONTENT_DURATION_SECONDS = 3.0

@dataclass
class PlanningConfig:
    target_duration: float = DEFAULT_TARGET_DURATION
    min_clip_duration: float = DEFAULT_MIN_CLIP_DURATION
    max_clip_duration: float = DEFAULT_MAX_CLIP_DURATION
    min_quality_score: float = DEFAULT_MIN_QUALITY_SCORE


def _clip_key(clip: BatchClip) -> tuple[str, float]:
    return (clip.source_file, clip.start_time)


def _story_template(fraction_complete: float) -> list[ShotRole]:
    if fraction_complete < 0.15:
        return [ShotRole.HERO, ShotRole.FULL_VIEW, ShotRole.PRODUCT_SHOWCASE]
    if fraction_complete < 0.35:
        return [ShotRole.FULL_VIEW, ShotRole.HERO, ShotRole.PRODUCT_SHOWCASE]
    if fraction_complete < 0.80:
        return [ShotRole.MOVEMENT, ShotRole.DETAIL, ShotRole.SIDE_VIEW, ShotRole.PRODUCT_SHOWCASE]
    if fraction_complete < 0.95:
        return []
    return [ShotRole.ENDING, ShotRole.HERO, ShotRole.PRODUCT_SHOWCASE]


def _role_match_score(role: ShotRole, desired: list[ShotRole]) -> float:
    if not desired:
        return 0.5
    if role == desired[0]:
        return 1.0
    if role in desired[1:]:
        return 0.7
    if role == ShotRole.UNKNOWN:
        return 0.3
    return 0.1


def _diversity_score(candidate_hash: int, selected_hashes: list[int]) -> float:
    if not selected_hashes:
        return 1.0
    min_distance = min(hamming_distance(candidate_hash, h) for h in selected_hashes)
    return max(0.0, min(1.0, min_distance / HASH_BITS))


def _duration_fit_score(natural_duration: float, remaining_budget: float) -> float:
    if natural_duration <= 0:
        return 0.0
    return max(0.0, min(1.0, min(natural_duration, remaining_budget) / natural_duration))


def plan_reel(candidates: list[BatchClip], config: PlanningConfig | None = None) -> ReelPlan:
    config = config or PlanningConfig()
    start = time.perf_counter()

    # Reserve the branded intro/outro out of the user's TOTAL target before
    # selecting a single clip - the bumpers are part of the chosen duration,
    # not extra time added on top of it (spec: "30 sec TOTAL = 2s intro + 26s
    # content + 2s outro", not "2s intro + 30s content + 2s outro"). Bumpers
    # are hard cuts (see reel_editor_renderer.compute_timeline_plan), so no
    # crossfade overlap needs to be reserved back - target minus the two
    # fixed bumper lengths is exactly the content budget.
    content_target = max(
        config.target_duration - INTRO_DURATION_SECONDS - OUTRO_DURATION_SECONDS,
        MIN_CONTENT_DURATION_SECONDS,
    )
    content_config = PlanningConfig(
        target_duration=content_target,
        min_clip_duration=config.min_clip_duration,
        max_clip_duration=config.max_clip_duration,
        min_quality_score=config.min_quality_score,
    )

    # Hard quality floor: never selected regardless of how much duration
    # budget remains unfilled.
    eligible = [c for c in candidates if c.score >= content_config.min_quality_score]

    classified_by_key = {_clip_key(c.clip): c for c in classify_clips(eligible)}

    remaining = list(eligible)
    selected: list[PlannedReelClip] = []
    selected_hashes: list[int] = []
    accumulated_duration = 0.0
    position = 1

    while remaining:
        remaining_budget = content_config.target_duration - accumulated_duration
        if remaining_budget < content_config.min_clip_duration:
            break

        fraction_complete = (
            accumulated_duration / content_config.target_duration if content_config.target_duration > 0 else 1.0
        )
        desired_roles = _story_template(fraction_complete)

        best_candidate: BatchClip | None = None
        best_combined = -1.0
        best_planned_duration = 0.0

        for clip in remaining:
            planned_duration = min(clip.duration, remaining_budget, content_config.max_clip_duration)
            if planned_duration < content_config.min_clip_duration:
                continue

            classified_clip = classified_by_key[_clip_key(clip)]
            candidate_hash = int(clip.perceptual_hash, 16)

            quality = clip.score / 100.0
            diversity = _diversity_score(candidate_hash, selected_hashes)
            story = _role_match_score(classified_clip.shot_role, desired_roles)
            duration_fit = _duration_fit_score(clip.duration, remaining_budget)

            combined = (
                QUALITY_WEIGHT * quality
                + DIVERSITY_WEIGHT * diversity
                + STORY_WEIGHT * story
                + DURATION_FIT_WEIGHT * duration_fit
            )

            if combined > best_combined:
                best_combined = combined
                best_candidate = clip
                best_planned_duration = planned_duration

        if best_candidate is None:
            break

        classified_clip = classified_by_key[_clip_key(best_candidate)]
        planned_start = best_candidate.start_time
        planned_end = planned_start + best_planned_duration

        selected.append(
            PlannedReelClip(
                position=position,
                source_file=best_candidate.source_file,
                original_start=best_candidate.start_time,
                original_end=best_candidate.end_time,
                planned_start=planned_start,
                planned_end=planned_end,
                planned_duration=round(best_planned_duration, 3),
                score=best_candidate.score,
                shot_role=classified_clip.shot_role,
                role_confidence=classified_clip.role_confidence,
            )
        )
        selected_hashes.append(int(best_candidate.perceptual_hash, 16))
        accumulated_duration += best_planned_duration
        remaining.remove(best_candidate)
        position += 1

    processing_time_seconds = round(time.perf_counter() - start, 3)
    estimated_duration = round(accumulated_duration, 3)
    duration_summary = compute_duration_summary(selected)

    return ReelPlan(
        target_duration=config.target_duration,
        estimated_duration=estimated_duration,
        duration_difference=round(estimated_duration - config.target_duration, 3),
        clips=selected,
        processing_time_seconds=processing_time_seconds,
        overlays=suggest_overlay_placement(selected),
        intro_seconds=INTRO_DURATION_SECONDS,
        outro_seconds=OUTRO_DURATION_SECONDS,
        **duration_summary,
    )


def to_composer_planned_clips(reel_plan: ReelPlan) -> list[ComposerPlannedClip]:
    return [
        ComposerPlannedClip(
            source_file=c.source_file,
            start_time=c.planned_start,
            end_time=c.planned_end,
            duration=c.planned_duration,
            score=c.score,
            transition_in=c.transition_in,
        )
        for c in sorted(reel_plan.clips, key=lambda c: c.position)
    ]


def compute_duration_summary(clips: list[PlannedReelClip]) -> dict[str, float]:
    """Duration accounting. Every transition (fade, zoom, slide) is now a
    duration-preserving effect baked into the incoming clip's own footage
    during extraction (reel_composer.build_zoom_filter / build_fade_in_filter)
    - none of them overlap or shorten the combined timeline the way an
    xfade-based crossfade used to. transition_overlap_duration is kept at
    0.0 (rather than removed) so existing callers/serialized plans that read
    this field keep working; estimated_final_duration is therefore always
    exactly content_duration.
    """
    content_duration = round(sum(c.planned_duration for c in clips), 3)
    return {
        "content_duration": content_duration,
        "transition_overlap_duration": 0.0,
        "estimated_final_duration": content_duration,
    }


def suggest_overlay_placement(clips: list[PlannedReelClip]) -> OverlayConfig:
    """Deterministic, rule-based suggestions from shot roles (Phase 8
    section 13) - not hard requirements, the user can change them:
      DETAIL clip           -> suggest material overlay on that clip
      final HERO/PRODUCT_SHOWCASE/ENDING clip -> suggest price on final clip
      (brand's default "beginning" placement already covers "HERO -> brand")
    """
    config = OverlayConfig()

    detail_clip = next((c for c in clips if c.shot_role == ShotRole.DETAIL), None)
    if detail_clip is not None:
        config.material_placement = "detail_clip"
        config.material_clip_position = detail_clip.position

    if clips and clips[-1].shot_role in (ShotRole.HERO, ShotRole.PRODUCT_SHOWCASE, ShotRole.ENDING):
        config.price_placement = "final_clip"

    return config


def extend_plan_for_transitions(
    plan: ReelPlan,
    candidate_pool: list[BatchClip] | None = None,
    config: PlanningConfig | None = None,
) -> ReelPlan:
    """Phase 9 critical fix: crossfade transitions must not shrink the final
    Reel below the user's target duration. Transitions are effects INSIDE
    the target duration, not a subtraction from it.

    Compensation strategy (spec section 5), applied only when the current
    plan's transitions would otherwise render short of target_duration:

      Phase A - extend existing clips using slack they already have (the
      gap between how much of the clip was actually planned vs. how much
      of the original detected segment is available), up to max_clip_duration.
      This needs no extra data and never introduces new clips.

      Phase B - if slack alone isn't enough, pull additional not-yet-used
      candidates from the pool (best score first, excluding exact repeats)
      and append them to the end of the timeline as plain cuts.

      If neither closes the gap, the shortfall is real: report
      duration_status="insufficient_content" rather than fabricating length
      with low-quality or duplicated footage.
    """
    # Bumpers (intro/outro) are reserved out of the total target and render
    # as their own separate, hard-cut segments - the CONTENT portion only
    # needs to fill target_duration minus whatever was reserved for them
    # (0 for a hand-built plan that never set these fields, so this is a
    # no-op for every pre-existing caller).
    effective_target = plan.target_duration - plan.intro_seconds - plan.outro_seconds
    config = config or PlanningConfig(target_duration=effective_target)
    clips = [c.model_copy(deep=True) for c in plan.clips]

    summary = compute_duration_summary(clips)
    shortfall = round(effective_target - summary["estimated_final_duration"], 3)

    if shortfall <= DURATION_TOLERANCE_SECONDS:
        return plan.model_copy(update={**summary, "clips": clips, "duration_status": "ok"})

    # Phase A: use each clip's own untapped slack, largest slack first.
    def _slack(c: PlannedReelClip) -> float:
        available = (c.original_end - c.original_start) - c.planned_duration
        return min(available, config.max_clip_duration - c.planned_duration)

    for clip in sorted(clips, key=_slack, reverse=True):
        if shortfall <= DURATION_TOLERANCE_SECONDS:
            break
        slack = _slack(clip)
        if slack <= 0:
            continue
        extension = min(slack, shortfall)
        clip.planned_duration = round(clip.planned_duration + extension, 3)
        clip.planned_end = round(clip.planned_start + clip.planned_duration, 3)
        shortfall = round(shortfall - extension, 3)

    # Phase B: pull in additional, not-yet-used candidates from the pool.
    if shortfall > DURATION_TOLERANCE_SECONDS and candidate_pool:
        used_keys = {(c.source_file, c.original_start) for c in clips}
        extra_candidates = sorted(
            (
                c
                for c in candidate_pool
                if (c.source_file, c.start_time) not in used_keys and c.score >= config.min_quality_score
            ),
            key=lambda c: c.score,
            reverse=True,
        )

        next_position = max((c.position for c in clips), default=0) + 1
        for candidate in extra_candidates:
            if shortfall <= DURATION_TOLERANCE_SECONDS:
                break
            planned_duration = min(candidate.duration, shortfall, config.max_clip_duration)
            if planned_duration < config.min_clip_duration:
                continue

            classified = classify_clips([candidate])[0]
            clips.append(
                PlannedReelClip(
                    position=next_position,
                    source_file=candidate.source_file,
                    original_start=candidate.start_time,
                    original_end=candidate.end_time,
                    planned_start=candidate.start_time,
                    planned_end=round(candidate.start_time + planned_duration, 3),
                    planned_duration=round(planned_duration, 3),
                    score=candidate.score,
                    shot_role=classified.shot_role,
                    role_confidence=classified.role_confidence,
                    transition_in=TransitionConfig(),
                )
            )
            used_keys.add((candidate.source_file, candidate.start_time))
            next_position += 1
            shortfall = round(shortfall - planned_duration, 3)

    final_summary = compute_duration_summary(clips)
    status = "ok" if shortfall <= DURATION_TOLERANCE_SECONDS else "insufficient_content"

    return plan.model_copy(update={"clips": clips, **final_summary, "duration_status": status})
