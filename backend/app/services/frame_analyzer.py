from pathlib import Path
from statistics import mean, median

import cv2
import numpy as np
from pydantic import BaseModel

from app.schemas.analysis import QualityMetrics, VideoSegment

DEFAULT_SAMPLE_FPS = 4.0
DEFAULT_DARK_BRIGHTNESS_THRESHOLD = 40.0
HASH_SIZE = 8
WORKING_LONG_EDGE = 640
SIGNATURE_FRAME_COUNT = 3
SCENE_CHANGE_DIFF_THRESHOLD = 80.0
MOTION_REFERENCE_INTERVAL_SECONDS = 0.5


class SegmentAnalysis(BaseModel):
    metrics: QualityMetrics
    perceptual_hash: int
    perceptual_hashes: tuple[int, ...] = ()


def sample_timestamps(start_time: float, end_time: float, sample_fps: float) -> list[float]:
    if not np.isfinite(start_time) or not np.isfinite(end_time) or start_time < 0 or end_time < start_time:
        raise ValueError("sample bounds must be finite and end_time must be at or after start_time")
    if sample_fps <= 0 or not np.isfinite(sample_fps):
        raise ValueError("sample_fps must be finite and > 0")

    step = 1.0 / sample_fps
    count = max(1, int(np.ceil((end_time - start_time) / step)))
    timestamps = [start_time + index * step for index in range(count)]
    return [timestamp for timestamp in timestamps if timestamp < end_time] or [start_time]


def normalize_gray_frame(gray_frame: np.ndarray, long_edge: int = WORKING_LONG_EDGE) -> np.ndarray:
    """Resize a gray frame to a consistent metric resolution, preserving aspect ratio."""
    if gray_frame.ndim != 2 or gray_frame.size == 0:
        raise ValueError("Expected a non-empty grayscale frame")
    height, width = gray_frame.shape
    if height < 1 or width < 1 or long_edge < 1:
        raise ValueError("Frame dimensions and working resolution must be positive")
    scale = long_edge / max(height, width)
    target_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    interpolation = cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC
    return cv2.resize(gray_frame, target_size, interpolation=interpolation)


def compute_average_hash(gray_frame: np.ndarray, hash_size: int = HASH_SIZE) -> int:
    """Return a resolution-independent average hash for a representative frame."""
    if gray_frame.ndim != 2 or gray_frame.size == 0 or hash_size < 1:
        raise ValueError("Expected a non-empty grayscale frame and positive hash size")
    resized = cv2.resize(gray_frame, (hash_size, hash_size), interpolation=cv2.INTER_AREA)
    avg = resized.mean()
    bits = resized > avg
    hash_int = 0
    for bit in bits.flatten():
        hash_int = (hash_int << 1) | int(bit)
    return hash_int


def representative_indices(sample_count: int, count: int = SIGNATURE_FRAME_COUNT) -> tuple[int, ...]:
    if sample_count < 1 or count < 1:
        return ()
    if count == 1:
        return (sample_count // 2,)
    return tuple(round(index * (sample_count - 1) / (count - 1)) for index in range(count))


def _read_sampled_frames(
    cap: cv2.VideoCapture,
    segment: VideoSegment,
    timestamps: list[float],
) -> list[tuple[float, np.ndarray]]:
    """Seek once by media time, then decode forward and select timestamp samples.

    Sequential reads use each frame's reported media timestamp when available,
    which avoids deriving VFR timestamps from a nominal FPS. Frame-index timing
    is only a fallback for backends that report unusable timestamps.
    """
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not np.isfinite(fps) or fps <= 0:
        fps = 30.0

    seek_succeeded = cap.set(cv2.CAP_PROP_POS_MSEC, segment.start_time * 1000.0)
    fallback_time = segment.start_time if seek_succeeded else 0.0
    previous_timestamp: float | None = None
    previous_reported_ms: float | None = None
    sampled: list[tuple[float, np.ndarray]] = []
    target_index = 0
    frame_index = 0

    while target_index < len(timestamps):
        reported_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
        ok, frame = cap.read()
        if not ok:
            break

        reported_seconds = reported_ms / 1000.0
        timestamp_is_usable = (
            np.isfinite(reported_ms)
            and reported_ms >= 0
            and (previous_reported_ms is None or reported_ms > previous_reported_ms)
        )
        if timestamp_is_usable:
            frame_time = reported_seconds
            previous_reported_ms = reported_ms
        elif previous_timestamp is None:
            frame_time = fallback_time
        else:
            frame_time = previous_timestamp + 1.0 / fps

        previous_timestamp = frame_time
        frame_index += 1

        if frame_time < segment.start_time:
            continue
        if frame_time >= segment.end_time:
            break
        if frame_time + 1e-6 < timestamps[target_index]:
            continue

        if frame is not None and frame.ndim == 3 and frame.size > 0:
            sampled.append((frame_time, frame))
            while target_index < len(timestamps) and timestamps[target_index] <= frame_time + 1e-6:
                target_index += 1

    return sampled


def analyze_segment(
    video_path: str | Path,
    segment: VideoSegment,
    sample_fps: float = DEFAULT_SAMPLE_FPS,
    dark_threshold: float = DEFAULT_DARK_BRIGHTNESS_THRESHOLD,
) -> SegmentAnalysis:
    """Analyze timestamp-selected frames without modifying source media.

    Sharpness, motion and perceptual signatures use a fixed long-edge working
    resolution. Brightness and darkness use the original decoded grayscale
    pixels. The source file and timestamps remain untouched for rendering.
    """
    video_path = Path(video_path)
    if segment.end_time <= segment.start_time:
        raise ValueError("segment must have positive duration")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video for analysis: {video_path}")

    try:
        timestamps = sample_timestamps(segment.start_time, segment.end_time, sample_fps)
        sampled_frames = _read_sampled_frames(cap, segment, timestamps)
        if not sampled_frames:
            raise RuntimeError(f"No frames could be sampled for segment {segment}")

        sharpness_values: list[float] = []
        brightness_values: list[float] = []
        frame_differences: list[float] = []
        dark_count = 0
        working_grays: list[np.ndarray] = []
        working_times: list[float] = []

        for frame_time, frame in sampled_frames:
            try:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                working_gray = normalize_gray_frame(gray)
            except (cv2.error, ValueError):
                continue

            sharpness_values.append(float(cv2.Laplacian(working_gray, cv2.CV_64F).var()))
            brightness = float(gray.mean())
            brightness_values.append(brightness)
            dark_count += int(brightness < dark_threshold)
            working_grays.append(working_gray)
            working_times.append(frame_time)

        if not working_grays:
            raise RuntimeError(f"No valid frames could be analyzed for segment {segment}")

        for index in range(1, len(working_grays)):
            elapsed = working_times[index] - working_times[index - 1]
            if elapsed <= 0:
                continue
            difference = float(cv2.absdiff(working_grays[index], working_grays[index - 1]).mean())
            # Normalize to the legacy 0.5-second scale. Very large jumps are
            # likely cuts or decoding discontinuities, not ordinary motion.
            normalized_difference = difference * MOTION_REFERENCE_INTERVAL_SECONDS / elapsed
            if normalized_difference <= SCENE_CHANGE_DIFF_THRESHOLD:
                frame_differences.append(normalized_difference)

        signature_indices = representative_indices(len(working_grays))
        perceptual_hashes = tuple(compute_average_hash(working_grays[index]) for index in signature_indices)
        mid_hash = perceptual_hashes[len(perceptual_hashes) // 2]
        metrics = QualityMetrics(
            avg_sharpness=mean(sharpness_values) if sharpness_values else 0.0,
            avg_brightness=mean(brightness_values) if brightness_values else 0.0,
            dark_frame_ratio=dark_count / len(brightness_values) if brightness_values else 0.0,
            # The public field remains named avg_motion for compatibility. It
            # now represents robust frame-to-frame visual change, not shake.
            avg_motion=median(frame_differences) if frame_differences else 0.0,
            sampled_frame_count=len(brightness_values),
        )
        return SegmentAnalysis(
            metrics=metrics,
            perceptual_hash=mid_hash,
            perceptual_hashes=perceptual_hashes,
        )
    finally:
        cap.release()
