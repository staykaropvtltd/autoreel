from pathlib import Path

import pytest

from app.services.music_service import (
    discover_music_library,
    display_name_for,
    fit_music_segment,
    get_track_duration,
    track_id_for,
)


def _make_audio(path: Path, duration: float) -> None:
    import subprocess

    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi", "-i", f"sine=frequency=440:duration={duration}",
            "-c:a", "libmp3lame", "-b:a", "64k", str(path),
        ],
        capture_output=True, check=True,
    )


# --- discovery ---


def test_discover_music_library_finds_supported_files(tmp_path: Path):
    _make_audio(tmp_path / "song_one.mp3", 3.0)
    (tmp_path / "notes.txt").write_text("not audio")

    tracks = discover_music_library(tmp_path)

    assert len(tracks) == 1
    assert tracks[0]["filename"] == "song_one.mp3"
    assert tracks[0]["format"] == "mp3"
    assert tracks[0]["duration"] == pytest.approx(3.0, abs=0.2)


def test_discover_music_library_returns_metadata_shape(tmp_path: Path):
    _make_audio(tmp_path / "traditional_elegance.mp3", 2.0)

    tracks = discover_music_library(tmp_path)

    track = tracks[0]
    assert set(track.keys()) == {"id", "filename", "display_name", "duration", "format"}
    assert track["id"] == "traditional_elegance"
    assert track["display_name"] == "Traditional Elegance"


def test_discover_music_library_does_not_hard_code_filenames(tmp_path: Path):
    _make_audio(tmp_path / "some_totally_unexpected_name_123.mp3", 2.0)

    tracks = discover_music_library(tmp_path)

    assert len(tracks) == 1
    assert tracks[0]["filename"] == "some_totally_unexpected_name_123.mp3"


def test_discover_music_library_empty_dir_returns_empty_list(tmp_path: Path):
    assert discover_music_library(tmp_path) == []


def test_discover_music_library_missing_dir_returns_empty_list(tmp_path: Path):
    assert discover_music_library(tmp_path / "does_not_exist") == []


def test_discover_music_library_skips_unsupported_extensions(tmp_path: Path):
    (tmp_path / "cover.jpg").write_bytes(b"not audio")
    _make_audio(tmp_path / "song.mp3", 2.0)

    tracks = discover_music_library(tmp_path)

    assert len(tracks) == 1


def test_track_id_and_display_name_are_deterministic():
    assert track_id_for("Traditional Elegance.mp3") == track_id_for("Traditional Elegance.mp3")
    assert track_id_for("song one.mp3").isidentifier() or "_" in track_id_for("song one.mp3")
    assert display_name_for("festive_silk") == "Festive Silk"


def test_get_track_duration_matches_real_file(tmp_path: Path):
    _make_audio(tmp_path / "clip.mp3", 5.0)
    duration = get_track_duration(tmp_path / "clip.mp3")
    assert duration == pytest.approx(5.0, abs=0.2)


# --- segment fitting ---


def test_fit_music_segment_song_longer_than_reel_uses_target_length():
    start, end, needs_loop = fit_music_segment(source_duration=90.0, target_duration=30.0)
    assert (end - start) == pytest.approx(30.0)
    assert needs_loop is False


def test_fit_music_segment_song_shorter_than_reel_flags_loop():
    start, end, needs_loop = fit_music_segment(source_duration=40.0, target_duration=60.0)
    assert end == 40.0
    assert needs_loop is True


def test_fit_music_segment_respects_custom_start_and_end():
    start, end, needs_loop = fit_music_segment(source_duration=120.0, target_duration=30.0, start_time=45.0, end_time=75.0)
    assert start == 45.0
    assert end == 75.0
    assert needs_loop is False


def test_fit_music_segment_clamps_start_within_source_bounds():
    start, end, needs_loop = fit_music_segment(source_duration=10.0, target_duration=5.0, start_time=100.0)
    assert start <= 10.0
