from pydantic import BaseModel


class VideoMetadata(BaseModel):
    filename: str
    duration: float
    width: int
    height: int
    fps: float
    video_codec: str
    audio_codec: str | None
    format: str
    file_size: int


class ProcessingResult(BaseModel):
    input_path: str
    output_path: str
    processing_time_seconds: float
    input_metadata: VideoMetadata
    output_metadata: VideoMetadata
