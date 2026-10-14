
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]

configured_root = Path(
    os.getenv("REELKARO_STORAGE_DIR", str(BACKEND_DIR / "storage"))
)

if not configured_root.is_absolute():
    configured_root = BACKEND_DIR / configured_root

STORAGE_ROOT = configured_root.resolve()
OUTPUTS_DIR = STORAGE_ROOT / "outputs"
TEMP_DIR = STORAGE_ROOT / "temp"

OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)
