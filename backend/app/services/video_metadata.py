from pathlib import Path

from app.schemas.video import VideoMetadata
from app.services.ffmpeg_service import probe


class NoVideoStreamError(ValueError):
    pass


def _parse_fps(rate: str) -> float:
    if "/" not in rate:
        return float(rate)
    numerator, denominator = rate.split("/")
    denominator = float(denominator)
    return float(numerator) / denominator if denominator else 0.0


def get_video_metadata(input_path: str | Path) -> VideoMetadata:
    input_path = Path(input_path)
    data = probe(input_path)

    streams = data.get("streams", [])
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

    if video_stream is None:
        raise NoVideoStreamError(f"No video stream found in {input_path}")

    fmt = data.get("format", {})
    duration = float(fmt.get("duration") or video_stream.get("duration") or 0.0)

    return VideoMetadata(
        filename=input_path.name,
        duration=duration,
        width=int(video_stream["width"]),
        height=int(video_stream["height"]),
        fps=_parse_fps(video_stream.get("r_frame_rate", "0/1")),
        video_codec=video_stream.get("codec_name", "unknown"),
        audio_codec=audio_stream.get("codec_name") if audio_stream else None,
        format=fmt.get("format_name", "unknown"),
        file_size=int(fmt.get("size") or input_path.stat().st_size),
    )


def get_video_stream_duration(input_path: str | Path) -> float:
    """The video stream's OWN actual duration, from its decoded frame count -
    not the container's format-level duration (get_video_metadata().duration
    prefers the format value, which reflects the LONGEST stream in the file).

    These normally match. When they diverge it means the video stream ended
    early while another stream (typically audio) kept the container running
    longer - e.g. a corrupted xfade transition chain that truncates the
    video well short of the Reel's target duration. validate_output uses
    this to catch that failure mode instead of accepting a file whose
    format-level duration merely looks correct.
    """
    input_path = Path(input_path)
    data = probe(input_path)

    streams = data.get("streams", [])
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    if video_stream is None:
        raise NoVideoStreamError(f"No video stream found in {input_path}")

    fps = _parse_fps(video_stream.get("r_frame_rate", "0/1"))
    nb_frames = video_stream.get("nb_frames")
    if nb_frames is not None and fps > 0:
        try:
            return int(nb_frames) / fps
        except (TypeError, ValueError):
            pass

    stream_duration = video_stream.get("duration")
    if stream_duration is not None:
        try:
            return float(stream_duration)
        except (TypeError, ValueError):
            pass

    fmt = data.get("format", {})
    return float(fmt.get("duration") or 0.0)
