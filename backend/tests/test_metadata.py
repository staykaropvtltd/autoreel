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


def test_get_video_metadata_rotates_90_degrees(monkeypatch, tmp_path: Path):
    dummy = tmp_path / "rotated.mp4"
    dummy.write_bytes(b"\x00" * 100)

    # Simulated probe output for a 1920x1080 stream rotated by 90 degrees
    fake_probe_data = {
        "streams": [
            {
                "codec_type": "video",
                "width": 1920,
                "height": 1080,
                "r_frame_rate": "30/1",
                "codec_name": "h264",
                "tags": {"rotate": "90"},
            }
        ],
        "format": {"duration": "5.0", "format_name": "mov,mp4", "size": "1000"},
    }
    monkeypatch.setattr("app.services.video_metadata.probe", lambda p: fake_probe_data)

    metadata = get_video_metadata(dummy)
    assert metadata.width == 1080
    assert metadata.height == 1920


def test_get_video_metadata_rotates_with_side_data_matrix(monkeypatch, tmp_path: Path):
    dummy = tmp_path / "side_data_rotated.mp4"
    dummy.write_bytes(b"\x00" * 100)

    fake_probe_data = {
        "streams": [
            {
                "codec_type": "video",
                "width": 1920,
                "height": 1080,
                "r_frame_rate": "30/1",
                "codec_name": "h264",
                "side_data_list": [{"side_data_type": "Display Matrix", "rotation": -90}],
            }
        ],
        "format": {"duration": "5.0", "format_name": "mov,mp4", "size": "1000"},
    }
    monkeypatch.setattr("app.services.video_metadata.probe", lambda p: fake_probe_data)

    metadata = get_video_metadata(dummy)
    assert metadata.width == 1080
    assert metadata.height == 1920

