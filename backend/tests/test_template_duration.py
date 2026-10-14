from app.services.reel_duration import get_template_duration_seconds


def test_template_duration_defaults_to_one_second(monkeypatch):
    monkeypatch.delenv("AUTOREEL_TEMPLATE_DURATION_SECONDS", raising=False)
    assert get_template_duration_seconds() == 1.0


def test_template_duration_is_configurable_but_never_exceeds_one_second(monkeypatch):
    monkeypatch.setenv("AUTOREEL_TEMPLATE_DURATION_SECONDS", "0.35")
    assert get_template_duration_seconds() == 0.35
    monkeypatch.setenv("AUTOREEL_TEMPLATE_DURATION_SECONDS", "2.5")
    assert get_template_duration_seconds() == 1.0


def test_invalid_template_duration_uses_safe_one_second_default(monkeypatch):
    for value in ("invalid", "0", "-2", "nan", "inf"):
        monkeypatch.setenv("AUTOREEL_TEMPLATE_DURATION_SECONDS", value)
        assert get_template_duration_seconds() == 1.0
