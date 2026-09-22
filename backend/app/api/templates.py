import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.job_store import create_template_image
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
        raise

    except Exception as exc:
        destination.unlink(missing_ok=True)

        raise HTTPException(
            status_code=500,
            detail="Failed to save template image",
        ) from exc

    # Reject empty files
    if size == 0:
        destination.unlink(missing_ok=True)

        raise HTTPException(
            status_code=400,
            detail=f"Empty template image: {filename}",
        )

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
        "path": str(destination),
    }