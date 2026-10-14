import json
from collections import Counter
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.services import brand_service

client = TestClient(app)


def test_branding_routes_are_registered_once_at_expected_paths():
    registered = Counter(
        (method, route.path)
        for route in app.routes
        if route.path.startswith("/api/branding")
        for method in (route.methods or set())
    )

    assert registered == Counter(
        {
            ("GET", "/api/branding"): 1,
            ("GET", "/api/branding/logo"): 1,
            ("POST", "/api/branding/logo"): 1,
            ("POST", "/api/branding/logo/placement"): 1,
        }
    )


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
    user_branding_dir = tmp_path / "user_branding"
    monkeypatch.setattr(brand_service, "USER_BRANDING_DIR", user_branding_dir)
    monkeypatch.setattr(brand_service, "USER_BRAND_CONFIG_PATH", user_branding_dir / "brand.json")


def test_get_branding_returns_configured_name_and_logo_url(monkeypatch, tmp_path: Path):
    _configure_brand(monkeypatch, tmp_path, {"name": "NEURAX", "tagline": "AI Studio", "logo": "neurax.jpeg"})

    response = client.get("/api/branding")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "NEURAX"
    assert body["tagline"] == "AI Studio"
    assert body["logo_url"] == "/api/branding/logo"
    assert set(body) == {
        "name", "tagline", "logo_url", "logo_placement",
        "primary_color", "secondary_color", "text_color",
    }


def test_upload_brand_logo_returns_typed_compatible_fields(monkeypatch, tmp_path: Path):
    from io import BytesIO

    from PIL import Image

    user_branding_dir = tmp_path / "user_branding"
    user_branding_dir.mkdir()
    monkeypatch.setattr(
        "app.api.branding.save_user_logo",
        lambda **_kwargs: user_branding_dir / "logo.png",
    )
    image = Image.new("RGB", (1, 1), color="white")
    image_bytes = BytesIO()
    image.save(image_bytes, format="PNG")

    response = client.post(
        "/api/branding/logo",
        files={"file": ("brand.png", image_bytes.getvalue(), "image/png")},
        data={"placement": "entire"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "uploaded",
        "filename": "logo.png",
        "logo_url": "/api/branding/logo",
        "placement": "entire",
    }


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
    user_branding_dir = tmp_path / "user_branding"
    monkeypatch.setattr(brand_service, "USER_BRANDING_DIR", user_branding_dir)
    monkeypatch.setattr(brand_service, "USER_BRAND_CONFIG_PATH", user_branding_dir / "brand.json")

    response = client.get("/api/branding/logo")

    assert response.status_code == 404


def test_update_logo_placement_uses_validated_json_body(monkeypatch):
    placements = []
    monkeypatch.setattr("app.api.branding.set_logo_placement", placements.append)

    response = client.post("/api/branding/logo/placement", json={"placement": "entire"})
    assert response.status_code == 200
    assert response.json() == {"status": "updated", "placement": "entire"}
    assert placements == ["entire"]

    invalid = client.post("/api/branding/logo/placement", json={"placement": "../../secret"})
    assert invalid.status_code == 422
    assert placements == ["entire"]


def test_save_user_logo_real_storage_does_not_deadlock(monkeypatch, tmp_path: Path):
    from io import BytesIO

    from PIL import Image

    # Redirect all storage paths to a temporary directory.
    user_branding_dir = tmp_path / "user_branding"
    monkeypatch.setattr(brand_service, "USER_BRANDING_DIR", user_branding_dir)
    monkeypatch.setattr(
        brand_service,
        "USER_BRAND_CONFIG_PATH",
        user_branding_dir / "brand.json",
    )

    # Generate a valid PNG image.
    image_buffer = BytesIO()
    Image.new("RGB", (10, 10), color="white").save(image_buffer, format="PNG")
    image_bytes = image_buffer.getvalue()

    # Call the REAL storage function (no mock).
    logo_path = brand_service.save_user_logo(
        file_bytes=image_bytes,
        extension=".png",
        placement="entire",
    )

    # Verify the logo was saved.
    assert logo_path == user_branding_dir / "logo.png"
    assert logo_path.is_file()
    assert logo_path.read_bytes() == image_bytes

    # Verify the branding configuration was saved.
    config_path = user_branding_dir / "brand.json"
    assert config_path.is_file()

    config = json.loads(config_path.read_text(encoding="utf-8"))
    assert config["logo"] == "logo.png"
    assert config["logo_placement"] == "entire"
