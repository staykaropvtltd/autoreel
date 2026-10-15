
from sqlalchemy.orm import Session

from app.models.database_models import UploadedAsset


def list_user_assets(db: Session, user_id: int) -> list[UploadedAsset]:
    """Return only assets owned by the specified user."""
    return (
        db.query(UploadedAsset)
        .filter(UploadedAsset.user_id == user_id)
        .order_by(UploadedAsset.created_at.desc())
        .all()
    )


def create_user_asset(
    db: Session,
    *,
    user_id: int,
    asset_type: str,
    original_filename: str,
    storage_path: str,
    mime_type: str,
    file_size_bytes: int,
) -> UploadedAsset:
    """Save metadata for an asset belonging to one user."""
    asset = UploadedAsset(
        user_id=user_id,
        asset_type=asset_type,
        original_filename=original_filename,
        storage_path=storage_path,
        mime_type=mime_type,
        file_size_bytes=file_size_bytes,
    )

    db.add(asset)
    db.commit()
    db.refresh(asset)

    return asset
