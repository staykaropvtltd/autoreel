from enum import Enum
import uuid

from pydantic import BaseModel, PrivateAttr

from app.schemas.analysis import QualityMetrics


class SelectionStatus(str, Enum):
    SELECTED = "selected"
    REJECTED_LOW_QUALITY = "rejected_low_quality"
    REJECTED_DUPLICATE = "rejected_duplicate"
    REJECTED_NOT_SELECTED = "rejected_not_selected"


class BatchClip(BaseModel):
    clip_id: uuid.UUID | None = None
    source_file: str
    start_time: float
    end_time: float
    duration: float
    score: int
    metrics: QualityMetrics
    reasons: list[str]
    perceptual_hash: str
    status: SelectionStatus
    selected: bool
    locked: bool = False
    duplicate_of: str | None = None
    closest_neighbor_distance: int | None = None
    _perceptual_hashes: tuple[int, ...] = PrivateAttr(default=())


class BatchAnalysisResult(BaseModel):
    batch_id: str
    input_video_count: int
    total_segments: int
    accepted_before_dedupe: int
    duplicates_removed: int
    final_selected_count: int
    processing_time_seconds: float
    selected_clips: list[BatchClip]
    all_clips: list[BatchClip]
