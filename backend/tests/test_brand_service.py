import json
from pathlib import Path

from app.services import brand_service


def _write_brand_json(monkeypatch, tmp_path: Path, data: dict) -> None:
    branding_dir = tmp_path / "branding"
    branding_dir.mkdir(exist_ok=True)
    (branding_dir / "brand.json").write_text(json.dumps(data), encoding="utf-8")
    monkeypatch.setattr(brand_service, "BRANDING_DIR", branding_dir)
    monkeypatch.setattr(brand_service, "BRAND_CONFIG_PATH", branding_dir / "brand.json")


def test_get_brand_config_loads_from_brand_json(monkeypatch, tmp_path: Path):
    _write_brand_json(monkeypatch, tmp_path, {"name": "TEST BRAND", "logo": "test.jpeg"})

    config = brand_service.get_brand_config()

    assert config.name == "TEST BRAND"
    assert config.logo == "test.jpeg"


def test_get_brand_name_reflects_config(monkeypatch, tmp_path: Path):
    _write_brand_json(monkeypatch, tmp_path, {"name": "NEURAX", "logo": "neurax.jpeg"})

    assert brand_service.get_brand_name() == "NEURAX"


def test_get_brand_logo_path_resolves_within_branding_dir(monkeypatch, tmp_path: Path):
    branding_dir = tmp_path / "branding"
    branding_dir.mkdir()
    (branding_dir / "brand.json").write_text(
        json.dumps({"name": "NEURAX", "logo": "neurax.jpeg"}), encoding="utf-8"
    )
    (branding_dir / "neurax.jpeg").write_bytes(b"fake-jpeg-bytes")
    monkeypatch.setattr(brand_service, "BRANDING_DIR", branding_dir)
    monkeypatch.setattr(brand_service, "BRAND_CONFIG_PATH", branding_dir / "brand.json")

    logo_path = brand_service.get_brand_logo_path()

    assert logo_path == branding_dir / "neurax.jpeg"
    assert logo_path.is_relative_to(branding_dir)


def test_get_brand_logo_path_none_when_configured_file_missing(monkeypatch, tmp_path: Path):
    # brand.json points at a logo that was never actually placed on disk -
    # must degrade gracefully (None), not raise.
    _write_brand_json(monkeypatch, tmp_path, {"name": "NEURAX", "logo": "does_not_exist.jpeg"})

    assert brand_service.get_brand_logo_path() is None


def test_get_brand_logo_path_rejects_path_traversal(monkeypatch, tmp_path: Path):
    # A "logo" value containing directory components must never escape
    # BRANDING_DIR - only the bare filename is ever honored.
    branding_dir = tmp_path / "branding"
    branding_dir.mkdir()
    secret = tmp_path / "secret.jpeg"
    secret.write_bytes(b"outside-branding-dir")
    (branding_dir / "brand.json").write_text(
        json.dumps({"name": "NEURAX", "logo": "../secret.jpeg"}), encoding="utf-8"
    )
    monkeypatch.setattr(brand_service, "BRANDING_DIR", branding_dir)
    monkeypatch.setattr(brand_service, "BRAND_CONFIG_PATH", branding_dir / "brand.json")

    # "../secret.jpeg" resolves to the bare filename "secret.jpeg" inside
    # BRANDING_DIR (which doesn't exist there) - never the real file outside it.
    assert brand_service.get_brand_logo_path() is None


def test_get_brand_config_falls_back_when_brand_json_missing(monkeypatch, tmp_path: Path):
    branding_dir = tmp_path / "branding"
    branding_dir.mkdir()  # no brand.json inside
    monkeypatch.setattr(brand_service, "BRANDING_DIR", branding_dir)
    monkeypatch.setattr(brand_service, "BRAND_CONFIG_PATH", branding_dir / "brand.json")

    config = brand_service.get_brand_config()

    assert config.name == "Auto-Reel Studio"  # safe generic fallback, not a crash
    assert config.logo is None


def test_get_brand_config_falls_back_when_brand_json_is_invalid(monkeypatch, tmp_path: Path):
    branding_dir = tmp_path / "branding"
    branding_dir.mkdir()
    (branding_dir / "brand.json").write_text("{not valid json", encoding="utf-8")
    monkeypatch.setattr(brand_service, "BRANDING_DIR", branding_dir)
    monkeypatch.setattr(brand_service, "BRAND_CONFIG_PATH", branding_dir / "brand.json")

    config = brand_service.get_brand_config()

    assert config.name == "Auto-Reel Studio"


def test_changing_brand_json_changes_result_without_restart(monkeypatch, tmp_path: Path):
    """Critical requirement: brand.json is re-read on every call, so editing
    it takes effect immediately - no process restart, no caching to bust.
    """
    _write_brand_json(monkeypatch, tmp_path, {"name": "NEURAX", "logo": "neurax.jpeg"})
    assert brand_service.get_brand_name() == "NEURAX"

    _write_brand_json(monkeypatch, tmp_path, {"name": "TEST BRAND", "logo": "test.jpeg"})
    assert brand_service.get_brand_name() == "TEST BRAND"
