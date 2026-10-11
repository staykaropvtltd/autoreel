
"""Music-library discovery and safe track resolution."""

import json
import uuid
from pathlib import Path

from app.services.ffmpeg_service import probe

SUPPORTED_MUSIC_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac"}

_TRACK_NAMESPACE = uuid.UUID("1c0f0f30-7e30-4c87-9b57-30c6cfd8a2c1")

def get_track_duration(path: Path) -> float:
    """Return the duration of an audio or video file in seconds."""
    data = probe(path)

    duration = float(
        data.get("format", {}).get("duration") or 0.0
    )

    if duration <= 0:
        audio_durations = [
            float(stream.get("duration") or 0.0)
            for stream in data.get("streams", [])
            if stream.get("codec_type") == "audio"
        ]
        duration = max(audio_durations, default=0.0)

    return duration


def track_id_for(filename: str, is_custom: bool = False) -> str:
    """Return a unique, stable ID for a track."""
    stem = Path(filename).stem

    if is_custom:
        try:
            return str(uuid.UUID(stem))
        except ValueError:
            pass
        return str(
            uuid.uuid5(
                _TRACK_NAMESPACE,
                f"custom:{filename}",
            )
        )

    return stem.lower().replace(" ", "_").replace("-", "_")


def discover_music_library(music_dir: Path | str) -> list[dict]:
    """Discover tracks from a single directory (for single-directory discovery & test compatibility)."""
    return [
        {k: v for k, v in t.items() if k not in ("_path", "is_custom")}
        for t in discover_music_libraries([(Path(music_dir), False)])
    ]


def display_name_for(filename: str) -> str:
    return Path(filename).stem.replace("_", " ").replace("-", " ").strip().title()


def _read_display_name(path: Path) -> str:
    """Read the original upload name from an optional JSON sidecar."""
    metadata_path = path.with_suffix(".json")

    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        original_name = metadata.get("original_filename")
        if isinstance(original_name, str) and original_name.strip():
            return display_name_for(original_name)
    except (OSError, ValueError, TypeError):
        pass

    return display_name_for(path.name)


def validate_audio_file(path: Path) -> dict:
    """Reject files that cannot be probed or contain no real audio stream."""
    metadata = probe(path)
    streams = metadata.get("streams", [])

    audio_streams = [
        stream
        for stream in streams
        if stream.get("codec_type") == "audio"
    ]

    if not audio_streams:
        raise ValueError("The uploaded file does not contain an audio stream.")

    duration = float(metadata.get("format", {}).get("duration") or 0.0)

    if duration <= 0:
        durations = [
            float(stream.get("duration") or 0.0)
            for stream in audio_streams
        ]
        duration = max(durations, default=0.0)

    if duration <= 0:
        raise ValueError("The audio duration could not be determined.")

    return {
        "duration": round(duration, 2),
        "format": metadata.get("format", {}).get("format_name", ""),
    }


_AUDIO_METADATA_CACHE: dict[tuple[str, int, float], dict] = {}


def get_cached_audio_info(path: Path) -> dict:
    """Return validated audio info, caching results keyed by (path, size, mtime)."""
    try:
        stat = path.stat()
    except OSError as exc:
        raise ValueError(f"Cannot stat file: {path}") from exc

    cache_key = (str(path.resolve()), stat.st_size, stat.st_mtime)
    if cache_key in _AUDIO_METADATA_CACHE:
        return _AUDIO_METADATA_CACHE[cache_key]

    info = validate_audio_file(path)
    _AUDIO_METADATA_CACHE[cache_key] = info
    return info


def discover_music_libraries(
    libraries: list[tuple[Path, bool]],
) -> list[dict]:
    """Discover tracks from (directory, is_custom) pairs."""
    tracks = []

    for music_dir, is_custom in libraries:
        if not music_dir.exists():
            continue

        for path in sorted(music_dir.iterdir()):
            if not path.is_file():
                continue

            if path.suffix.lower() not in SUPPORTED_MUSIC_EXTENSIONS:
                continue

            try:
                audio_info = get_cached_audio_info(path)
            except Exception:
                # Do not let one broken file break the entire library.
                continue

            resolved_path = path.resolve()
            tracks.append(
                {
                    "id": track_id_for(path.name, is_custom),
                    "filename": path.name,
                    "display_name": (
                        _read_display_name(path)
                        if is_custom
                        else display_name_for(path.name)
                    ),
                    "duration": audio_info["duration"],
                    "format": path.suffix.lstrip(".").lower(),
                    "is_custom": is_custom,
                    "_path": resolved_path,
                }
            )

    return tracks


def find_track_by_id(
    libraries: list[tuple[Path, bool]],
    track_id: str,
) -> dict | None:
    # Direct lookup for custom tracks if track_id is a UUID filename
    for music_dir, is_custom in libraries:
        if is_custom and music_dir.exists():
            for ext in SUPPORTED_MUSIC_EXTENSIONS:
                candidate = music_dir / f"{track_id}{ext}"
                if candidate.is_file():
                    try:
                        audio_info = get_cached_audio_info(candidate)
                        return {
                            "id": track_id,
                            "filename": candidate.name,
                            "display_name": _read_display_name(candidate),
                            "duration": audio_info["duration"],
                            "format": ext.lstrip(".").lower(),
                            "is_custom": True,
                            "_path": candidate.resolve(),
                        }
                    except Exception:
                        pass

    for track in discover_music_libraries(libraries):
        if track["id"] == track_id:
            return track
    return None


def resolve_music_track(
    identifier: str,
    libraries: list[tuple[Path, bool]],
) -> dict | None:
    """Resolve a track ID or filename, never an arbitrary client path."""
    if not isinstance(identifier, str) or not identifier.strip():
        return None

    # Accept old editor plans that send a full path, but only use its basename.
    basename = identifier.replace("\\", "/").rsplit("/", 1)[-1]

    if basename in {"", ".", ".."}:
        return None

    tracks = discover_music_libraries(libraries)

    # Prefer the unique public track ID.
    for track in tracks:
        if track["id"] == identifier:
            return track

    # Backward compatibility for requests that send a filename/path.
    matches = [track for track in tracks if track["filename"] == basename]

    # Ambiguous filenames must never silently select the wrong track.
    if len(matches) == 1:
        return matches[0]

    return None


def fit_music_segment(
    source_duration: float,
    target_duration: float,
    start_time: float = 0.0,
    end_time: float | None = None,
) -> tuple[float, float, bool]:
    start_time = max(0.0, min(start_time, source_duration))

    if end_time is not None:
        end_time = max(start_time, min(end_time, source_duration))
        return start_time, end_time, False

    available = source_duration - start_time

    if available >= target_duration:
        return start_time, round(start_time + target_duration, 3), False

    return start_time, source_duration, True
