
from pydantic import BaseModel, Field

from app.schemas.story import TransitionConfig


class PlannedClip(BaseModel):
    source_file: str = Field(min_length=1, max_length=255)
    start_time: float
    end_time: float
    duration: float = Field(gt=0.0, le=300.0, allow_inf_nan=False)
    score: int = Field(ge=0, le=100)
    # Optional transition; defaults to a plain cut.
    transition_in: TransitionConfig = Field(default_factory=TransitionConfig)


class ReelResult(BaseModel):
    # Internal filesystem path; do not expose this in public API responses.
    output_path: str
    duration: float
    width: int
    height: int
    video_codec: str
    audio_codec: str | None
    clip_count: int
    planned_clips: list[PlannedClip]
    processing_time_seconds: float
    target_duration: float | None = None
    duration_status: str = "ok"


class ReelGenerateResponse(BaseModel):
    # Public response intentionally excludes output_path.
    reel_id: str
    status: str
    download_url: str
    duration: float
    width: int
    height: int
    video_codec: str
    audio_codec: str | None
    clip_count: int
    planned_clips: list[PlannedClip]
    processing_time_seconds: float
    target_duration: float | None = None
    duration_status: str = "ok"
