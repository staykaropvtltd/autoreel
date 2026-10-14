from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

from app.api import templates
from app.main import app

client = TestClient(app)


def _png_bytes() -> bytes:
    image_bytes = BytesIO()
    Image.new("RGB", (32, 48), color=(240, 120, 30)).save(image_bytes, format="PNG")
    return image_bytes.getvalue()


def test_upload_template_accepts_valid_image_and_registers_path(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(templates, "TEMPLATE_IMAGES_DIR", tmp_path / "templates")

    response = client.post(
        "/api/templates/upload",
        files={"file": ("opening.png", _png_bytes(), "image/png")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "uploaded"
    assert body["size"] == len(_png_bytes())
    assert "path" not in body
    template = templates.TEMPLATE_IMAGES_DIR / body["template_id"] / "opening.png"
    assert template.is_file()
    from app.core.job_store import get_template_image

    assert get_template_image(body["template_id"])["path"] == str(template)


def test_upload_template_rejects_fake_image_and_removes_partial_folder(monkeypatch, tmp_path: Path):
    template_root = tmp_path / "templates"
    monkeypatch.setattr(templates, "TEMPLATE_IMAGES_DIR", template_root)

    response = client.post(
        "/api/templates/upload",
        files={"file": ("not-really.png", b"not an image", "image/png")},
    )

    assert response.status_code == 400
    assert "valid" in response.json()["detail"].lower()
    assert list(template_root.iterdir()) == []


def test_upload_template_rejects_mismatched_image_extension(monkeypatch, tmp_path: Path):
    template_root = tmp_path / "templates"
    monkeypatch.setattr(templates, "TEMPLATE_IMAGES_DIR", template_root)

    response = client.post(
        "/api/templates/upload",
        files={"file": ("image.jpg", _png_bytes(), "image/jpeg")},
    )

    assert response.status_code == 400
    assert list(template_root.iterdir()) == []


def test_unused_template_can_be_deleted_and_cleans_its_folder(monkeypatch, tmp_path: Path):
    template_root = tmp_path / "templates"
    monkeypatch.setattr(templates, "TEMPLATE_IMAGES_DIR", template_root)
    uploaded = client.post(
        "/api/templates/upload",
        files={"file": ("opening.png", _png_bytes(), "image/png")},
    )
    template_id = uploaded.json()["template_id"]
    template_dir = template_root / template_id

    deleted = client.delete(f"/api/templates/{template_id}")

    assert deleted.status_code == 200
    assert deleted.json() == {"deleted": True}
    assert not template_dir.exists()


def test_template_delete_is_rejected_after_association_with_analysis(monkeypatch, tmp_path: Path):
    from app.core.job_store import create_analysis_job

    template_root = tmp_path / "templates"
    monkeypatch.setattr(templates, "TEMPLATE_IMAGES_DIR", template_root)
    uploaded = client.post(
        "/api/templates/upload",
        files={"file": ("opening.png", _png_bytes(), "image/png")},
    )
    template_id = uploaded.json()["template_id"]
    create_analysis_job("test-template-reference", source_dir=tmp_path, template_id=template_id)

    response = client.delete(f"/api/templates/{template_id}")

    assert response.status_code == 409
    assert (template_root / template_id / "opening.png").is_file()
