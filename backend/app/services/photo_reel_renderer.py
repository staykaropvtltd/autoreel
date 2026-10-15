"""Free server-side renderer for saved Image-to-Reel projects.

This module intentionally has no dependency on the credit service or the paid
video-reel generation pipeline.
"""
import json
import subprocess
import tempfile
import uuid
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from app.core.storage import TEMP_DIR
from app.services import template_service
from app.services.ffmpeg_service import run_ffmpeg


def _font(size: int):
    for name in ("arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_photo_reel(project: dict, user_id: int, output: Path, db) -> dict:
    settings = project["settings"]
    width, height = int(settings["width"]), int(settings["height"])
    fps = int(settings["fps"])
    overlays = project.get("overlays") or {}
    output.parent.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix="photo-reel-", dir=TEMP_DIR))
    clip_paths: list[Path] = []
    total = 0.0
    try:
        for index, slide in enumerate(project["slides"]):
            template = template_service.get_owned_template(db, slide["asset_id"], user_id)
            if template is None:
                raise ValueError("A slide image is missing or is not owned by this account.")
            image_bytes = template_service.get_object(
                template_service.validate_storage_path(template.storage_path, user_id, template.id)
            )
            src = work / f"source_{index:04d}{Path(template.original_filename).suffix.lower()}"
            src.write_bytes(image_bytes)
            with Image.open(src) as opened:
                source_image = opened.convert("RGB")
                if slide.get("fitMode") == "contain":
                    fitted = ImageOps.contain(source_image, (width, height), method=Image.Resampling.LANCZOS)
                    frame = Image.new("RGB", (width, height), (0, 0, 0))
                    frame.paste(fitted, ((width - fitted.width) // 2, (height - fitted.height) // 2))
                else:
                    frame = ImageOps.fit(source_image, (width, height), method=Image.Resampling.LANCZOS)
            draw = ImageDraw.Draw(frame, "RGBA")
            title = str(overlays.get("title") or "")[:160]
            subtitle = str(overlays.get("subtitle") or "")[:200]
            brand = str(overlays.get("brandName") or "")[:100]
            if brand and overlays.get("brandWatermarkPosition", "none") != "none":
                pos = overlays.get("brandWatermarkPosition")
                xy = (width - 60, 90) if pos == "top-right" else ((60, 90) if pos == "top-left" else (width // 2, 90))
                draw.text(xy, brand.upper(), font=_font(max(22, width // 42)), fill=(255, 255, 255, 230), anchor="mm")
            if overlays.get("showLogo"):
                import io
                logo_template_id = overlays.get("logo_asset_id")
                logo_data = None
                if logo_template_id:
                    logo_row = template_service.get_owned_template(db, logo_template_id, user_id)
                    if logo_row is None:
                        raise ValueError("The project logo image is missing or is not owned by this account.")
                    logo_data = (template_service.get_object(template_service.validate_storage_path(logo_row.storage_path, user_id, logo_row.id)), logo_row.content_type)
                if logo_data:
                    with Image.open(io.BytesIO(logo_data[0])) as logo_src:
                        logo = logo_src.convert("RGBA")
                    target_width = min(width // 2, int(overlays.get("logoSize", 130) * width / 720))
                    target_height = max(1, round(logo.height * target_width / logo.width))
                    logo.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)
                    alpha = logo.getchannel("A").point(lambda value: round(value * float(overlays.get("logoOpacity", 0.95))))
                    logo.putalpha(alpha)
                    pos = overlays.get("logoPosition", "top-right")
                    x = 40 if "left" in pos else (width - logo.width - 40 if "right" in pos else (width - logo.width) // 2)
                    y = 40 if pos in {"top", "top-left", "top-right"} else (height - logo.height - 70 if pos in {"bottom-left", "down", "bottom-right"} else (height - logo.height) // 2)
                    frame.paste(logo, (x, y), logo)
            if title:
                y = height - 360 if overlays.get("titlePosition") == "bottom" else (height // 2 if overlays.get("titlePosition") == "center" else 300)
                draw.text((width // 2, y), title, font=_font(max(28, int(overlays.get("titleSize") or 38) * width / 720)), fill=(255, 255, 255, 255), anchor="mm", stroke_width=2, stroke_fill=(0, 0, 0, 180))
                if subtitle:
                    draw.text((width // 2, y + 64), subtitle, font=_font(max(18, width // 48)), fill=(255, 255, 255, 235), anchor="mm", stroke_width=1, stroke_fill=(0, 0, 0, 170))
            if overlays.get("showPriceTag") and overlays.get("price"):
                price_text = str(overlays["price"])[:30]
                box = draw.textbbox((0, 0), price_text, font=_font(max(22, width // 40)))
                box_width = box[2] - box[0]
                right, top = width - 48, height - 220
                draw.rounded_rectangle((right - box_width - 48, top - 20, right, top + 52), radius=18, fill=(0, 0, 0, 190))
                draw.text((right - 24, top + 16), price_text, font=_font(max(22, width // 40)), fill=(255, 255, 255, 255), anchor="rm")
            if overlays.get("showCtaBadge") and overlays.get("ctaText"):
                draw.text((width // 2, height - 145), str(overlays["ctaText"])[:100], font=_font(max(20, width // 44)), fill=(255, 255, 255, 245), anchor="mm", stroke_width=2, stroke_fill=(0, 0, 0, 190))
            if index == len(project["slides"]) - 1 and overlays.get("showEndCard"):
                end_title = str(overlays.get("endCardText") or "")[:100]
                end_subtitle = str(overlays.get("endCardSubtext") or "")[:200]
                if end_title:
                    draw.rounded_rectangle((width * 0.08, height * 0.38, width * 0.92, height * 0.62), radius=32, fill=(0, 0, 0, 175))
                    draw.text((width // 2, height // 2 - 24), end_title, font=_font(max(28, width // 36)), fill=(255, 255, 255, 255), anchor="mm")
                    if end_subtitle:
                        draw.text((width // 2, height // 2 + 40), end_subtitle, font=_font(max(17, width // 52)), fill=(255, 255, 255, 235), anchor="mm")
            prepared = work / f"frame_{index:04d}.jpg"
            frame.save(prepared, quality=94)
            duration = float(slide["duration"])
            frames = max(1, round(duration * fps))
            motion = slide["motion"]
            if motion == "zoom_out":
                zoom = "max(1.0,1.12-on/" + str(frames * 9) + ")"
                x = "iw/2-(iw/zoom/2)"; y = "ih/2-(ih/zoom/2)"
            elif motion == "pan_left":
                zoom = "1.10"; x = "(iw-iw/zoom)*(1-on/" + str(frames) + ")"; y = "ih/2-(ih/zoom/2)"
            elif motion == "pan_right":
                zoom = "1.10"; x = "(iw-iw/zoom)*on/" + str(frames); y = "ih/2-(ih/zoom/2)"
            elif motion == "zoom_in":
                zoom = "min(1.12,1+on/" + str(frames * 9) + ")"; x = "iw/2-(iw/zoom/2)"; y = "ih/2-(ih/zoom/2)"
            else:
                zoom = "1"; x = "iw/2-(iw/zoom/2)"; y = "ih/2-(ih/zoom/2)"
            clip = work / f"clip_{index:04d}.mp4"
            run_ffmpeg(["-loop", "1", "-i", str(prepared), "-vf", f"zoompan=z='{zoom}':x='{x}':y='{y}':d={frames}:s={width}x{height}:fps={fps},format=yuv420p", "-frames:v", str(frames), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", str(clip)])
            clip_paths.append(clip)
            total += frames / fps

        joined = work / "joined.mp4"
        if len(clip_paths) == 1:
            run_ffmpeg(["-i", str(clip_paths[0]), "-c", "copy", str(joined)])
        else:
            graph = []
            timeline = max(1, round(float(project["slides"][0]["duration"]) * fps)) / fps
            for index in range(1, len(clip_paths)):
                transition = project["slides"][index]["transition"]
                transition_duration = 0.30 if transition in {"crossfade", "slide"} else 1 / fps
                transition_name = "fade" if transition == "crossfade" else ("slideright" if transition == "slide" else "fade")
                offset = max(0.0, timeline - transition_duration)
                prev_label = "0:v" if index == 1 else f"x{index - 1}"
                out_label = f"x{index}"
                graph.append(f"[{prev_label}][{index}:v]xfade=transition={transition_name}:duration={transition_duration:.4f}:offset={offset:.4f}[{out_label}]")
                current_duration = max(1, round(float(project["slides"][index]["duration"]) * fps)) / fps
                timeline += current_duration - transition_duration
            graph.append(f"[x{len(clip_paths)-1}]format=yuv420p[vout]")
            args = []
            for clip in clip_paths: args.extend(["-i", str(clip)])
            run_ffmpeg([*args, "-filter_complex", ";".join(graph), "-map", "[vout]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", str(joined)])
            total = timeline

        args = ["-i", str(joined)]
        audio_id = (project.get("audio") or {}).get("trackId")
        audio_path = None
        if audio_id:
            from app.api.music import get_libraries
            from app.services.music_service import (
                find_track_by_id, is_custom_track_id, materialize_owned_custom_track,
                get_owned_custom_track,
            )
            if is_custom_track_id(str(audio_id)):
                track = get_owned_custom_track(db, user_id, str(audio_id))
                if track is None:
                    raise ValueError("The selected soundtrack is unavailable.")
                audio_path = materialize_owned_custom_track(
                    db, user_id, str(audio_id), work / f"soundtrack.{track.file_format}"
                )
            else:
                track = find_track_by_id(get_libraries(), str(audio_id))
                if track is None:
                    raise ValueError("The selected soundtrack is unavailable.")
                audio_path = Path(track["_path"]).resolve()
            args.extend(["-ss", str(max(0, float((project.get("audio") or {}).get("offset") or 0))), "-i", str(audio_path)])
        if audio_path:
            args.extend(["-map", "0:v:0", "-map", "1:a:0", "-t", f"{total:.3f}", "-af", f"volume={max(0.0, min(1.0, float((project.get('audio') or {}).get('volume', 0.85))))},afade=t=out:st={max(0,total-0.5):.3f}:d={min(0.5,total):.3f}", "-c:a", "aac", "-shortest"])
        else:
            args.extend(["-map", "0:v:0", "-an"])
        args.extend(["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", str(fps), "-movflags", "+faststart", str(output)])
        run_ffmpeg(args)
        return {"duration_seconds": round(total, 3), "width": width, "height": height, "fps": fps, "bytes": output.stat().st_size}
    finally:
        import shutil
        shutil.rmtree(work, ignore_errors=True)
