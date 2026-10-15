"""Private Supabase Storage access for user uploaded soundtrack files."""

import base64
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import PurePosixPath


class MusicStorageError(RuntimeError):
    pass


class MusicObjectNotFound(MusicStorageError):
    pass


def _settings() -> tuple[str, str, str]:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    bucket = os.getenv("SUPABASE_MUSIC_BUCKET", "music").strip()
    if not url or not key or not bucket:
        raise MusicStorageError(
            "Music Storage requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "
            "and a non-empty SUPABASE_MUSIC_BUCKET"
        )
    if key.startswith("sb_publishable_"):
        raise MusicStorageError("Music Storage requires a server-side Supabase secret key")
    parts = key.split(".")
    if len(parts) == 3:
        try:
            payload = parts[1] + "=" * (-len(parts[1]) % 4)
            role = json.loads(base64.urlsafe_b64decode(payload)).get("role")
        except (ValueError, TypeError, AttributeError, json.JSONDecodeError):
            role = None
        if role in {"anon", "authenticated"}:
            raise MusicStorageError("Music Storage requires a server-side Supabase secret key")
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise MusicStorageError("SUPABASE_URL must be an absolute HTTP(S) URL")
    if parsed.path.rstrip("/") == "/rest/v1":
        url = urllib.parse.urlunparse(parsed._replace(path="", params="", query="", fragment=""))
    return url, key, bucket


def validate_storage_path(path: str, user_id: int) -> str:
    parts = PurePosixPath(path).parts
    if (
        len(parts) != 3
        or parts[0] != "users"
        or parts[1] != str(user_id)
        or any(part in {"", ".", ".."} for part in parts)
        or "\\" in path
    ):
        raise MusicStorageError("Invalid soundtrack storage path")
    return "/".join(parts)


def _request(method: str, path: str, body: bytes | None = None, content_type: str | None = None) -> bytes:
    url, key, bucket = _settings()
    encoded = "/".join(urllib.parse.quote(part, safe="") for part in PurePosixPath(path).parts)
    endpoint = f"{url}/storage/v1/object/{urllib.parse.quote(bucket, safe='')}/{encoded}"
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    if content_type:
        headers["Content-Type"] = content_type
    if method == "POST":
        headers["x-upsert"] = "false"
    request = urllib.request.Request(endpoint, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            detail = exc.read().decode("utf-8", errors="replace").lower()
            if "bucket" in detail and ("not found" in detail or "does not exist" in detail):
                raise MusicStorageError("Configured music bucket was not found") from exc
            raise MusicObjectNotFound("Soundtrack object not found") from exc
        raise MusicStorageError(f"Supabase Storage returned HTTP {exc.code}") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise MusicStorageError("Supabase Storage is unavailable") from exc


def upload_object(path: str, body: bytes, content_type: str) -> None:
    _request("POST", path, body, content_type)


def get_object(path: str) -> bytes:
    return _request("GET", path)


def delete_object(path: str) -> None:
    _request("DELETE", path)


def create_signed_url(path: str, expires_in: int = 3600) -> str:
    url, key, bucket = _settings()
    encoded = "/".join(urllib.parse.quote(part, safe="") for part in PurePosixPath(path).parts)
    endpoint = f"{url}/storage/v1/object/sign/{urllib.parse.quote(bucket, safe='')}/{encoded}"
    body = json.dumps({"expiresIn": expires_in}).encode("utf-8")
    request = urllib.request.Request(
        endpoint, data=body,
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read())
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError, ValueError) as exc:
        raise MusicStorageError("Could not create a private soundtrack preview URL") from exc
    signed = payload.get("signedURL") or payload.get("signedUrl")
    if not isinstance(signed, str) or not signed:
        raise MusicStorageError("Supabase Storage returned an invalid signed URL")
    if signed.startswith("/"):
        signed = f"{url}/storage/v1{signed}" if not signed.startswith("/storage/v1/") else f"{url}{signed}"
    return signed
