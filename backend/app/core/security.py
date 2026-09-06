from pathlib import Path

from fastapi import HTTPException


def safe_filename(filename: str) -> str:
    """Strips to a bare filename and rejects anything that looks like a
    path-traversal attempt (separators, '..', or an empty/None name).
    """
    name = Path(filename).name
    if not name or name != filename or ".." in filename:
        raise HTTPException(status_code=400, detail=f"Invalid filename: {filename}")
    return name
