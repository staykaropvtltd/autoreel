from pydantic import BaseModel, PrivateAttr


class VideoSegment(BaseModel):
    source_file: str
    start_time: float
    end_time: float
    duration: float


class QualityMetrics(BaseModel):
    avg_sharpness: float
    avg_brightness: float
    dark_frame_ratio: float
    avg_motion: float
    sampled_frame_count: int


class ClipScore(BaseModel):
    score: int
    visual_quality_score: float
    motion_score: float
    exposure_score: float
    usability_score: float
    uniqueness_score: float
    reasons: list[str]


class AnalyzedClip(BaseModel):
    segment: VideoSegment
    metrics: QualityMetrics
    score: ClipScore
    accepted: bool
    perceptual_hash: str
    _perceptual_hashes: tuple[int, ...] = PrivateAttr(default=())


class AnalysisResult(BaseModel):
    source: str
    processing_time_seconds: float
    total_segments_detected: int
    accepted_count: int
    rejected_count: int
    clips: list[AnalyzedClip]
