"""Phase 8: one cached representative-frame thumbnail per planned clip.

Thumbnails are keyed by (source filename, timestamp) so re-planning at a
different target duration - which often reuses the same clips - never
regenerates a thumbnail that's already on disk.
"""

import hashlib
from pathlib import Path

from app.services.ffmpeg_service import run_ffmpeg
from app.services.reel_composer import resolve_source_path

THUMBNAIL_WIDTH = 320


def thumbnail_cache_key(source_file: str, timestamp: float) -> str:
    raw = f"{source_file}@{timestamp:.2f}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:20]


def get_or_create_thumbnail(source_path: Path, timestamp: float, cache_dir: Path) -> Path:
    cache_dir.mkdir(parents=True, exist_ok=True)
    key = thumbnail_cache_key(source_path.name, timestamp)
    thumb_path = cache_dir / f"{key}.jpg"

    if thumb_path.exists():
        return thumb_path

    run_ffmpeg(
        [
            "-ss", str(timestamp),
            "-i", str(source_path),
            "-frames:v", "1",
            "-vf", f"scale={THUMBNAIL_WIDTH}:-1",
            "-q:v", "4",
            str(thumb_path),
        ]
    )
    return thumb_path


def attach_thumbnails(clips, source_dir: Path, cache_dir: Path, url_prefix: str = "/api/thumbnails") -> None:
    """Mutates each clip's thumbnail_url in place. Best-effort: a failure
    generating one clip's thumbnail (e.g. a slightly out-of-range seek on
    unusual footage) never breaks planning - it just leaves that clip's
    thumbnail_url unset.
    """
    for clip in clips:
        try:
            source_path = resolve_source_path(clip.source_file, source_dir)
            timestamp = clip.planned_start + min(0.3, clip.planned_duration / 2)
            thumb_path = get_or_create_thumbnail(source_path, timestamp, cache_dir)
            clip.thumbnail_url = f"{url_prefix}/{thumb_path.stem}"
        except Exception:
            clip.thumbnail_url = None
