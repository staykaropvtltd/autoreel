from pydantic import BaseModel

from app.schemas.story import TransitionConfig


class PlannedClip(BaseModel):
    source_file: str
    start_time: float
    end_time: float
    duration: float
    score: int
    # Phase 8: optional so Phase 5/6/7 callers (which never set this) are
    # unaffected - defaults to no transition (a plain cut).
    transition_in: TransitionConfig = TransitionConfig()


class ReelResult(BaseModel):
    output_path: str
    duration: float
    width: int
    height: int
    video_codec: str
    audio_codec: str | None
    clip_count: int
    planned_clips: list[PlannedClip]
    processing_time_seconds: float
    # Phase 9: measured (ffprobe) duration vs. what the user asked for.
    # "ok" within tolerance; "insufficient_content" when genuinely short.
    target_duration: float | None = None
    duration_status: str = "ok"


class ReelGenerateResponse(ReelResult):
    reel_id: str
    status: str
    download_url: str
