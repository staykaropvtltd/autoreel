"""Deterministic, FFmpeg-generated branded intro/outro bumpers - no
AI-generated video. Plans use 2s intro and outro bumpers when they fit the
requested whole-file duration; shorter plans explicitly omit both. This
module builds those standalone clips. Concatenating them into the timeline
(alongside product clips) is reel_editor_renderer's job.

Brand-agnostic by construction: brand_name/logo_path/text_color are always
supplied by the caller (from app.services.brand_service's central config),
never hard-coded here - swapping the configured brand changes every bumper
without touching this module.
"""

from pathlib import Path

from app.services.ffmpeg_service import run_ffmpeg
from app.services.reel_composer import _default_font_file, _escape_drawtext, _escape_font_path
from app.services.video_metadata import get_video_metadata

BUMPER_DURATION_SECONDS = 2.0
_FADE_SECONDS = 0.4

# A restrained, neutral ground the configured logo/text sit on; the text
# color itself defaults here but is overridable per-brand (brand.json's
# primary_color) - see build_bumper_clip's text_color parameter.
_BACKGROUND_COLOR = "0xFAF7F2"  # warm ivory
_DEFAULT_TEXT_COLOR = "0x7A2048"  # deep maroon/berry


def build_bumper_clip(
    output_path: Path,
    brand_name: str,
    logo_path: Path | None,
    target_width: int,
    target_height: int,
    fps: int,
    duration: float = BUMPER_DURATION_SECONDS,
    fade_in: bool = True,
    fade_out: bool = True,
    text_color: str | None = None,
) -> None:
    """Renders one 2s branded segment: an ivory background, the configured
    logo centered (aspect-ratio preserved, never stretched), and the
    configured brand name below it. `fade_in`/`fade_out` control the
    bumper's OWN fade - the intro only fades in (its fade-out into clip 1 is
    a real crossfade handled by the timeline), the outro only fades out (its
    fade-in from the last clip is that same crossfade) - see
    reel_editor_renderer. Always includes a silent audio track so it
    concatenates safely alongside product clips, exactly like extract_clip's
    audio-less-source handling.
    """
    args = [
        "-f", "lavfi", "-i", f"color=c={_BACKGROUND_COLOR}:s={target_width}x{target_height}:d={duration}:r={fps}",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
    ]

    vf_parts = []
    filter_inputs = "[0:v]"
    next_input_index = 2

    logo_w = round(target_width * 0.42)
    logo_h = None
    if logo_path is not None and logo_path.exists():
        try:
            logo_meta = get_video_metadata(logo_path)
            logo_h = round(logo_w * logo_meta.height / logo_meta.width)
        except Exception:
            logo_h = round(logo_w * 0.54)  # fallback estimate if probing fails
        args += ["-i", str(logo_path)]
        logo_index = next_input_index
        next_input_index += 1
        logo_y = round(target_height * 0.36)
        vf_parts.append(f"[{logo_index}:v]scale={logo_w}:-1[logoscaled]")
        vf_parts.append(f"{filter_inputs}[logoscaled]overlay=x=(W-w)/2:y={logo_y}[withlogo]")
        filter_inputs = "[withlogo]"

    font_file = _default_font_file()
    if font_file is not None and brand_name:
        text_y = round(target_height * 0.36) + (logo_h or 0) + 50
        escaped_font = _escape_font_path(font_file)
        # ffmpeg drawtext wants "0xRRGGBB", not CSS's "#RRGGBB" - brand.json
        # follows the CSS convention since that's what the frontend consumes.
        resolved_color = (text_color or _DEFAULT_TEXT_COLOR).lstrip("#")
        if not resolved_color.startswith("0x"):
            resolved_color = f"0x{resolved_color}"
        vf_parts.append(
            f"{filter_inputs}drawtext=fontfile='{escaped_font}':text='{_escape_drawtext(brand_name)}':"
            f"fontcolor={resolved_color}:fontsize={round(target_width * 0.052)}:"
            f"x=(w-text_w)/2:y={text_y}[withtext]"
        )
        filter_inputs = "[withtext]"

    fade_clauses = []
    if fade_in:
        fade_clauses.append(f"fade=t=in:st=0:d={_FADE_SECONDS}")
    if fade_out:
        fade_clauses.append(f"fade=t=out:st={max(duration - _FADE_SECONDS, 0.0):.3f}:d={_FADE_SECONDS}")
    if fade_clauses:
        vf_parts.append(f"{filter_inputs}{','.join(fade_clauses)}[vout]")
        final_label = "[vout]"
    else:
        final_label = filter_inputs

    if vf_parts:
        args += ["-filter_complex", ";".join(vf_parts), "-map", final_label]
    else:
        args += ["-map", "0:v"]
    args += ["-map", "1:a"]

    args += [
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", str(fps),
        "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k",
        "-t", str(duration),
        str(output_path),
    ]
    run_ffmpeg(args)
