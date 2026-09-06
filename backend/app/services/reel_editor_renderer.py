"""Phase 8: renders a full editor ReelPlan (per-clip transitions, branding,
timed product overlays) into the final MP4.

Reuses Phase 5's per-clip reframe/extract math (extract_clip, including its
Phase 8 zoom-filter hook), source resolution/validation, and ffmpeg
plumbing. Only concatenation and the final overlay pass differ from
Phase 5/6/7's compose_reel/compose_reel_from_plan, because crossfade
transitions and multiple time-windowed text overlays require an ffmpeg
filter graph that plain stream-copy concat and Phase 5's always-on drawtext
can't express. Nothing in reel_composer.py's existing functions is
rewritten - only reused.
"""

import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

from app.schemas.reel import PlannedClip, ReelResult
from app.schemas.story import (
    BrandingConfig,
    MusicSelection,
    OverlayConfig,
    PlannedReelClip,
    ProductOverlayInfo,
    ReelPlan,
    TransitionConfig,
)
from app.schemas.video import VideoMetadata
from app.services.ffmpeg_service import run_ffmpeg
from app.services.music_service import get_track_duration
from app.services.brand_service import get_brand_config, get_brand_logo_path
from app.services.reel_bumpers import build_bumper_clip
from app.services.reel_composer import (
    DEFAULT_FPS,
    DEFAULT_TARGET_HEIGHT,
    DEFAULT_TARGET_WIDTH,
    EmptySelectionError,
    ReelCompositionConfig,
    _default_font_file,
    _escape_drawtext,
    _escape_font_path,
    concatenate_clips,
    extract_clip,
    resolve_source_path,
    validate_clip_timestamps,
)
from app.services.reel_planner import to_composer_planned_clips
from app.services.video_metadata import get_video_metadata
from app.services.video_processor import validate_output

# Intro-to-clip-1 and last-clip-to-outro are plain hard cuts, like every
# other junction now - the bumper's OWN fade-in/fade-out (baked into its
# pixels by build_bumper_clip) already provides a soft visual entrance/exit
# without needing a cross-clip blend.
_NO_TRANSITION = TransitionConfig()

# Mobile-safe margins for a 1080x1920 Reel: keep clear of the top
# camera/status-bar region and the bottom Instagram/Reels UI (like/share/
# caption) region, and inset from the side edges.
SAFE_MARGIN_TOP = 140
SAFE_MARGIN_BOTTOM = 220
SAFE_MARGIN_SIDES = 60
LINE_HEIGHT = 56

# accent_color only applies to "price" (a small highlight, per spec section
# 11) - every other role uses the configured text_color.
_ACCENT_ROLES = {"price"}


@dataclass
class TimelinePlan:
    offsets: list[float]  # start offset of each clip within the final timeline
    junctions: list[tuple[str, float, float]]  # (xfade_type, duration, offset), one per clip after the first
    total_duration: float


def compute_timeline_plan(planned_clips: list[PlannedClip]) -> TimelinePlan:
    """Single source of truth for clip timing. Every clip keeps its full
    planned duration - transitions are never a cross-clip blend that
    consumes timeline (that was xfade/acrossfade's job in an earlier
    version of this renderer, and it was the repeated root cause of a real
    bug class: an xfade chain long or fragile enough could silently
    terminate the video stream far short of its intended length while
    audio/container kept running to the full duration - observed on real
    footage multiple times, at different trigger conditions, despite
    successive targeted fixes).

    Instead, "transition_in" is purely a request for a duration-preserving
    VISUAL EFFECT baked into the incoming clip's own footage during
    extraction (see reel_composer.build_transition_filter for zoom/fade;
    slide degrades to a clean cut) - it never changes this clip's offset or
    the timeline's total duration. Concatenation is therefore always a
    plain hard-cut (see concatenate_clips), which is what guarantees
    total_duration == sum of every clip's duration, exactly, regardless of
    how many clips or transitions are involved.
    """
    if not planned_clips:
        return TimelinePlan(offsets=[], junctions=[], total_duration=0.0)

    offsets: list[float] = []
    combined = 0.0
    for clip in planned_clips:
        offsets.append(combined)
        combined += clip.duration

    return TimelinePlan(offsets=offsets, junctions=[], total_duration=round(combined, 3))


def _stack_lines(lines: list[tuple[str, str]], start: float, end: float, anchor: str) -> list[dict]:
    """Turns an ordered list of (text, role) lines into stacked windows
    sharing one time window. `anchor="bottom"` sits the block just above
    the bottom safe margin (last line closest to the edge, like a lower
    third); `anchor="top"` sits it just below the top safe margin.
    """
    n = len(lines)
    stacked = []
    for i, (text, role) in enumerate(lines):
        if anchor == "bottom":
            y_expr = f"h-{SAFE_MARGIN_BOTTOM + (n - 1 - i) * LINE_HEIGHT}"
        else:
            y_expr = str(SAFE_MARGIN_TOP + i * LINE_HEIGHT)
        stacked.append({"text": text, "start": start, "end": end, "role": role, "y_expr": y_expr})
    return stacked


def resolve_overlay_windows(
    story_clips: list[PlannedReelClip],
    timeline: TimelinePlan,
    branding: BrandingConfig,
    product: ProductOverlayInfo,
    overlays: OverlayConfig,
) -> list[dict]:
    """Turns placement configuration into concrete, stacked (text, start,
    end, y_expr) windows on the FINAL timeline. Pure/deterministic - no
    ffmpeg involved. Overlays never span the whole Reel (section 14) except
    an explicit watermark. Fields aimed at the same time window (e.g. brand
    + product name both "beginning") are stacked as a professional
    multi-line block (section 15) rather than colliding at one position.

    `story_clips` must be sorted by position and index-aligned with
    `timeline` (i.e. the same order passed to compute_timeline_plan via
    to_composer_planned_clips) so timeline.offsets[i] matches story_clips[i].
    """
    total_duration = timeline.total_duration
    windows: list[dict] = []
    zones: dict[tuple[float, float], list[tuple[str, str]]] = {}

    def clip_window(position: int, requested_duration: float) -> tuple[float, float] | None:
        index = next((i for i, c in enumerate(story_clips) if c.position == position), None)
        if index is None:
            return None
        clip_start = timeline.offsets[index]
        clip_cap = clip_start + story_clips[index].planned_duration
        return clip_start, min(clip_start + requested_duration, clip_cap)

    def add(window: tuple[float, float] | None, text: str | None, role: str) -> None:
        if not window or not text:
            return
        key = (round(window[0], 2), round(window[1], 2))
        zones.setdefault(key, []).append((text, role))

    beginning_window = (0.0, min(branding.intro_duration, total_duration))
    end_window = (max(total_duration - branding.intro_duration, 0.0), total_duration)

    if branding.brand_name:
        placement = overlays.brand_placement
        if placement in ("beginning", "beginning_and_end"):
            add(beginning_window, branding.brand_name, "brand")
        if placement in ("end", "beginning_and_end"):
            add(end_window, branding.brand_name, "brand")
        # An independent, persistent toggle - not gated behind placement.
        if placement == "watermark" or branding.show_watermark:
            windows.append(
                {"text": branding.brand_name, "start": 0.0, "end": total_duration, "role": "watermark",
                 "y_expr": str(SAFE_MARGIN_TOP - 60)}
            )

    product_line = None
    if product.product_name and product.category:
        product_line = f"{product.product_name} · {product.category}"
    elif product.product_name:
        product_line = product.product_name
    elif product.category:
        product_line = product.category

    if product_line and overlays.product_placement != "none":
        if overlays.product_placement == "beginning":
            add(beginning_window, product_line, "product")
        elif overlays.product_placement == "end":
            add(end_window, product_line, "product")

    if overlays.material_placement != "none":
        material_window = None
        if overlays.material_placement == "beginning":
            material_window = beginning_window
        elif overlays.material_placement == "end":
            material_window = end_window
        elif overlays.material_placement in ("detail_clip", "selected_clip") and overlays.material_clip_position is not None:
            material_window = clip_window(overlays.material_clip_position, overlays.material_duration)

        add(material_window, product.material, "material")
        add(material_window, product.color, "detail_secondary")
        if material_window not in (beginning_window, end_window):
            # A dedicated detail-clip callout can also carry the category
            # (spec section 15's DETAIL example: material / color / category).
            add(material_window, product.category, "detail_secondary")

    if product.price and overlays.price_placement != "none":
        price_window = None
        if overlays.price_placement == "beginning":
            price_window = beginning_window
        elif overlays.price_placement == "end":
            price_window = end_window
        elif overlays.price_placement == "final_clip" and story_clips:
            price_window = clip_window(story_clips[-1].position, overlays.price_duration)
        add(price_window, product.price, "price")

    for (start, end), lines in zones.items():
        # Blocks touching either edge of the Reel read as a lower-third;
        # a mid-timeline block (e.g. a detail clip's own callout) sits in
        # the upper safe area instead, so it never collides with a
        # persistent watermark or an edge-anchored block.
        anchor = "bottom" if start <= 0.01 or end >= total_duration - 0.01 else "top"
        windows.extend(_stack_lines(lines, start, end, anchor))

    return windows


def build_timed_overlay_filter(
    windows: list[dict], font_file: str | None, font: "FontConfig | None" = None
) -> str | None:
    if not windows or font_file is None:
        return None

    from app.schemas.story import FontConfig as _FontConfig

    font = font or _FontConfig()
    size_by_role = {"brand": font.headline_size, "price": font.price_size}

    clauses = []
    escaped_font = _escape_font_path(font_file)
    for window in windows:
        role = window["role"]
        fontsize = size_by_role.get(role, font.body_size)
        fontcolor = font.accent_color if role in _ACCENT_ROLES and font.accent_color else font.text_color
        y_expr = window.get("y_expr", f"h-{SAFE_MARGIN_BOTTOM}")
        # Horizontally centered; SAFE_MARGIN_SIDES is respected in practice
        # since overlay text is short marketing copy, well under the
        # 1080 - 2*SAFE_MARGIN_SIDES safe width at these font sizes.
        x_expr = "(w-text_w)/2"
        clauses.append(
            f"drawtext=fontfile='{escaped_font}':"
            f"text='{_escape_drawtext(window['text'])}':"
            f"fontcolor={fontcolor}:fontsize={fontsize}:"
            # Automatic contrast: a semi-transparent dark backing panel
            # behind every overlay, rather than assuming raw text is
            # readable over arbitrary footage (spec section 12).
            "box=1:boxcolor=black@0.45:boxborderw=10:"
            f"x={x_expr}:y={y_expr}:"
            f"enable='between(t,{window['start']:.3f},{window['end']:.3f})'"
        )
    return ",".join(clauses)


MUSIC_FADE_SECONDS = 0.75


# Logo sits just inside the frame edge, clear of where stacked text starts
# (SAFE_MARGIN_TOP / SAFE_MARGIN_BOTTOM) so the two never overlap.
_LOGO_POSITION_EXPR = {
    "top_left": (str(SAFE_MARGIN_SIDES), "30"),
    "top_right": (f"W-w-{SAFE_MARGIN_SIDES}", "30"),
    "bottom_left": (str(SAFE_MARGIN_SIDES), "H-h-30"),
    "bottom_right": (f"W-w-{SAFE_MARGIN_SIDES}", "H-h-30"),
}


def render_final_overlay(
    intermediate_path: Path,
    output_path: Path,
    overlay_filter: str | None,
    logo_path: Path | None,
    logo_windows: list[tuple[float, float]],
    target_duration: float,
    music: MusicSelection | None = None,
    music_file_path: Path | None = None,
    logo_size: int = 120,
    logo_position: str = "top_left",
) -> None:
    """Phase 9: if `music` is given, it becomes the primary background
    audio - fitted to exactly `target_duration` (segment start/end, looped
    if the chosen segment is shorter than the Reel, faded in/out within the
    Reel's own duration - never extending it), optionally mixed quietly
    with the original clip audio. Without music, falls back to Phase 8's
    plain pass-through of the intermediate file's own audio.
    """
    args = ["-i", str(intermediate_path)]
    next_input_index = 1
    music_index = None
    logo_index = None

    if music is not None and music_file_path is not None:
        segment_duration = (music.end_time if music.end_time is not None else music.source_duration) - music.start_time
        if segment_duration + 0.05 < target_duration and music.loop_if_needed:
            args += ["-stream_loop", "-1"]
        args += ["-ss", str(music.start_time), "-i", str(music_file_path)]
        music_index = next_input_index
        next_input_index += 1

    if logo_path and logo_windows:
        args += ["-i", str(logo_path)]
        logo_index = next_input_index
        next_input_index += 1

    filter_parts = []
    video_label = "0:v"

    if logo_index is not None:
        enable_expr = "+".join(f"between(t,{s:.3f},{e:.3f})" for s, e in logo_windows)
        x_expr, y_expr = _LOGO_POSITION_EXPR.get(logo_position, _LOGO_POSITION_EXPR["top_left"])
        # Scale to logo_size width (never render the logo at its native
        # resolution - a large title-card-sized logo would dominate the
        # product visual, per spec section 9/10).
        filter_parts.append(f"[{logo_index}:v]scale={logo_size}:-1[logoscaled]")
        filter_parts.append(
            f"[{video_label}][logoscaled]overlay=x={x_expr}:y={y_expr}:enable='{enable_expr}'[vlogo]"
        )
        video_label = "vlogo"

    if overlay_filter:
        filter_parts.append(f"[{video_label}]{overlay_filter}[vtext]")
        video_label = "vtext"

    audio_label = None
    if music_index is not None:
        fade_out_start = max(target_duration - MUSIC_FADE_SECONDS, 0.0)
        music_chain = (
            f"[{music_index}:a]atrim=0:{target_duration:.3f},"
            f"afade=t=in:st=0:d={MUSIC_FADE_SECONDS},"
            f"afade=t=out:st={fade_out_start:.3f}:d={MUSIC_FADE_SECONDS},"
            f"volume={music.volume}[amusic]"
        )
        filter_parts.append(music_chain)
        if music.preserve_original_audio:
            filter_parts.append("[0:a]volume=0.15[aquiet]")
            filter_parts.append("[amusic][aquiet]amix=inputs=2:duration=first:dropout_transition=0[aout]")
            audio_label = "aout"
        else:
            audio_label = "amusic"

    if filter_parts:
        args += ["-filter_complex", ";".join(filter_parts), "-map", f"[{video_label}]"]
    else:
        args += ["-map", "0:v"]

    args += ["-map", f"[{audio_label}]" if audio_label else "0:a"]
    args += [
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k",
        "-t", str(target_duration),
        "-movflags", "+faststart",
        # Cheap insurance: raise ffmpeg's small default muxer packet-queue
        # cap whenever a filter graph is in play (logo overlay + looped
        # music), so packets are never silently dropped under buffering
        # pressure instead of erroring.
        "-max_muxing_queue_size", "9999",
        str(output_path),
    ]
    run_ffmpeg(args)


def compose_reel_from_editor_plan(
    reel_plan: ReelPlan,
    source_dir: str | Path,
    output_path: str | Path,
    target_width: int = DEFAULT_TARGET_WIDTH,
    target_height: int = DEFAULT_TARGET_HEIGHT,
    fps: int = DEFAULT_FPS,
    music_path: str | Path | None = None,
) -> ReelResult:
    """Phase 8 entry point: the ReelPlan (clip order, trims, per-clip
    transitions, branding, product overlays) is the single source of truth
    for the render - no separate editor state.
    """
    if not reel_plan.clips:
        raise EmptySelectionError("Cannot compose a Reel from an empty clip plan")

    # The rendered identity always comes from the central brand config
    # (assets/branding/brand.json), never from whatever a client happened to
    # send - this is what lets the whole application be rebranded by editing
    # one config file, with no source change and no way for a stale/spoofed
    # request to render the wrong brand. Every other branding field (color,
    # logo position/size, placement, watermark toggle) stays user-editable.
    brand_config = get_brand_config()
    brand_logo_path = get_brand_logo_path()
    reel_plan = reel_plan.model_copy(
        update={
            "branding": reel_plan.branding.model_copy(
                update={
                    "brand_name": brand_config.name,
                    "logo_path": str(brand_logo_path) if brand_logo_path else None,
                }
            )
        }
    )

    planned_clips = to_composer_planned_clips(reel_plan)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    start = time.perf_counter()

    # config.transition stays "cut": Phase 5's own simple global fade_in/out
    # mechanism must not fire here - crossfades are handled by the xfade
    # chain below, and zooms by extract_clip's per-clip zoom hook.
    config = ReelCompositionConfig(target_width=target_width, target_height=target_height, fps=fps, transition="cut")

    source_metadata_cache: dict[str, VideoMetadata] = {}
    resolved_sources: dict[str, Path] = {}
    for planned in planned_clips:
        if planned.source_file not in resolved_sources:
            resolved_sources[planned.source_file] = resolve_source_path(planned.source_file, source_dir)
            source_metadata_cache[planned.source_file] = get_video_metadata(resolved_sources[planned.source_file])
        validate_clip_timestamps(planned, source_metadata_cache[planned.source_file])

    sorted_story_clips = sorted(reel_plan.clips, key=lambda c: c.position)

    with tempfile.TemporaryDirectory(prefix="autoreel_edit_") as tmp_dir_str:
        tmp_dir = Path(tmp_dir_str)
        clip_paths = []
        for i, planned in enumerate(planned_clips):
            clip_output = tmp_dir / f"clip_{i:03d}.mp4"
            extract_clip(
                resolved_sources[planned.source_file],
                source_metadata_cache[planned.source_file],
                planned,
                clip_output,
                config,
                fade_in=False,
                fade_out=False,
            )
            clip_paths.append(clip_output)

        # Real-world footage (variable frame rate, sparse/irregular keyframes)
        # can make extract_clip's actual output a little shorter or longer
        # than the nominal `planned.duration` the plan assumed - synthetic,
        # perfectly-CFR test fixtures never exposed this. compute_timeline_plan
        # must be built from what was ACTUALLY produced, or the xfade/
        # acrossfade offsets baked into the chain point past the end of a
        # real clip's content, and ffmpeg freeze-pads that clip's last frame
        # until the timeline catches up - a visible "stuck" playback stall at
        # whichever junction drifted.
        measured_clips = [
            planned.model_copy(update={"duration": get_video_metadata(path).duration})
            for planned, path in zip(planned_clips, clip_paths)
        ]

        # content_timeline positions product/brand overlays WITHIN the
        # content portion only, exactly as before bumpers existed - the
        # bumpers carry their own, separate branding (built into the bumper
        # clip itself) and must not be double-counted here.
        content_timeline = compute_timeline_plan(measured_clips)

        # Branded intro/outro bumpers (spec: "every generated Reel MUST
        # begin/end with..."). reel_plan.intro_seconds/outro_seconds are 0.0
        # unless the plan came from plan_reel(), which already reserved this
        # time out of the user's total target - so a hand-built ReelPlan
        # (as used throughout the existing test suite) renders exactly as it
        # did before this feature existed.
        intro_actual = 0.0
        render_clip_paths = list(clip_paths)
        render_measured_clips = list(measured_clips)
        if reel_plan.intro_seconds > 0 or reel_plan.outro_seconds > 0:
            # branding.logo_path was already forced to the central brand's
            # logo above, so this is just re-validating it still exists.
            bumper_logo_path = (
                Path(reel_plan.branding.logo_path)
                if reel_plan.branding.logo_path and Path(reel_plan.branding.logo_path).exists()
                else None
            )

            if reel_plan.intro_seconds > 0:
                intro_path = tmp_dir / "bumper_intro.mp4"
                build_bumper_clip(
                    intro_path, reel_plan.branding.brand_name, bumper_logo_path,
                    target_width, target_height, fps,
                    duration=reel_plan.intro_seconds, fade_in=True, fade_out=False,
                    text_color=brand_config.primary_color,
                )
                intro_actual = get_video_metadata(intro_path).duration
                intro_clip = PlannedClip(
                    source_file="__bumper_intro__", start_time=0.0, end_time=intro_actual,
                    duration=intro_actual, score=100, transition_in=TransitionConfig(),
                )
                render_clip_paths = [intro_path] + render_clip_paths
                first_content = render_measured_clips[0].model_copy(update={"transition_in": _NO_TRANSITION})
                render_measured_clips = [intro_clip, first_content] + render_measured_clips[1:]

            if reel_plan.outro_seconds > 0:
                outro_path = tmp_dir / "bumper_outro.mp4"
                build_bumper_clip(
                    outro_path, reel_plan.branding.brand_name, bumper_logo_path,
                    target_width, target_height, fps,
                    duration=reel_plan.outro_seconds, fade_in=False, fade_out=True,
                    text_color=brand_config.primary_color,
                )
                outro_actual = get_video_metadata(outro_path).duration
                outro_clip = PlannedClip(
                    source_file="__bumper_outro__", start_time=0.0, end_time=outro_actual,
                    duration=outro_actual, score=100, transition_in=_NO_TRANSITION,
                )
                render_clip_paths = render_clip_paths + [outro_path]
                render_measured_clips = render_measured_clips + [outro_clip]

        render_timeline = compute_timeline_plan(render_measured_clips)

        # Phase 9 critical invariant (section 29): video duration = music
        # duration = target duration. If the actual video content falls short
        # of the target (insufficient footage even after compensation), audio
        # must be capped to match it - never let looped/extended music run
        # past where the video ends.
        render_duration = min(reel_plan.target_duration, render_timeline.total_duration)

        # Configured font_family takes priority, but a missing/invalid path
        # must never crash the render - fall back to a bundled system font.
        configured_font = reel_plan.font.font_family
        font_file = configured_font if configured_font and Path(configured_font).exists() else _default_font_file()
        windows = resolve_overlay_windows(
            sorted_story_clips, content_timeline, reel_plan.branding, reel_plan.product, reel_plan.overlays
        )
        if intro_actual > 0:
            # Shift every content overlay window by the intro's real
            # duration - the content no longer starts at t=0 in the final
            # render, the bumper does.
            windows = [{**w, "start": w["start"] + intro_actual, "end": w["end"] + intro_actual} for w in windows]
        # brand_color (section 11: "use it for... price accent") is the
        # default accent source; an explicit font.accent_color always wins if
        # the user set one directly.
        effective_font = reel_plan.font
        accent_color = reel_plan.branding.brand_color or brand_config.primary_color
        if effective_font.accent_color is None and accent_color:
            effective_font = effective_font.model_copy(update={"accent_color": accent_color})
        overlay_filter = build_timed_overlay_filter(windows, font_file, effective_font)

        logo_path = None
        logo_windows: list[tuple[float, float]] = []
        if reel_plan.branding.logo_path:
            candidate_logo = Path(reel_plan.branding.logo_path)
            if candidate_logo.exists():
                logo_path = candidate_logo
                if reel_plan.branding.show_logo_at_start:
                    logo_windows.append(
                        (0.0, min(reel_plan.branding.intro_duration, content_timeline.total_duration))
                    )
                if reel_plan.branding.show_logo_at_end:
                    logo_windows.append(
                        (
                            max(content_timeline.total_duration - reel_plan.branding.intro_duration, 0.0),
                            content_timeline.total_duration,
                        )
                    )
                if intro_actual > 0:
                    logo_windows = [(s + intro_actual, e + intro_actual) for s, e in logo_windows]
            # else: no logo file found - degrade gracefully to brand text
            # only, which build_timed_overlay_filter above already handles.

        intermediate_path = tmp_dir / "concatenated.mp4"
        if len(render_clip_paths) == 1:
            intermediate_path = render_clip_paths[0]
        else:
            # Plain hard-cut concatenation (hard cut, no re-encode - safe
            # because every clip was produced by extract_clip with
            # identical codec/fps/pix_fmt/audio params). Every clip already
            # carries its own duration-preserving transition effect baked
            # in by extract_clip (zoom in-place, fade-in-place); there is no
            # cross-clip blend left to negotiate here, so this concatenation
            # can never come out shorter than the sum of the clips' own
            # durations - the exact guarantee an xfade-based chain kept
            # breaking on long/real-world footage.
            concatenate_clips(render_clip_paths, intermediate_path, tmp_dir)

        music_selection = reel_plan.music
        music_file_path = None
        if music_selection is not None:
            candidate_music = Path(music_selection.source_path)
            if candidate_music.exists():
                music_file_path = candidate_music
            # else: configured music file missing - degrade gracefully,
            # render without music rather than failing the whole Reel.
        elif music_path is not None:
            # Legacy (Phase 5/6/7) callers that only ever pass a bare path.
            legacy_path = Path(music_path)
            if legacy_path.exists():
                music_file_path = legacy_path
                music_selection = MusicSelection(
                    track_id="legacy",
                    track_name=legacy_path.stem,
                    source_path=str(legacy_path),
                    source_duration=get_track_duration(legacy_path),
                    start_time=0.0,
                    end_time=None,
                    volume=0.7,
                    loop_if_needed=True,
                )

        render_final_overlay(
            intermediate_path,
            output_path,
            overlay_filter,
            logo_path,
            logo_windows,
            render_duration,
            music=music_selection,
            music_file_path=music_file_path,
            logo_size=reel_plan.branding.logo_size,
            logo_position=reel_plan.branding.logo_position,
        )

    processing_time_seconds = round(time.perf_counter() - start, 3)
    output_metadata = validate_output(output_path, target_width, target_height, expect_audio=True)

    # Phase 9 critical invariant: final_duration ≈ target_duration. Measured
    # via ffprobe (output_metadata.duration), not assumed from the plan -
    # this is the ground truth the user actually receives.
    target_duration = reel_plan.target_duration
    tolerance = max(0.5, target_duration * 0.05)
    duration_status = "ok" if abs(output_metadata.duration - target_duration) <= tolerance else "insufficient_content"

    return ReelResult(
        output_path=str(output_path),
        duration=output_metadata.duration,
        width=output_metadata.width,
        height=output_metadata.height,
        video_codec=output_metadata.video_codec,
        audio_codec=output_metadata.audio_codec,
        clip_count=len(planned_clips),
        planned_clips=planned_clips,
        processing_time_seconds=processing_time_seconds,
        target_duration=target_duration,
        duration_status=duration_status,
    )
