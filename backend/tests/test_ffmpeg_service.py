import subprocess

import pytest

from app.services import ffmpeg_service


def test_ffmpeg_timeout_terminates_windows_process_tree_and_reaps_process(monkeypatch):
    class TimedOutProcess:
        pid = 1234
        returncode = -9

        def __init__(self, *_args, **_kwargs):
            self.communicate_calls = 0
            self.killed = False

        def communicate(self, timeout=None):
            self.communicate_calls += 1
            if self.communicate_calls == 1:
                raise subprocess.TimeoutExpired("ffmpeg", timeout)
            return "", "terminated"

        def kill(self):
            self.killed = True

    process = TimedOutProcess()
    commands = []
    monkeypatch.setattr(ffmpeg_service.subprocess, "Popen", lambda *a, **kw: process)
    monkeypatch.setattr(ffmpeg_service.os, "name", "nt")
    monkeypatch.setattr(
        ffmpeg_service.subprocess,
        "run",
        lambda command, **_kwargs: commands.append(command),
    )

    with pytest.raises(subprocess.TimeoutExpired):
        ffmpeg_service._run_process(["ffmpeg", "-i", "input.mp4"], timeout=1)

    assert commands == [["taskkill", "/PID", "1234", "/T", "/F"]]
    assert process.communicate_calls == 2


def test_render_deadline_caps_subprocess_timeout(monkeypatch):
    ffmpeg_service.set_render_deadline(0)
    try:
        assert ffmpeg_service._bounded_timeout(1800) == 0
    finally:
        ffmpeg_service.set_render_deadline(None)
    assert ffmpeg_service._bounded_timeout(1800) == 1800
