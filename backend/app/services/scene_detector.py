from pathlib import Path

from scenedetect import SceneManager, open_video
from scenedetect.detectors import ContentDetector

from app.schemas.analysis import VideoSegment

DEFAULT_SCENE_THRESHOLD = 27.0
DEFAULT_MIN_SEGMENT_DURATION = 1.0


def detect_scenes(
    video_path: str | Path,
    threshold: float = DEFAULT_SCENE_THRESHOLD,
    min_segment_duration: float = DEFAULT_MIN_SEGMENT_DURATION,
) -> list[VideoSegment]:
    """Detects shot/scene boundaries using PySceneDetect's ContentDetector.

    If no scene cuts are found, the entire video is treated as a single
    continuous segment (PySceneDetect returns an empty scene list in that
    case rather than one spanning the whole video).

    Segments shorter than `min_segment_duration` are dropped.
    """
    video_path = Path(video_path)
    source_file = video_path.name

    video = open_video(str(video_path))
    scene_manager = SceneManager()
    scene_manager.add_detector(ContentDetector(threshold=threshold))
    scene_manager.detect_scenes(video)
    scene_list = scene_manager.get_scene_list()

    if not scene_list:
        total_duration = video.duration.seconds
        scene_list = [(0.0, total_duration)]
    else:
        scene_list = [(start.seconds, end.seconds) for start, end in scene_list]

    segments = []
    for start_time, end_time in scene_list:
        duration = end_time - start_time
        if duration < min_segment_duration:
            continue
        segments.append(
            VideoSegment(
                source_file=source_file,
                start_time=start_time,
                end_time=end_time,
                duration=duration,
            )
        )

    return segments
