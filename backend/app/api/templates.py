import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image

from app.core.job_store import create_template_image, delete_template_image_if_unused, get_template_image
from app.core.security import safe_filename

router = APIRouter()

# Project root
_PROJECT_ROOT = Path(__file__).resolve().parents[3]

# Where template images will be stored
TEMPLATE_IMAGES_DIR = _PROJECT_ROOT / "storage" / "templates"

# Allowed image formats
ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

# Maximum template image size: 20 MB
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

_CHUNK_SIZE = 1024 * 1024


@router.post("/templates/upload")
async def upload_template_image(
    file: UploadFile = File(...)
) -> dict:

    if not file:
        raise HTTPException(
            status_code=400,
            detail="No template image provided",
        )

    # Sanitize filename
    filename = safe_filename(file.filename or "")

    if not filename:
        raise HTTPException(
            status_code=400,
            detail="Invalid template image filename",
        )

    # Check extension
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported template image format: {filename}. "
                "Allowed formats: JPG, JPEG, PNG, WEBP"
            ),
        )

    # Generate unique template ID
    template_id = str(uuid.uuid4())

    # Create template-specific folder
    template_dir = TEMPLATE_IMAGES_DIR / template_id
    template_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    # Final file location
    destination = template_dir / filename

    size = 0

    try:
        with open(destination, "wb") as out_file:

            while chunk := await file.read(_CHUNK_SIZE):

                size += len(chunk)

                # File size validation
                if size > MAX_FILE_SIZE_BYTES:
                    out_file.close()
                    destination.unlink(missing_ok=True)

                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Template image too large: {filename}. "
                            "Maximum size is 20 MB."
                        ),
                    )

                out_file.write(chunk)

    except HTTPException:
        destination.unlink(missing_ok=True)
        shutil.rmtree(template_dir, ignore_errors=True)
        raise

    except Exception as exc:
        destination.unlink(missing_ok=True)
        shutil.rmtree(template_dir, ignore_errors=True)

        raise HTTPException(
            status_code=500,
            detail="Failed to save template image",
        ) from exc

    # Reject empty files
    if size == 0:
        destination.unlink(missing_ok=True)
        shutil.rmtree(template_dir, ignore_errors=True)

        raise HTTPException(
            status_code=400,
            detail=f"Empty template image: {filename}",
        )

    expected_formats = {
        ".jpg": "JPEG",
        ".jpeg": "JPEG",
        ".png": "PNG",
        ".webp": "WEBP",
    }
    try:
        with Image.open(destination) as image:
            image_format = image.format
            width, height = image.size
            if width <= 0 or height <= 0 or width * height > 40_000_000:
                raise ValueError("Image dimensions are outside the supported range")
            image.verify()
        if image_format != expected_formats[extension]:
            raise ValueError("Image contents do not match the filename extension")
    except Exception as exc:
        destination.unlink(missing_ok=True)
        shutil.rmtree(template_dir, ignore_errors=True)
        raise HTTPException(
            status_code=400,
            detail="Invalid template image. Upload a valid JPG, PNG, or WEBP file.",
        ) from exc

    # Store template metadata in the job store
    create_template_image(
        template_id=template_id,
        filename=filename,
        path=str(destination),
    )

    return {
        "template_id": template_id,
        "status": "uploaded",
        "filename": filename,
        "size": size,
    }


@router.delete("/templates/{template_id}")
def delete_template(template_id: str) -> dict[str, bool]:
    try:
        safe_template_id = str(uuid.UUID(template_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid template ID") from exc

    record = get_template_image(safe_template_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Template not found")
    templates_root = TEMPLATE_IMAGES_DIR.resolve()
    template_path = Path(record.get("path", "")).resolve()
    template_dir = template_path.parent
    if (
        not template_path.is_relative_to(templates_root)
        or template_dir.parent != templates_root
        or template_dir.name != safe_template_id
    ):
        raise HTTPException(status_code=400, detail="Invalid template location")

    removed_record, deleted = delete_template_image_if_unused(safe_template_id)
    if removed_record is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if not deleted:
        raise HTTPException(status_code=409, detail="Template is attached to an active analysis or saved reel workflow")

    try:
        shutil.rmtree(template_dir, ignore_errors=False)
    except OSError as exc:
        create_template_image(
            safe_template_id,
            str(removed_record.get("filename", "template")),
            str(template_path),
        )
        raise HTTPException(status_code=500, detail="Could not remove the unused template image") from exc

    return {"deleted": True}
