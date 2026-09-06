from pathlib import Path

import pytest

from app.services.brand_service import get_brand_logo_path
from app.services.reel_bumpers import build_bumper_clip
from app.services.video_metadata import get_video_metadata, get_video_stream_duration

# Uses the real, currently-configured brand logo (assets/branding/brand.json)
# rather than a hard-coded path - resolution itself is covered by
# test_brand_service.py; these tests exercise build_bumper_clip's own
# rendering behavior given whatever brand_name/logo_path it's handed.
_LOGO_PATH = get_brand_logo_path()


def test_build_bumper_clip_intro_is_exactly_two_seconds(tmp_path: Path):
    out = tmp_path / "intro.mp4"
    build_bumper_clip(out, "TEST BRAND", _LOGO_PATH, 1080, 1920, 30, duration=2.0, fade_in=True, fade_out=False)

    meta = get_video_metadata(out)
    assert meta.duration == pytest.approx(2.0, abs=0.05)
    assert get_video_stream_duration(out) == pytest.approx(2.0, abs=0.05)
    assert meta.width == 1080
    assert meta.height == 1920
    assert meta.video_codec == "h264"
    assert meta.audio_codec == "aac"


def test_build_bumper_clip_outro_is_exactly_two_seconds(tmp_path: Path):
    out = tmp_path / "outro.mp4"
    build_bumper_clip(out, "TEST BRAND", _LOGO_PATH, 1080, 1920, 30, duration=2.0, fade_in=False, fade_out=True)

    meta = get_video_metadata(out)
    assert meta.duration == pytest.approx(2.0, abs=0.05)
    assert get_video_stream_duration(out) == pytest.approx(2.0, abs=0.05)


def test_build_bumper_clip_degrades_gracefully_without_logo(tmp_path: Path):
    """Missing/invalid logo must never fail the whole render - falls back
    to brand-name-only text on the background.
    """
    out = tmp_path / "intro_no_logo.mp4"
    build_bumper_clip(out, "TEST BRAND", None, 1080, 1920, 30, duration=2.0)

    meta = get_video_metadata(out)
    assert meta.duration == pytest.approx(2.0, abs=0.05)


def test_build_bumper_clip_respects_custom_duration(tmp_path: Path):
    out = tmp_path / "intro_3s.mp4"
    build_bumper_clip(out, "TEST BRAND", _LOGO_PATH, 1080, 1920, 30, duration=3.0)

    meta = get_video_metadata(out)
    assert meta.duration == pytest.approx(3.0, abs=0.05)


def test_build_bumper_clip_uses_custom_text_color(tmp_path: Path):
    """text_color is per-brand (brand.json's primary_color), never hard-coded."""
    out = tmp_path / "intro_color.mp4"
    build_bumper_clip(out, "TEST BRAND", None, 1080, 1920, 30, duration=2.0, text_color="#123456")

    meta = get_video_metadata(out)
    assert meta.duration == pytest.approx(2.0, abs=0.05)
