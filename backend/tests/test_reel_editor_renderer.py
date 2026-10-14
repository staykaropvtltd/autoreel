import subprocess
import tempfile
from pathlib import Path

import cv2
import pytest

from app.schemas.reel import PlannedClip
from app.schemas.story import (
    BrandingConfig,
    MusicSelection,
    OverlayConfig,
    PlannedReelClip,
    ProductOverlayInfo,
    ReelPlan,
    ShotRole,
    TransitionConfig,
    TransitionType,
)
from app.services.reel_composer import EmptySelectionError
from app.services.reel_editor_renderer import (
    build_timed_overlay_filter,
    compose_reel_from_editor_plan,
    compute_timeline_plan,
    render_final_overlay,
    resolve_overlay_windows,
)


def _composer_clip(source_file: str, duration: float, transition: TransitionConfig | None = None) -> PlannedClip:
    return PlannedClip(
        source_file=source_file, start_time=0.0, end_time=duration, duration=duration, score=90,
        transition_in=transition or TransitionConfig(),
    )


def _story_clip(position: int, source_file: str, duration: float, shot_role: ShotRole = ShotRole.HERO) -> PlannedReelClip:
    return PlannedReelClip(
        position=position, source_file=source_file, original_start=0.0, original_end=duration,
        planned_start=0.0, planned_end=duration, planned_duration=duration, score=90,
        shot_role=shot_role, role_confidence=0.8,
    )


def _extract_frames(video_path: Path, timestamps: list[float]) -> list:
    frames = []
    with tempfile.TemporaryDirectory() as tmp:
        for i, ts in enumerate(timestamps):
            frame_path = Path(tmp) / f"frame_{i}.png"
            subprocess.run(
                ["ffmpeg", "-y", "-ss", str(ts), "-i", str(video_path), "-frames:v", "1", str(frame_path)],
                capture_output=True, check=True,
            )
            frames.append(cv2.imread(str(frame_path)))
    return frames


def _frames_all_identical(frames: list) -> bool:
    first = frames[0]
    return all(f is not None and f.shape == first.shape and (f == first).all() for f in frames[1:])


# --- timeline / transition accounting ---


def test_compute_timeline_plan_matches_spec_example():
    # A transition is a duration-preserving effect baked into the incoming
    # clip's own footage (see reel_composer.build_fade_in_filter/
    # build_zoom_filter) - it never overlaps with or shortens the previous
    # clip, regardless of type. Total duration is always the exact sum.
    clips = [
        _composer_clip("a.mp4", 5.0),
        _composer_clip("b.mp4", 5.0, TransitionConfig(type=TransitionType.FADE, duration=2.0)),
    ]

    timeline = compute_timeline_plan(clips)

    assert timeline.total_duration == 10.0
    assert timeline.offsets[0] == 0.0
    assert timeline.offsets[1] == pytest.approx(5.0)


def test_compute_timeline_plan_transition_belongs_to_incoming_clip():
    clips = [_composer_clip("a.mp4", 4.0), _composer_clip("b.mp4", 4.0, TransitionConfig(type=TransitionType.ZOOM_IN, duration=2.0))]

    timeline = compute_timeline_plan(clips)

    # zoom_in is an in-place effect on clip 2's own footage - no overlap.
    assert timeline.offsets == [0.0, 4.0]
    assert timeline.total_duration == pytest.approx(8.0)


def test_compute_timeline_plan_no_clips_returns_empty():
    timeline = compute_timeline_plan([])
    assert timeline.offsets == []
    assert timeline.total_duration == 0.0


def test_compute_timeline_plan_single_clip():
    timeline = compute_timeline_plan([_composer_clip("a.mp4", 5.0)])
    assert timeline.offsets == [0.0]
    assert timeline.total_duration == 5.0
    assert timeline.junctions == []


def test_compute_timeline_plan_duration_is_exact_regardless_of_transition_size():
    """Bug regression: an xfade-overlap-based timeline could corrupt itself
    when a transition's requested duration exceeded the (possibly very
    short) clip it touched - observed on real footage as the final video
    terminating far short of its target duration while audio/container kept
    running to the intended length, in more than one distinct triggering
    scenario despite successive targeted fixes. Transitions no longer
    consume timeline at all, so a clip's own duration and a transition's
    requested duration can never conflict - total is always the exact sum,
    however short a clip is or however long a transition is requested.
    """
    clips = [
        _composer_clip("a.mp4", 4.4),
        _composer_clip("b.mp4", 1.6, TransitionConfig(type=TransitionType.FADE, duration=2.0)),
        _composer_clip("c.mp4", 5.8, TransitionConfig(type=TransitionType.FADE, duration=2.0)),
    ]

    timeline = compute_timeline_plan(clips)

    assert timeline.offsets == [0.0, 4.4, 6.0]
    assert timeline.total_duration == pytest.approx(4.4 + 1.6 + 5.8)


# --- overlay window resolution ---


def test_resolve_overlay_windows_brand_at_beginning():
    clips = [_story_clip(1, "a.mp4", 5.0)]
    timeline = compute_timeline_plan([_composer_clip("a.mp4", 5.0)])
    branding = BrandingConfig(brand_name="KALADHAR HEIRLOOMS", intro_duration=2.0)

    windows = resolve_overlay_windows(clips, timeline, branding, ProductOverlayInfo(), OverlayConfig())

    brand_windows = [w for w in windows if w["role"] == "brand"]
    assert len(brand_windows) == 1
    assert brand_windows[0]["start"] == 0.0
    assert brand_windows[0]["end"] == 2.0


def test_resolve_overlay_windows_watermark_spans_entire_reel():
    clips = [_story_clip(1, "a.mp4", 5.0)]
    timeline = compute_timeline_plan([_composer_clip("a.mp4", 5.0)])
    branding = BrandingConfig(show_watermark=True)
    overlays = OverlayConfig(brand_placement="none")

    windows = resolve_overlay_windows(clips, timeline, branding, ProductOverlayInfo(), overlays)

    watermark = next(w for w in windows if w["role"] == "watermark")
    assert watermark["start"] == 0.0
    assert watermark["end"] == 5.0


def test_resolve_overlay_windows_material_on_detail_clip():
    clips = [_story_clip(1, "a.mp4", 5.0, ShotRole.HERO), _story_clip(2, "b.mp4", 4.0, ShotRole.DETAIL)]
    timeline = compute_timeline_plan([_composer_clip("a.mp4", 5.0), _composer_clip("b.mp4", 4.0)])
    product = ProductOverlayInfo(material="Pure Cotton")
    overlays = OverlayConfig(material_placement="detail_clip", material_clip_position=2, material_duration=2.0)

    windows = resolve_overlay_windows(clips, timeline, BrandingConfig(brand_placement="none"), product, overlays)

    material = next(w for w in windows if w["role"] == "material")
    assert material["text"] == "Pure Cotton"
    assert material["start"] == timeline.offsets[1]
    assert material["end"] == timeline.offsets[1] + 2.0


def test_resolve_overlay_windows_price_on_final_clip():
    clips = [_story_clip(1, "a.mp4", 5.0), _story_clip(2, "b.mp4", 4.0, ShotRole.HERO)]
    timeline = compute_timeline_plan([_composer_clip("a.mp4", 5.0), _composer_clip("b.mp4", 4.0)])
    product = ProductOverlayInfo(price="Rs 2,499")
    overlays = OverlayConfig(price_placement="final_clip", price_duration=2.5, brand_placement="none")

    windows = resolve_overlay_windows(clips, timeline, BrandingConfig(brand_placement="none"), product, overlays)

    price = next(w for w in windows if w["role"] == "price")
    assert price["start"] == timeline.offsets[-1]
    assert price["end"] == timeline.offsets[-1] + 2.5


def test_resolve_overlay_windows_none_placement_produces_no_window():
    clips = [_story_clip(1, "a.mp4", 5.0)]
    timeline = compute_timeline_plan([_composer_clip("a.mp4", 5.0)])
    product = ProductOverlayInfo(material="Silk", price="Rs 100")
    overlays = OverlayConfig(brand_placement="none", material_placement="none", price_placement="none")

    windows = resolve_overlay_windows(clips, timeline, BrandingConfig(brand_placement="none"), product, overlays)

    assert windows == []


def test_resolve_overlay_windows_clip_window_capped_by_clip_duration():
    # A short DETAIL clip (1s) shouldn't produce an overlay window longer
    # than the clip itself, even if material_duration asks for more.
    clips = [_story_clip(1, "a.mp4", 5.0), _story_clip(2, "b.mp4", 1.0, ShotRole.DETAIL)]
    timeline = compute_timeline_plan([_composer_clip("a.mp4", 5.0), _composer_clip("b.mp4", 1.0)])
    product = ProductOverlayInfo(material="Linen")
    overlays = OverlayConfig(material_placement="detail_clip", material_clip_position=2, material_duration=3.0)

    windows = resolve_overlay_windows(clips, timeline, BrandingConfig(brand_placement="none"), product, overlays)

    material = next(w for w in windows if w["role"] == "material")
    assert material["end"] - material["start"] <= 1.0


# --- drawtext filter building ---


def test_build_timed_overlay_filter_none_without_font():
    windows = [{"text": "Hi", "start": 0.0, "end": 1.0, "role": "brand"}]
    assert build_timed_overlay_filter(windows, None) is None


def test_build_timed_overlay_filter_none_without_windows():
    assert build_timed_overlay_filter([], "somefont.ttf") is None


def test_build_timed_overlay_filter_includes_enable_clause():
    windows = [{"text": "KALADHAR", "start": 0.0, "end": 2.0, "role": "brand"}]
    result = build_timed_overlay_filter(windows, "C:/Windows/Fonts/arial.ttf")

    assert result is not None
    assert "drawtext" in result
    assert "enable='between(t,0.000,2.000)'" in result
    assert "KALADHAR" in result


# --- real render: missing logo graceful fallback, empty plan, end-to-end ---


def test_compose_reel_from_editor_plan_raises_for_empty_plan(tmp_path: Path):
    empty_plan = ReelPlan(target_duration=15.0, estimated_duration=0.0, duration_difference=-15.0, clips=[], processing_time_seconds=0.0)

    with pytest.raises(EmptySelectionError):
        compose_reel_from_editor_plan(empty_plan, source_dir=tmp_path, output_path=tmp_path / "out.mp4")


def test_compose_reel_from_editor_plan_missing_logo_degrades_gracefully(tmp_path: Path, synthetic_video_with_audio: Path):
    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())

    clip = _story_clip(1, synthetic_video_with_audio.name, 1.0)
    plan = ReelPlan(
        target_duration=6.0, estimated_duration=1.0, duration_difference=0.0, clips=[clip],
        processing_time_seconds=0.0,
        branding=BrandingConfig(logo_path="C:/does/not/exist/logo.png", show_logo_at_start=True),
    )

    result = compose_reel_from_editor_plan(plan, source_dir=source_dir, output_path=tmp_path / "out.mp4")

    assert result.width == 1080
    assert result.height == 1920
    assert Path(result.output_path).exists()
    assert result.duration == pytest.approx(6.0, abs=0.3)


def test_renderer_rejects_target_that_would_truncate_the_full_end_card(
    tmp_path: Path, synthetic_video_with_audio: Path
):
    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())
    clip = _story_clip(1, synthetic_video_with_audio.name, 1.0)
    plan = ReelPlan(
        target_duration=4.0,
        estimated_duration=1.0,
        duration_difference=0.0,
        clips=[clip],
        processing_time_seconds=0.0,
    )

    with pytest.raises(ValueError, match="cannot contain"):
        compose_reel_from_editor_plan(
            plan,
            source_dir=source_dir,
            output_path=tmp_path / "out.mp4",
        )
    assert not (tmp_path / "out.mp4").exists()


def test_compose_reel_from_editor_plan_two_clips_with_fade_end_to_end(
    tmp_path: Path, synthetic_video_with_audio: Path, synthetic_two_scene_video: Path
):
    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())
    (source_dir / synthetic_two_scene_video.name).write_bytes(synthetic_two_scene_video.read_bytes())

    clip1 = _story_clip(1, synthetic_video_with_audio.name, 1.0)
    clip1 = clip1.model_copy(update={"planned_end": 1.0})
    clip2 = _story_clip(2, synthetic_two_scene_video.name, 1.0)
    clip2.transition_in = TransitionConfig(type=TransitionType.FADE, duration=0.3)

    plan = ReelPlan(
        target_duration=7.0, estimated_duration=2.0, duration_difference=0.0, clips=[clip1, clip2],
        processing_time_seconds=0.0,
        overlays=OverlayConfig(
            brand_placement="none", material_placement="beginning", price_placement="end",
            material_duration=0.5, price_duration=0.5,
        ),
        product=ProductOverlayInfo(material="Cotton", price="Rs 999"),
    )

    result = compose_reel_from_editor_plan(plan, source_dir=source_dir, output_path=tmp_path / "out.mp4")

    assert result.width == 1080
    assert result.height == 1920
    assert result.video_codec == "h264"
    assert result.audio_codec == "aac"
    # Two seconds of source content plus the five-second end card fills the
    # seven-second total target; the fade does not consume timeline duration.
    assert result.duration == pytest.approx(7.0, abs=0.2)


# --- Phase 9: critical duration fix - transitions must not shrink the Reel ---


def _sliced_clips(source_file: str, n_clips: int, per_clip: float, transitions: list) -> list[PlannedReelClip]:
    """Non-overlapping trims carved sequentially from one long source file,
    with the given (type, duration) transition applied to each clip after
    the first.
    """
    clips = []
    cursor = 0.0
    for i in range(n_clips):
        end = round(cursor + per_clip, 3)
        transition = TransitionConfig()
        if i > 0 and (i - 1) < len(transitions):
            t_type, t_dur = transitions[i - 1]
            transition = TransitionConfig(type=TransitionType(t_type), duration=t_dur)
        clips.append(
            PlannedReelClip(
                position=i + 1, source_file=source_file, original_start=cursor, original_end=end,
                planned_start=cursor, planned_end=end, planned_duration=round(per_clip, 3), score=90,
                shot_role=ShotRole.HERO, role_confidence=0.8, transition_in=transition,
            )
        )
        cursor = end
    return clips


@pytest.mark.parametrize(
    "target_duration,transitions",
    [
        (8.0, []),
        (10.0, [("fade", 2.0)]),
        (15.0, [("zoom_in", 1.0), ("fade", 1.0)]),
        (30.0, [("fade", 2.0), ("zoom_in", 1.5), ("slide_left", 1.0)]),
    ],
    ids=["8s_no_transitions", "10s_fade2s", "15s_multi_transitions", "30s_multi_transitions"],
)
def test_final_duration_matches_target_with_transitions(
    tmp_path: Path, synthetic_long_video: Path, target_duration: float, transitions: list
):
    from app.services.reel_planner import extend_plan_for_transitions

    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_long_video.name).write_bytes(synthetic_long_video.read_bytes())

    n_clips = max(len(transitions) + 1, 2)
    per_clip = (target_duration - 5.0) / n_clips

    clips = _sliced_clips(synthetic_long_video.name, n_clips, per_clip, transitions)
    plan = ReelPlan(
        target_duration=target_duration,
        estimated_duration=sum(c.planned_duration for c in clips),
        duration_difference=0.0,
        clips=clips,
        processing_time_seconds=0.0,
        branding=BrandingConfig(brand_name=None) if False else BrandingConfig(),
    )

    compensated = extend_plan_for_transitions(plan, candidate_pool=None)
    result = compose_reel_from_editor_plan(compensated, source_dir=source_dir, output_path=tmp_path / "out.mp4")

    tolerance = max(0.5, target_duration * 0.05)
    assert result.duration == pytest.approx(target_duration, abs=tolerance)
    assert result.duration_status == "ok"


def test_final_duration_does_not_shrink_below_target_bug_regression(tmp_path: Path, synthetic_long_video: Path):
    """Two five-second clips with a 2s in-place fade plus the end card
    should render to the fifteen-second total target without overlap loss.
    """
    from app.services.reel_planner import extend_plan_for_transitions

    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_long_video.name).write_bytes(synthetic_long_video.read_bytes())

    clip1 = PlannedReelClip(
        position=1, source_file=synthetic_long_video.name, original_start=0.0, original_end=8.0,
        planned_start=0.0, planned_end=5.0, planned_duration=5.0, score=90,
        shot_role=ShotRole.HERO, role_confidence=0.9,
    )
    clip2 = PlannedReelClip(
        position=2, source_file=synthetic_long_video.name, original_start=10.0, original_end=18.0,
        planned_start=10.0, planned_end=15.0, planned_duration=5.0, score=90,
        shot_role=ShotRole.FULL_VIEW, role_confidence=0.9,
        transition_in=TransitionConfig(type=TransitionType.FADE, duration=2.0),
    )
    plan = ReelPlan(
        target_duration=15.0, estimated_duration=10.0, duration_difference=0.0,
        clips=[clip1, clip2], processing_time_seconds=0.0,
    )

    compensated = extend_plan_for_transitions(plan, candidate_pool=None)
    assert compensated.duration_status == "ok"

    result = compose_reel_from_editor_plan(compensated, source_dir=source_dir, output_path=tmp_path / "out.mp4")

    assert result.duration == pytest.approx(15.0, abs=0.6)
    assert result.duration > 14.0  # sanity: not the old, buggy short render
    assert result.duration_status == "ok"


def test_xfade_chain_does_not_truncate_video_when_transition_exceeds_clip_regression(
    tmp_path: Path, synthetic_long_video: Path
):
    """Confirmed real-world bug: a Reel rendered with video ending at ~6.7s
    while audio/container ran to ~29.3s - the container-level duration
    (what result.duration reports) looked fine, masking a video stream that
    had actually been truncated by a corrupted xfade offset chain. Root
    cause: clip 2 here (1.8s) is shorter than its own 2.0s incoming fade, so
    the unclamped offset formula computed a non-monotonic offset sequence
    and ffmpeg's xfade chain collapsed. Checks the video stream's own
    duration directly (get_video_stream_duration), not just the container
    duration, since the container duration is exactly what stayed silent
    about this bug in production.
    """
    from app.services.reel_planner import extend_plan_for_transitions
    from app.services.video_metadata import get_video_stream_duration

    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_long_video.name).write_bytes(synthetic_long_video.read_bytes())

    clip1 = PlannedReelClip(
        position=1, source_file=synthetic_long_video.name, original_start=0.0, original_end=5.0,
        planned_start=0.0, planned_end=5.0, planned_duration=5.0, score=90,
        shot_role=ShotRole.HERO, role_confidence=0.9,
    )
    clip2 = PlannedReelClip(
        position=2, source_file=synthetic_long_video.name, original_start=10.0, original_end=11.8,
        planned_start=10.0, planned_end=11.8, planned_duration=1.8, score=90,
        shot_role=ShotRole.DETAIL, role_confidence=0.9,
        transition_in=TransitionConfig(type=TransitionType.FADE, duration=2.0),  # longer than this clip's own 1.8s
    )
    clip3 = PlannedReelClip(
        position=3, source_file=synthetic_long_video.name, original_start=20.0, original_end=25.0,
        planned_start=20.0, planned_end=25.0, planned_duration=5.0, score=90,
        shot_role=ShotRole.ENDING, role_confidence=0.9,
        transition_in=TransitionConfig(type=TransitionType.FADE, duration=2.0),
    )
    plan = ReelPlan(
        target_duration=8.2, estimated_duration=11.8, duration_difference=0.0,
        clips=[clip1, clip2, clip3], processing_time_seconds=0.0,
    )

    compensated = extend_plan_for_transitions(plan, candidate_pool=None)
    result = compose_reel_from_editor_plan(compensated, source_dir=source_dir, output_path=tmp_path / "out.mp4")

    assert result.duration > 7.5  # not the old bug's catastrophic collapse
    assert result.duration_status == "ok"

    video_stream_duration = get_video_stream_duration(tmp_path / "out.mp4")
    # The core regression check: the video track must not end early relative
    # to the container/audio - this is exactly what silently broke before.
    assert video_stream_duration == pytest.approx(result.duration, abs=0.5)

    frames = _extract_frames(tmp_path / "out.mp4", [0.5, result.duration * 0.5, max(result.duration - 0.5, 0.6)])
    assert not _frames_all_identical(frames)


def test_insufficient_footage_reports_status_and_shorter_output(tmp_path: Path, synthetic_video_with_audio: Path):
    """Genuinely not enough source material exists (a single 1s clip for a
    10s target with no candidate pool to draw more from) - must not
    fabricate length, and must say so explicitly.
    """
    from app.services.reel_planner import extend_plan_for_transitions

    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())

    clip = PlannedReelClip(
        position=1, source_file=synthetic_video_with_audio.name, original_start=0.0, original_end=1.0,
        planned_start=0.0, planned_end=1.0, planned_duration=1.0, score=90,
        shot_role=ShotRole.HERO, role_confidence=0.9,
    )
    plan = ReelPlan(target_duration=10.0, estimated_duration=1.0, duration_difference=-9.0, clips=[clip], processing_time_seconds=0.0)

    compensated = extend_plan_for_transitions(plan, candidate_pool=None)
    assert compensated.duration_status == "insufficient_content"

    result = compose_reel_from_editor_plan(compensated, source_dir=source_dir, output_path=tmp_path / "out.mp4")

    assert result.duration_status == "insufficient_content"
    assert result.duration < 10.0
    assert result.target_duration == 10.0


def test_transitions_are_duration_preserving_not_xfade_overlap_regression(
    tmp_path: Path, synthetic_long_video: Path
):
    """Bug regression (real footage, reported live): a Reel planned as
    intro 2.0s + product content 11.8s + outro 2.0s (target 15.8s) rendered
    with the video stream ending at 10.27s while the container ran to
    14.82s - an xfade/acrossfade crossfade chain shortening the timeline by
    more than the planner accounted for. Transitions are now baked into the
    incoming clip's own footage (duration-preserving) and clips are
    concatenated with plain hard cuts, so this class of bug is structurally
    impossible: the rendered video must land within a small encoder
    tolerance of 2.0s intro + 6.8s content + 2.0s outro + 5.0s end card.
    """
    from app.services.reel_planner import extend_plan_for_transitions
    from app.services.video_metadata import get_video_stream_duration

    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_long_video.name).write_bytes(synthetic_long_video.read_bytes())

    durations = [3.0, 1.0, 0.8, 2.0]
    transitions = [None, TransitionConfig(type=TransitionType.ZOOM_IN, duration=2.0),
                   TransitionConfig(type=TransitionType.FADE, duration=1.0), None]
    roles = [ShotRole.HERO, ShotRole.DETAIL, ShotRole.MOVEMENT, ShotRole.ENDING]
    clips = []
    cursor = 0.0
    for i, (d, t, role) in enumerate(zip(durations, transitions, roles), start=1):
        end = cursor + d
        clips.append(
            PlannedReelClip(
                position=i, source_file=synthetic_long_video.name, original_start=cursor, original_end=end,
                planned_start=cursor, planned_end=end, planned_duration=d, score=90,
                shot_role=role, role_confidence=0.9, transition_in=t or TransitionConfig(),
            )
        )
        cursor = end

    plan = ReelPlan(
        target_duration=15.8, estimated_duration=sum(durations), duration_difference=0.0,
        clips=clips, processing_time_seconds=0.0, intro_seconds=2.0, outro_seconds=2.0,
    )

    compensated = extend_plan_for_transitions(plan, candidate_pool=None)
    assert compensated.duration_status == "ok"

    result = compose_reel_from_editor_plan(compensated, source_dir=source_dir, output_path=tmp_path / "out.mp4")

    assert result.duration == pytest.approx(15.8, abs=0.5)
    assert result.duration_status == "ok"

    video_stream_duration = get_video_stream_duration(tmp_path / "out.mp4")
    assert video_stream_duration == pytest.approx(result.duration, abs=0.3)
    assert video_stream_duration > 14.5  # sanity: nowhere near the old bug's 10.27s


# --- branded intro/outro bumpers ---


def _mean_bgr(frame) -> tuple[float, float, float]:
    b, g, r = frame[:, :, 0].mean(), frame[:, :, 1].mean(), frame[:, :, 2].mean()
    return (b, g, r)


def test_compose_reel_with_bumpers_total_duration_matches_target(tmp_path: Path, synthetic_long_video: Path):
    """End-to-end: intro (2s) + product content + outro (2s) must add up to
    ~the plan's target_duration, with video/audio/container all agreeing -
    exactly the invariant the earlier truncation bug violated.
    """
    from app.services.reel_planner import extend_plan_for_transitions
    from app.services.video_metadata import get_video_stream_duration

    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_long_video.name).write_bytes(synthetic_long_video.read_bytes())

    clip1 = PlannedReelClip(
        position=1, source_file=synthetic_long_video.name, original_start=0.0, original_end=8.0,
        planned_start=0.0, planned_end=2.5, planned_duration=2.5, score=90,
        shot_role=ShotRole.HERO, role_confidence=0.9,
    )
    clip2 = PlannedReelClip(
        position=2, source_file=synthetic_long_video.name, original_start=10.0, original_end=18.0,
        planned_start=10.0, planned_end=12.5, planned_duration=2.5, score=90,
        shot_role=ShotRole.FULL_VIEW, role_confidence=0.9,
        transition_in=TransitionConfig(type=TransitionType.FADE, duration=1.0),
    )
    # target = 14s: 2s intro + 5s content + 2s outro + 5s product end card.
    plan = ReelPlan(
        target_duration=14.0, estimated_duration=10.0, duration_difference=0.0,
        clips=[clip1, clip2], processing_time_seconds=0.0,
        intro_seconds=2.0, outro_seconds=2.0,
    )

    compensated = extend_plan_for_transitions(plan, candidate_pool=None)
    result = compose_reel_from_editor_plan(compensated, source_dir=source_dir, output_path=tmp_path / "out.mp4")

    assert result.duration == pytest.approx(14.0, abs=0.6)
    assert result.duration_status == "ok"

    video_stream_duration = get_video_stream_duration(tmp_path / "out.mp4")
    assert video_stream_duration == pytest.approx(result.duration, abs=0.5)


def test_compose_reel_without_bumpers_is_unaffected_by_the_feature(tmp_path: Path, synthetic_long_video: Path):
    """A hand-built plan without bumper durations omits those clips; its
    five seconds of content and five-second end card fill the ten-second target.
    """
    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_long_video.name).write_bytes(synthetic_long_video.read_bytes())

    clip = PlannedReelClip(
        position=1, source_file=synthetic_long_video.name, original_start=0.0, original_end=5.0,
        planned_start=0.0, planned_end=5.0, planned_duration=5.0, score=90,
        shot_role=ShotRole.HERO, role_confidence=0.9,
    )
    plan = ReelPlan(target_duration=10.0, estimated_duration=5.0, duration_difference=0.0, clips=[clip], processing_time_seconds=0.0)
    assert plan.intro_seconds == 0.0 and plan.outro_seconds == 0.0

    result = compose_reel_from_editor_plan(plan, source_dir=source_dir, output_path=tmp_path / "out.mp4")

    assert result.duration == pytest.approx(10.0, abs=0.5)


@pytest.mark.parametrize(
    "with_template,with_bumpers",
    [(False, False), (False, True), (True, False), (True, True)],
    ids=["no-template-no-bumpers", "no-template-with-bumpers", "template-no-bumpers", "template-with-bumpers"],
)
def test_whole_duration_and_full_end_card_with_optional_segments(
    tmp_path: Path,
    synthetic_long_video: Path,
    with_template: bool,
    with_bumpers: bool,
):
    from app.services.video_metadata import get_video_stream_duration

    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_long_video.name).write_bytes(synthetic_long_video.read_bytes())
    template_path = None
    if with_template:
        from PIL import Image

        template_path = tmp_path / "template.png"
        Image.new("RGB", (108, 192), color=(0, 0, 220)).save(template_path)

    from app.services.reel_duration import get_template_duration_seconds

    template_seconds = get_template_duration_seconds() if with_template else 0.0
    intro_seconds = 2.0 if with_bumpers else 0.0
    outro_seconds = 2.0 if with_bumpers else 0.0
    target = 14.0
    content_budget = target - template_seconds - intro_seconds - outro_seconds - 5.0
    clip = PlannedReelClip(
        position=1,
        source_file=synthetic_long_video.name,
        original_start=0.0,
        original_end=20.0,
        planned_start=0.0,
        planned_end=content_budget,
        planned_duration=content_budget,
        score=90,
        shot_role=ShotRole.HERO,
        role_confidence=0.9,
    )
    plan = ReelPlan(
        target_duration=target,
        estimated_duration=content_budget,
        duration_difference=0.0,
        estimated_final_duration=target,
        clips=[clip],
        processing_time_seconds=0.0,
        template_seconds=template_seconds,
        intro_seconds=intro_seconds,
        outro_seconds=outro_seconds,
    )

    result = compose_reel_from_editor_plan(
        plan,
        source_dir=source_dir,
        output_path=tmp_path / "out.mp4",
        template_image_path=template_path,
    )

    assert plan.estimated_final_duration == pytest.approx(target)
    assert result.duration == pytest.approx(plan.estimated_final_duration, abs=0.5)
    assert result.duration_status == "ok"
    assert get_video_stream_duration(tmp_path / "out.mp4") == pytest.approx(result.duration, abs=0.3)

    end_card_frame = _extract_frames(
        tmp_path / "out.mp4", [result.duration - 0.25]
    )[0]
    # The end card's bottom-right corner is unobstructed and retains its
    # light background at the end of the video, proving the complete card
    # survives final muxing and its -t bound.
    corner_bgr = end_card_frame[-20, -20].astype(int)
    assert all(abs(int(actual) - expected) < 25 for actual, expected in zip(corner_bgr, (238, 246, 251)))

    if with_template:
        template_frame = _extract_frames(tmp_path / "out.mp4", [0.25])[0]
        center_bgr = template_frame[540, 540].astype(int)
        assert center_bgr[0] > 180 and center_bgr[1] < 50 and center_bgr[2] < 50
        assert template_seconds <= 1.0
        content_or_bumper_frame = _extract_frames(
            tmp_path / "out.mp4", [template_seconds + 0.25]
        )[0]
        assert not (content_or_bumper_frame[540, 540] == template_frame[540, 540]).all()


def test_insufficient_footage_keeps_the_full_end_card_and_reports_short_output(
    tmp_path: Path, synthetic_video_with_audio: Path
):
    from app.services.video_metadata import get_video_stream_duration

    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_video_with_audio.name).write_bytes(synthetic_video_with_audio.read_bytes())
    clip = _story_clip(1, synthetic_video_with_audio.name, 1.0)
    plan = ReelPlan(
        target_duration=15.0,
        estimated_duration=1.0,
        duration_difference=-4.0,
        estimated_final_duration=10.0,
        clips=[clip],
        processing_time_seconds=0.0,
        template_seconds=0.0,
        intro_seconds=2.0,
        outro_seconds=2.0,
    )

    result = compose_reel_from_editor_plan(
        plan,
        source_dir=source_dir,
        output_path=tmp_path / "out.mp4",
    )

    assert result.duration_status == "insufficient_content"
    assert result.duration == pytest.approx(10.0, abs=0.5)
    assert result.duration < result.target_duration
    assert get_video_stream_duration(tmp_path / "out.mp4") == pytest.approx(result.duration, abs=0.3)
    end_card_frame = _extract_frames(tmp_path / "out.mp4", [result.duration - 0.25])[0]
    corner_bgr = end_card_frame[-20, -20].astype(int)
    assert all(abs(int(actual) - expected) < 25 for actual, expected in zip(corner_bgr, (238, 246, 251)))


def test_compose_reel_with_bumpers_intro_and_outro_frames_show_branding(tmp_path: Path, synthetic_long_video: Path):
    """The intro/outro are a distinct, near-uniform ivory-background bumper
    (see reel_bumpers.py) - visually very different from the busy testsrc2
    product footage. A frame inside the intro/outro window should be close
    to that flat background color; a frame in the middle of the product
    content should not be.
    """
    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_long_video.name).write_bytes(synthetic_long_video.read_bytes())

    clip = PlannedReelClip(
        position=1, source_file=synthetic_long_video.name, original_start=0.0, original_end=8.0,
        planned_start=0.0, planned_end=6.0, planned_duration=6.0, score=90,
        shot_role=ShotRole.HERO, role_confidence=0.9,
    )
    plan = ReelPlan(
        target_duration=15.0, estimated_duration=6.0, duration_difference=0.0,
        clips=[clip], processing_time_seconds=0.0, intro_seconds=2.0, outro_seconds=2.0,
    )

    result = compose_reel_from_editor_plan(plan, source_dir=source_dir, output_path=tmp_path / "out.mp4")

    intro_frame, content_frame, outro_frame = _extract_frames(
        tmp_path / "out.mp4", [0.8, result.duration / 2, max(result.duration - 0.8, 0.1)]
    )
    ivory_bgr = (0xF2, 0xF7, 0xFA)  # BGR order for cv2, matching 0xFAF7F2 background (RGB)

    intro_mean = _mean_bgr(intro_frame)
    outro_mean = _mean_bgr(outro_frame)
    content_mean = _mean_bgr(content_frame)

    # The bumper frames are dominated by the flat ivory background.
    assert all(abs(c - i) < 40 for c, i in zip(ivory_bgr, intro_mean))
    assert all(abs(c - i) < 40 for c, i in zip(ivory_bgr, outro_mean))
    # The mid-content frame (busy test pattern) must look distinctly
    # different from the flat bumper background.
    assert not all(abs(c - i) < 40 for c, i in zip(ivory_bgr, content_mean))


# --- audio trimming with custom start_time ---


def test_render_final_overlay_custom_audio_start_time(tmp_path: Path):
    """render_final_overlay must use music.start_time (not hardcoded 0)
    in the FFmpeg atrim filter so the generated video starts at the
    exact audio hook the user selected."""
    from unittest.mock import patch

    # Create a dummy intermediate video (we mock FFmpeg so it's not actually read)
    intermediate = tmp_path / "intermediate.mp4"
    intermediate.write_bytes(b"\x00" * 100)

    output = tmp_path / "output.mp4"

    music = MusicSelection(
        track_id="ghoomar",
        track_name="Ghoomar",
        source_path="ghoomar.mp3",
        source_duration=180.0,
        start_time=20.0,  # <-- user wants the audio starting at second 20
        end_time=35.0,
        volume=0.85,
        loop_if_needed=True,
        preserve_original_audio=False,
    )

    music_file = tmp_path / "ghoomar.mp3"
    music_file.write_bytes(b"\x00" * 100)

    captured_args: list[list[str]] = []

    def mock_run_ffmpeg(args: list[str]) -> None:
        captured_args.append(args)

    with patch(
        "app.services.reel_editor_renderer.run_ffmpeg", side_effect=mock_run_ffmpeg
    ):
        render_final_overlay(
            intermediate_path=intermediate,
            output_path=output,
            overlay_filter=None,
            logo_path=None,
            logo_windows=[],
            target_duration=15.0,
            music=music,
            music_file_path=music_file,
        )

    assert len(captured_args) == 1
    ffmpeg_args = captured_args[0]

    # Find the -filter_complex value
    fc_idx = ffmpeg_args.index("-filter_complex")
    filter_complex = ffmpeg_args[fc_idx + 1]

    # The atrim must use start=20.0 and end=35.0 (not atrim=0:15.000)
    assert "atrim=20.000:35.000" in filter_complex, (
        f"Expected atrim=20.000:35.000 in filter_complex, got: {filter_complex}"
    )
    # asetpts=PTS-STARTPTS must be present to reset timestamps after trim
    assert "asetpts=PTS-STARTPTS" in filter_complex, (
        f"Expected asetpts=PTS-STARTPTS in filter_complex, got: {filter_complex}"
    )


def test_render_final_overlay_honors_end_time(tmp_path: Path):
    """F-20: render_final_overlay must honor music.end_time when specified."""
    from unittest.mock import patch

    intermediate = tmp_path / "intermediate.mp4"
    intermediate.write_bytes(b"\x00" * 100)
    output = tmp_path / "output.mp4"

    music = MusicSelection(
        track_id="test",
        track_name="Test",
        source_path="test.mp3",
        source_duration=60.0,
        start_time=10.0,
        end_time=18.0,  # Explicit 8-second window
        volume=1.0,
        loop_if_needed=False,
        preserve_original_audio=False,
    )
    music_file = tmp_path / "test.mp3"
    music_file.write_bytes(b"\x00" * 100)

    captured_args: list[list[str]] = []

    with patch(
        "app.services.reel_editor_renderer.run_ffmpeg", side_effect=lambda a: captured_args.append(a)
    ):
        render_final_overlay(
            intermediate_path=intermediate,
            output_path=output,
            overlay_filter=None,
            logo_path=None,
            logo_windows=[],
            target_duration=15.0,  # Longer than end_time - start_time
            music=music,
            music_file_path=music_file,
        )

    fc = captured_args[0][captured_args[0].index("-filter_complex") + 1]
    assert "atrim=10.000:18.000" in fc, f"Expected atrim to end at end_time 18.000, got {fc}"
    # Verify input args do not include -ss before -i to avoid double offset
    input_flag_idx = captured_args[0].index(str(music_file))
    assert captured_args[0][input_flag_idx - 1] == "-i"
    assert "-ss" not in captured_args[0][:input_flag_idx]


def test_render_final_overlay_ramp_audio_single_offset(tmp_path: Path):
    """F-20: Decode samples from ramp audio to verify start_time is applied exactly once."""
    import struct
    import subprocess
    import wave

    sample_rate = 8000
    duration = 5.0
    total_samples = int(sample_rate * duration)
    wav_path = tmp_path / "ramp.wav"

    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        data = bytearray()
        for i in range(total_samples):
            val = int((i / total_samples) * 30000)
            data.extend(struct.pack("<h", val))
        wf.writeframes(data)

    intermediate = tmp_path / "intermediate.mp4"
    output = tmp_path / "output.mp4"

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=720x1280:r=30:d=3",
            "-c:v",
            "libx264",
            str(intermediate),
        ],
        check=True,
        capture_output=True,
    )

    music = MusicSelection(
        track_id="ramp",
        track_name="Ramp",
        source_path=str(wav_path),
        source_duration=5.0,
        start_time=1.0,
        end_time=4.5,
        volume=1.0,
        loop_if_needed=False,
        preserve_original_audio=False,
    )

    render_final_overlay(
        intermediate_path=intermediate,
        output_path=output,
        overlay_filter=None,
        logo_path=None,
        logo_windows=[],
        target_duration=3.0,
        music=music,
        music_file_path=wav_path,
    )

    # Decode audio slice at t=1.0s of output (target source time = 1.0 + 1.0 = 2.0s)
    # Expected amplitude around 12000 / sqrt(2) ≈ 8500-8600.
    # If double offset had occurred, source time would be 3.0s (amplitude ~12700).
    res = subprocess.run(
        [
            "ffmpeg",
            "-ss",
            "1.0",
            "-i",
            str(output),
            "-t",
            "0.05",
            "-f",
            "s16le",
            "-ar",
            "8000",
            "-ac",
            "1",
            "-",
        ],
        capture_output=True,
        check=True,
    )

    samples = [struct.unpack("<h", res.stdout[i : i + 2])[0] for i in range(0, len(res.stdout), 2)]
    assert len(samples) > 0
    avg_sample = sum(samples) / len(samples)
    # Single offset gives ~8588. Double offset would give ~12700.
    assert 7000 < avg_sample < 10000, f"Expected single offset sample (~8588), got {avg_sample}"


def test_overlay_timing_and_logo_deduplication(tmp_path: Path):
    """F-23: Overlay windows are shifted by template + intro, and logo is not drawn twice when bumper is active."""
    from unittest.mock import patch

    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    clip_file = source_dir / "clip1.mp4"
    clip_file.write_bytes(b"\x00" * 100)

    logo_file = tmp_path / "logo.png"
    logo_file.write_bytes(b"\x00" * 100)

    template_file = tmp_path / "template.png"
    template_file.write_bytes(b"\x00" * 100)

    captured_args = ()
    captured_kwargs = {}

    def mock_render_final_overlay(*args, **kwargs):
        nonlocal captured_args
        captured_args = args
        captured_kwargs.update(kwargs)

    with (
        patch("app.services.reel_editor_renderer.get_video_metadata") as mock_meta,
        patch("app.services.reel_editor_renderer.run_ffmpeg"),
        patch("app.services.reel_editor_renderer.build_bumper_clip"),
        patch("app.services.reel_editor_renderer.concatenate_clips"),
        patch("app.services.reel_editor_renderer.render_final_overlay", side_effect=mock_render_final_overlay),
        patch("app.services.reel_editor_renderer.get_logo_placement", return_value="start"),
        patch("app.services.reel_editor_renderer.extract_clip"),
        patch("app.services.reel_editor_renderer.validate_output") as mock_val,
    ):
        from app.services.video_metadata import VideoMetadata

        mock_val.return_value = VideoMetadata(
            filename="out.mp4",
            duration=15.0,
            width=1080,
            height=1920,
            fps=30.0,
            video_codec="h264",
            audio_codec="aac",
            format="mp4",
            file_size=1000,
        )

        def meta_side_effect(path):
            p = str(path)
            dur = 0.5 if "template" in p else (2.0 if "bumper" in p else 5.0)
            return VideoMetadata(
                filename="v.mp4",
                duration=dur,
                width=1080,
                height=1920,
                fps=30.0,
                video_codec="h264",
                audio_codec="aac",
                format="mp4",
                file_size=1000,
            )

        mock_meta.side_effect = meta_side_effect

        clip = PlannedReelClip(
            position=1,
            source_file="clip1.mp4",
            original_start=0.0,
            original_end=5.0,
            planned_start=0.0,
            planned_end=5.0,
            planned_duration=5.0,
            score=90,
            shot_role=ShotRole.HERO,
            role_confidence=0.9,
        )
        plan = ReelPlan(
            target_duration=10.0,
            estimated_duration=5.0,
            duration_difference=0.0,
            clips=[clip],
            processing_time_seconds=0.0,
            intro_seconds=2.0,
            outro_seconds=2.0,
            branding=BrandingConfig(brand_name="TestBrand", logo_path=str(logo_file), brand_placement="start"),
        )

        compose_reel_from_editor_plan(
            plan,
            source_dir=source_dir,
            output_path=tmp_path / "out.mp4",
            template_image_path=template_file,
        )

    # render_final_overlay(reel_path, out_path, overlay_filter, logo_path, logo_windows, target_duration)
    overlay_filter = captured_args[2]
    logo_windows = captured_args[4]

    # Logo must not be drawn as overlay when bumper is active (intro_actual > 0)
    assert logo_windows == [], "Expected empty logo_windows when bumper already rendered logo"
    # Content overlay window must start at 2.5s (0.5s template + 2.0s intro)
    assert "between(t,2.500," in overlay_filter, f"Expected overlay starting at 2.500s, got: {overlay_filter}"



