from pathlib import Path

import pytest

from app.services.ffmpeg_service import check_ffmpeg_available
from app.services.video_metadata import get_video_metadata


def test_ffmpeg_available():
    assert check_ffmpeg_available() is True


def test_get_video_metadata_missing_file():
    with pytest.raises(FileNotFoundError):
        get_video_metadata(Path("does_not_exist.mp4"))


def test_get_video_metadata_real(synthetic_video_with_audio: Path):
    metadata = get_video_metadata(synthetic_video_with_audio)

    assert metadata.filename == synthetic_video_with_audio.name
    assert metadata.width == 1280
    assert metadata.height == 720
    assert metadata.duration == pytest.approx(1.0, abs=0.5)
    assert metadata.video_codec == "h264"
    assert metadata.audio_codec == "aac"
    assert "mp4" in metadata.format
    assert metadata.file_size > 0


def test_get_video_metadata_no_audio(synthetic_video_no_audio: Path):
    metadata = get_video_metadata(synthetic_video_no_audio)

    assert metadata.audio_codec is None
