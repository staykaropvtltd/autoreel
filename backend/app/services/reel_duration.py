"""Shared durations for segments included in the final reel timeline."""

import math
import os


MAX_TEMPLATE_DURATION_SECONDS = 1.0


def get_template_duration_seconds() -> float:
    """Return the configured opening-template duration, capped at one second."""
    raw_duration = os.getenv("AUTOREEL_TEMPLATE_DURATION_SECONDS", "1")
    try:
        duration = float(raw_duration)
    except (TypeError, ValueError):
        duration = MAX_TEMPLATE_DURATION_SECONDS
    if not math.isfinite(duration) or duration <= 0:
        duration = MAX_TEMPLATE_DURATION_SECONDS
    return min(duration, MAX_TEMPLATE_DURATION_SECONDS)


END_CARD_DURATION_SECONDS = 5.0
