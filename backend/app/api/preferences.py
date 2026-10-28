from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_user, get_db
from app.models.database_models import BrandSettings, MusicTrack, Template, User, UserPreferences

router = APIRouter(prefix="/preferences", tags=["User preferences"])


class PreferencesUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    theme: Literal["dark", "light"] | None = None
    default_target_duration: int | None = Field(default=None, ge=5, le=60)
    default_aspect_ratio: Literal["9:16", "1:1", "16:9", "4:5"] | None = None
    default_resolution: Literal["1080x1920", "1080x1080", "1920x1080", "1080x1350"] | None = None
    default_frame_rate: Literal[24, 25, 30, 50, 60] | None = None
    preferred_music_track_id: str | None = Field(default=None, max_length=100)
    preferred_template_id: str | None = Field(default=None, max_length=36)
    auto_save: bool | None = None
    notifications: bool | None = None
    compact_layout: bool | None = None

    @field_validator("preferred_template_id")
    @classmethod
    def validate_template_uuid(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return value
        try:
            return str(UUID(value))
        except ValueError as exc:
            raise ValueError("preferred_template_id must be a UUID") from exc

    @model_validator(mode="after")
    def reject_null_non_nullable_fields(self):
        for field in (
            "theme", "default_target_duration", "default_aspect_ratio",
            "default_resolution", "default_frame_rate", "auto_save",
            "notifications", "compact_layout",
        ):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class PreferencesResponse(BaseModel):
    user_id: str
    theme: str
    default_target_duration: int
    default_aspect_ratio: str
    default_resolution: str
    default_frame_rate: int
    preferred_music_track_id: str | None
    preferred_template_id: str | None
    auto_save: bool
    notifications: bool
    compact_layout: bool
    created_at: datetime
    updated_at: datetime


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=255)
    brand_name: str = Field(min_length=1, max_length=255)


def _response(user: User, prefs: UserPreferences) -> dict:
    return {
        "user_id": str(user.id),
        "theme": prefs.theme,
        "default_target_duration": prefs.default_target_duration,
        "default_aspect_ratio": prefs.default_aspect_ratio,
        "default_resolution": prefs.default_resolution,
        "default_frame_rate": prefs.default_frame_rate,
        "preferred_music_track_id": prefs.preferred_music_track_id,
        "preferred_template_id": prefs.preferred_template_id,
        "auto_save": prefs.auto_save,
        "notifications": prefs.notifications,
        "compact_layout": prefs.compact_layout,
        "created_at": prefs.created_at,
        "updated_at": prefs.updated_at,
    }


def _get_or_create(db: Session, user_id: int) -> UserPreferences:
    prefs = db.get(UserPreferences, user_id)
    if prefs is None:
        prefs = UserPreferences(user_id=user_id)
        db.add(prefs)
        try:
            db.commit()
            db.refresh(prefs)
        except IntegrityError:
            db.rollback()
            prefs = db.get(UserPreferences, user_id)
            if prefs is None:
                raise
    return prefs


@router.get("", response_model=PreferencesResponse)
def get_preferences(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return _response(current_user, _get_or_create(db, current_user.id))


@router.put("", response_model=PreferencesResponse)
def update_preferences(
    payload: PreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    changes = payload.model_dump(exclude_unset=True)
    for field in ("preferred_music_track_id", "preferred_template_id"):
        if field in changes and changes[field] == "":
            changes[field] = None
    if changes.get("preferred_music_track_id") is not None:
        try:
            track_id = int(changes["preferred_music_track_id"])
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=422, detail="Invalid preferred music track") from exc
        track = db.scalar(select(MusicTrack).where(
            MusicTrack.id == track_id,
            (MusicTrack.owner_user_id == current_user.id) | (MusicTrack.is_builtin.is_(True)),
        ))
        if track is None:
            raise HTTPException(status_code=422, detail="Preferred music track is unavailable")
        changes["preferred_music_track_id"] = str(track.id)
    if changes.get("preferred_template_id") is not None:
        template = db.scalar(select(Template).where(
            Template.id == changes["preferred_template_id"],
            Template.user_id == current_user.id,
        ))
        if template is None:
            raise HTTPException(status_code=422, detail="Preferred template is unavailable")

    prefs = _get_or_create(db, current_user.id)
    for field, value in changes.items():
        setattr(prefs, field, value)
    db.commit()
    db.refresh(prefs)
    return _response(current_user, prefs)


@router.put("/profile")
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.name = payload.name.strip()
    current_user.brand_name = payload.brand_name.strip()
    brand = db.scalar(select(BrandSettings).where(BrandSettings.user_id == current_user.id))
    if brand is None:
        brand = BrandSettings(user_id=current_user.id, name=payload.brand_name.strip())
        db.add(brand)
    else:
        brand.name = payload.brand_name.strip()
    db.commit()
    return {"name": current_user.name, "brand_name": current_user.brand_name}
