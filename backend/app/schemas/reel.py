
from pydantic import BaseModel

from app.schemas.story import TransitionConfig


class PlannedClip(BaseModel):
    source_file: str
    start_time: float
    end_time: float
    duration: float
    score: int
    # Optional transition; defaults to a plain cut.
    transition_in: TransitionConfig = TransitionConfig()


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
