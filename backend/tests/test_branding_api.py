import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.services import brand_service

client = TestClient(app)


def _configure_brand(monkeypatch, tmp_path: Path, data: dict, logo_bytes: bytes | None = None) -> None:
    branding_dir = tmp_path / "branding"
    branding_dir.mkdir(exist_ok=True)
    (branding_dir / "brand.json").write_text(json.dumps(data), encoding="utf-8")
    if logo_bytes is not None and data.get("logo"):
        (branding_dir / data["logo"]).write_bytes(logo_bytes)
    # get_brand_config/get_brand_logo_path read these module-level globals
    # directly (via their defining module's namespace), so patching them
    # here affects every caller regardless of how it imported the functions.
    monkeypatch.setattr(brand_service, "BRANDING_DIR", branding_dir)
    monkeypatch.setattr(brand_service, "BRAND_CONFIG_PATH", branding_dir / "brand.json")


def test_get_branding_returns_configured_name_and_logo_url(monkeypatch, tmp_path: Path):
    _configure_brand(monkeypatch, tmp_path, {"name": "NEURAX", "tagline": "AI Studio", "logo": "neurax.jpeg"})

    response = client.get("/api/branding")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "NEURAX"
    assert body["tagline"] == "AI Studio"
    assert body["logo_url"] == "/api/branding/logo"


def test_get_branding_reflects_changed_brand_json(monkeypatch, tmp_path: Path):
    """The exact scenario the phase asks to verify: change ONLY brand.json,
    and the website's branding response changes with it - no code change.
    """
    _configure_brand(monkeypatch, tmp_path, {"name": "NEURAX", "logo": "neurax.jpeg"})
    assert client.get("/api/branding").json()["name"] == "NEURAX"

    _configure_brand(monkeypatch, tmp_path, {"name": "TEST BRAND", "logo": "test.jpeg"})
    assert client.get("/api/branding").json()["name"] == "TEST BRAND"


def test_get_branding_logo_serves_configured_file(monkeypatch, tmp_path: Path):
    _configure_brand(monkeypatch, tmp_path, {"name": "NEURAX", "logo": "neurax.jpeg"}, logo_bytes=b"fake-logo-bytes")

    response = client.get("/api/branding/logo")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.content == b"fake-logo-bytes"


def test_get_branding_logo_404_when_not_configured(monkeypatch, tmp_path: Path):
    _configure_brand(monkeypatch, tmp_path, {"name": "NEURAX"})  # no logo field at all

    response = client.get("/api/branding/logo")

    assert response.status_code == 404


def test_get_branding_logo_404_when_configured_file_missing(monkeypatch, tmp_path: Path):
    _configure_brand(monkeypatch, tmp_path, {"name": "NEURAX", "logo": "missing.jpeg"})  # never written to disk

    response = client.get("/api/branding/logo")

    assert response.status_code == 404


def test_get_branding_logo_ignores_path_traversal_in_config(monkeypatch, tmp_path: Path):
    branding_dir = tmp_path / "branding"
    branding_dir.mkdir()
    outside_secret = tmp_path / "secret.txt"
    outside_secret.write_bytes(b"should never be served")
    (branding_dir / "brand.json").write_text(
        json.dumps({"name": "NEURAX", "logo": "../secret.txt"}), encoding="utf-8"
    )
    monkeypatch.setattr(brand_service, "BRANDING_DIR", branding_dir)
    monkeypatch.setattr(brand_service, "BRAND_CONFIG_PATH", branding_dir / "brand.json")

    response = client.get("/api/branding/logo")

    assert response.status_code == 404
