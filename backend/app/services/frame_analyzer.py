from pathlib import Path
from statistics import mean

import cv2
import numpy as np
from pydantic import BaseModel

from app.schemas.analysis import QualityMetrics, VideoSegment

DEFAULT_SAMPLE_FPS = 2.0
DEFAULT_DARK_BRIGHTNESS_THRESHOLD = 40.0
HASH_SIZE = 8


class SegmentAnalysis(BaseModel):
    metrics: QualityMetrics
    perceptual_hash: int


def sample_timestamps(start_time: float, end_time: float, sample_fps: float) -> list[float]:
    if sample_fps <= 0:
        raise ValueError("sample_fps must be > 0")

    step = 1.0 / sample_fps
    timestamps = []
    t = start_time
    while t < end_time:
        timestamps.append(t)
        t += step

    if not timestamps:
        timestamps.append(start_time)

    return timestamps


def compute_average_hash(gray_frame: np.ndarray, hash_size: int = HASH_SIZE) -> int:
    """Lightweight perceptual signature (average hash) for duplicate detection.
    Avoids any neural-network dependency.
    """
    resized = cv2.resize(gray_frame, (hash_size, hash_size), interpolation=cv2.INTER_AREA)
    avg = resized.mean()
    bits = resized > avg
    hash_int = 0
    for bit in bits.flatten():
        hash_int = (hash_int << 1) | int(bit)
    return hash_int


def analyze_segment(
    video_path: str | Path,
    segment: VideoSegment,
    sample_fps: float = DEFAULT_SAMPLE_FPS,
    dark_threshold: float = DEFAULT_DARK_BRIGHTNESS_THRESHOLD,
) -> SegmentAnalysis:
    """Samples frames from a segment at `sample_fps` (not full decode) and
    computes sharpness, brightness, darkness, and motion metrics, plus a
    perceptual hash of the segment's midpoint frame for similarity checks.
    """
    video_path = Path(video_path)
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video for analysis: {video_path}")

    try:
        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        timestamps = sample_timestamps(segment.start_time, segment.end_time, sample_fps)
        mid_index = len(timestamps) // 2

        sharpness_values: list[float] = []
        brightness_values: list[float] = []
        motion_values: list[float] = []
        dark_count = 0
        sampled = 0
        prev_gray: np.ndarray | None = None
        mid_hash: int | None = None

        for idx, t in enumerate(timestamps):
            frame_index = int(round(t * video_fps))
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            ok, frame = cap.read()
            if not ok:
                continue

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            sharpness_values.append(float(cv2.Laplacian(gray, cv2.CV_64F).var()))

            brightness = float(gray.mean())
            brightness_values.append(brightness)
            if brightness < dark_threshold:
                dark_count += 1

            if prev_gray is not None:
                motion_values.append(float(cv2.absdiff(gray, prev_gray).mean()))

            if idx == mid_index:
                mid_hash = compute_average_hash(gray)

            prev_gray = gray
            sampled += 1

        if sampled == 0:
            raise RuntimeError(f"No frames could be sampled for segment {segment}")

        if mid_hash is None:
            mid_hash = compute_average_hash(prev_gray)

        metrics = QualityMetrics(
            avg_sharpness=mean(sharpness_values) if sharpness_values else 0.0,
            avg_brightness=mean(brightness_values) if brightness_values else 0.0,
            dark_frame_ratio=dark_count / sampled,
            avg_motion=mean(motion_values) if motion_values else 0.0,
            sampled_frame_count=sampled,
        )
        return SegmentAnalysis(metrics=metrics, perceptual_hash=mid_hash)
    finally:
        cap.release()
