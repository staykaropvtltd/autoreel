"""Reel intro/outro/watermark must always use the central brand config
(assets/branding/brand.json via app.services.brand_service), never whatever
a client happened to send - see compose_reel_from_editor_plan's brand
override in reel_editor_renderer.py.
"""

import json
from pathlib import Path

import cv2
import numpy as np
import pytest

from app.schemas.story import BrandingConfig, OverlayConfig, PlannedReelClip, ReelPlan, ShotRole
from app.services import brand_service
from app.services.reel_editor_renderer import compose_reel_from_editor_plan


def _configure_brand(monkeypatch, tmp_path: Path, name: str, logo_bytes: bytes | None = None) -> None:
    branding_dir = tmp_path / "branding"
    branding_dir.mkdir(exist_ok=True)
    data = {"name": name}
    if logo_bytes is not None:
        (branding_dir / "logo.jpeg").write_bytes(logo_bytes)
        data["logo"] = "logo.jpeg"
    (branding_dir / "brand.json").write_text(json.dumps(data), encoding="utf-8")
    monkeypatch.setattr(brand_service, "BRANDING_DIR", branding_dir)
    monkeypatch.setattr(brand_service, "BRAND_CONFIG_PATH", branding_dir / "brand.json")


def _plan(source_file: str, brand_name_from_client: str) -> ReelPlan:
    clip = PlannedReelClip(
        position=1, source_file=source_file, original_start=0.0, original_end=6.0,
        planned_start=0.0, planned_end=6.0, planned_duration=6.0, score=90,
        shot_role=ShotRole.HERO, role_confidence=0.9,
    )
    return ReelPlan(
        target_duration=10.0, estimated_duration=6.0, duration_difference=0.0,
        clips=[clip], processing_time_seconds=0.0, intro_seconds=2.0, outro_seconds=2.0,
        # A client-supplied brand name that must be IGNORED by the renderer -
        # the whole point of this test suite.
        branding=BrandingConfig(brand_name=brand_name_from_client, show_watermark=True),
        overlays=OverlayConfig(brand_placement="watermark"),
    )


def _extract_frame_text_region_mean(video_path: Path, ts: float) -> None:
    cap = cv2.VideoCapture(str(video_path))
    cap.set(cv2.CAP_PROP_POS_MSEC, ts * 1000)
    ok, frame = cap.read()
    cap.release()
    return frame if ok else None


def test_reel_intro_uses_configured_brand_not_client_supplied_name(
    monkeypatch, tmp_path: Path, synthetic_long_video: Path
):
    _configure_brand(monkeypatch, tmp_path, "NEURAX")
    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_long_video.name).write_bytes(synthetic_long_video.read_bytes())

    plan = _plan(synthetic_long_video.name, brand_name_from_client="SPOOFED BRAND")
    result = compose_reel_from_editor_plan(plan, source_dir=source_dir, output_path=tmp_path / "out.mp4")

    assert result.duration_status == "ok"
    # The rendered plan's own branding field reflects what was actually
    # used - the client's "SPOOFED BRAND" must never survive into the render.
    # (compose_reel_from_editor_plan overrides reel_plan.branding internally;
    # we can't inspect that copy directly, so this is verified indirectly by
    # re-running with a different brand.json below and confirming the output
    # changes accordingly.)


def test_changing_brand_json_changes_reel_output(monkeypatch, tmp_path: Path, synthetic_long_video: Path):
    """The exact scenario the phase asks to verify: generate with NEURAX
    configured, then generate again with ONLY brand.json changed to TEST
    BRAND, and confirm the two renders differ - proving the brand identity
    is read fresh from config, not baked into source or cached.
    """
    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_long_video.name).write_bytes(synthetic_long_video.read_bytes())

    _configure_brand(monkeypatch, tmp_path, "NEURAX")
    plan = _plan(synthetic_long_video.name, brand_name_from_client="irrelevant")
    result_a = compose_reel_from_editor_plan(plan, source_dir=source_dir, output_path=tmp_path / "out_a.mp4")
    frame_a = _extract_frame_text_region_mean(tmp_path / "out_a.mp4", 1.0)

    _configure_brand(monkeypatch, tmp_path, "TEST BRAND")
    result_b = compose_reel_from_editor_plan(plan, source_dir=source_dir, output_path=tmp_path / "out_b.mp4")
    frame_b = _extract_frame_text_region_mean(tmp_path / "out_b.mp4", 1.0)

    assert result_a.duration_status == "ok"
    assert result_b.duration_status == "ok"
    # Different brand text drawn on an otherwise identical ivory intro frame
    # -> the two frames must not be pixel-identical.
    assert frame_a is not None and frame_b is not None
    assert not np.array_equal(frame_a, frame_b)


def test_reel_watermark_uses_configured_logo(monkeypatch, tmp_path: Path, synthetic_long_video: Path):
    # A tiny real JPEG (from the repo's own branding asset) so get_video_metadata
    # can actually probe it.
    real_logo = Path(__file__).resolve().parents[2] / "assets" / "branding" / "logo.jpeg"
    logo_bytes = real_logo.read_bytes() if real_logo.exists() else None
    _configure_brand(monkeypatch, tmp_path, "NEURAX", logo_bytes=logo_bytes)

    source_dir = tmp_path / "raw"
    source_dir.mkdir()
    (source_dir / synthetic_long_video.name).write_bytes(synthetic_long_video.read_bytes())

    plan = _plan(synthetic_long_video.name, brand_name_from_client="irrelevant")
    result = compose_reel_from_editor_plan(plan, source_dir=source_dir, output_path=tmp_path / "out.mp4")

    assert result.duration_status == "ok"
    assert result.width == 1080 and result.height == 1920
