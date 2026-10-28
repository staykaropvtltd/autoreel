r"""Migrate owned local templates to private Supabase Storage.

Usage: python -m scripts.migrate_local_templates --owner-map path\to\owners.json
The JSON must map each template UUID to a real integer users.id. Unmapped
files are reported and left untouched; no owner is inferred from a UUID.
"""

import argparse
import json
import mimetypes
import sys
import uuid
from pathlib import Path

from PIL import Image, UnidentifiedImageError
from sqlalchemy import select

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import SessionLocal  # noqa: E402
from app.models.database_models import Template, User  # noqa: E402
from app.services import template_service  # noqa: E402


def migrate(owner_map: dict[str, int], root: Path | None = None) -> dict[str, object]:
    root = (root or PROJECT_ROOT / "storage" / "templates").resolve()
    result: dict[str, object] = {"migrated": 0, "already_present": 0, "skipped_unowned": [], "failed": []}
    if not root.is_dir():
        raise FileNotFoundError(f"Local template directory does not exist: {root}")

    with SessionLocal() as db:
        for template_dir in sorted(root.iterdir()):
            if not template_dir.is_dir():
                continue
            try:
                template_id = str(uuid.UUID(template_dir.name))
            except ValueError:
                result["failed"].append({"path": str(template_dir), "reason": "folder is not a UUID"})
                continue
            user_id = owner_map.get(template_id)
            if user_id is None:
                result["skipped_unowned"].append(template_id)
                continue
            user = db.scalar(select(User).where(User.id == user_id))
            if user is None:
                result["failed"].append({"template_id": template_id, "reason": f"users.id {user_id} does not exist"})
                continue
            existing = db.get(Template, template_id)
            if existing is not None and existing.user_id != user_id:
                result["failed"].append({"template_id": template_id, "reason": "already registered to another user"})
                continue
            files = [item for item in template_dir.iterdir() if item.is_file() and item.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]
            if len(files) != 1:
                result["failed"].append({"template_id": template_id, "reason": f"expected one image, found {len(files)}"})
                continue
            image_path = files[0]
            if not image_path.resolve().is_relative_to(template_dir.resolve()):
                result["failed"].append({"template_id": template_id, "reason": "image path escapes its UUID folder"})
                continue
            content_type = mimetypes.guess_type(image_path.name)[0]
            try:
                with Image.open(image_path) as image:
                    actual_format = image.format
                    width, height = image.size
                    if width <= 0 or height <= 0 or width * height > 40_000_000:
                        raise ValueError("unsupported image dimensions")
                    image.verify()
                expected_type = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}.get(actual_format)
                if expected_type is None or content_type != expected_type:
                    raise ValueError("image extension and contents do not match")
                payload = image_path.read_bytes()
                if len(payload) > 20 * 1024 * 1024:
                    raise ValueError("image exceeds 20 MB template limit")
                expected_path = f"{user_id}/{template_id}/{image_path.name}"
                if existing is not None and existing.storage_path != expected_path:
                    raise ValueError("existing template has a different storage path")
                storage_path = existing.storage_path if existing is not None else expected_path
                try:
                    template_service.get_object(storage_path)
                except template_service.TemplateObjectNotFound:
                    template_service.upload_object(storage_path, payload, expected_type)
                if existing is not None:
                    result["already_present"] += 1
                    continue
                row = Template(
                    id=template_id,
                    user_id=user_id,
                    original_filename=image_path.name,
                    storage_path=storage_path,
                    content_type=expected_type,
                    file_size_bytes=len(payload),
                    metadata_json={"migrated_from_local": True},
                )
                db.add(row)
                db.commit()
                result["migrated"] += 1
            except (OSError, ValueError, UnidentifiedImageError, template_service.TemplateStorageError) as exc:
                db.rollback()
                result["failed"].append({"template_id": template_id, "reason": str(exc)})
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--owner-map", required=True, type=Path, help="JSON map of template UUID to existing integer users.id")
    parser.add_argument("--source", type=Path, default=PROJECT_ROOT / "storage" / "templates")
    args = parser.parse_args()
    try:
        owner_map = json.loads(args.owner_map.read_text(encoding="utf-8"))
        if not isinstance(owner_map, dict) or any(not isinstance(value, int) for value in owner_map.values()):
            raise ValueError("owner map must be a JSON object of UUID keys to integer user IDs")
        result = migrate(owner_map, args.source)
    except Exception as exc:
        print(f"Migration could not run: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 1 if result["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
