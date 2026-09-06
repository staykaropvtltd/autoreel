"""Phase 9: dynamic music-library discovery and song-segment fitting.

Scans assets/music/ for supported audio files - no filenames are ever
hard-coded. Metadata comes from ffprobe (reusing Phase 2's ffmpeg_service),
matching the project's existing "reuse ffmpeg, don't shell out ad hoc"
convention.
"""

import re
from pathlib import Path

from app.services.ffmpeg_service import probe

SUPPORTED_MUSIC_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac"}


def track_id_for(filename: str) -> str:
    """Deterministic, filesystem-independent id derived from the filename."""
    stem = Path(filename).stem
    slug = re.sub(r"[^a-zA-Z0-9_]+", "_", stem).strip("_").lower()
    return slug or "track"


def display_name_for(filename: str) -> str:
    stem = Path(filename).stem
    return stem.replace("_", " ").replace("-", " ").strip().title()


def get_track_duration(path: Path) -> float:
    data = probe(path)
    return float(data.get("format", {}).get("duration") or 0.0)


def discover_music_library(music_dir: Path) -> list[dict]:
    """Returns [{id, filename, display_name, duration, format}, ...] for
    every supported audio file found - dynamically, never from a hard-coded
    list. Files that fail to probe (corrupt/unsupported) are skipped rather
    than crashing the whole listing.
    """
    if not music_dir.exists():
        return []

    tracks = []
    for path in sorted(music_dir.iterdir()):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_MUSIC_EXTENSIONS:
            continue
        try:
            duration = get_track_duration(path)
        except Exception:
            continue
        tracks.append(
            {
                "id": track_id_for(path.name),
                "filename": path.name,
                "display_name": display_name_for(path.name),
                "duration": round(duration, 2),
                "format": path.suffix.lstrip(".").lower(),
            }
        )
    return tracks


def find_track_by_id(music_dir: Path, track_id: str) -> dict | None:
    for track in discover_music_library(music_dir):
        if track["id"] == track_id:
            return track
    return None


def fit_music_segment(
    source_duration: float, target_duration: float, start_time: float = 0.0, end_time: float | None = None
) -> tuple[float, float, bool]:
    """Resolves the (start, end, needs_loop) segment to use.

    If the caller gave an explicit end_time, that segment is used as-is
    (its own length may already equal target_duration, per the user's own
    choice). Otherwise, a target_duration-long segment starting at
    start_time is used if the source has enough material; if not, the
    remaining audio is used and needs_loop=True signals the renderer to
    loop it to fill the rest.
    """
    start_time = max(0.0, min(start_time, source_duration))

    if end_time is not None:
        end_time = max(start_time, min(end_time, source_duration))
        return start_time, end_time, False

    available = source_duration - start_time
    if available >= target_duration:
        return start_time, round(start_time + target_duration, 3), False
    return start_time, source_duration, True
