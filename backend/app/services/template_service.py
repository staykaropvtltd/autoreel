"""Persistent per-user template metadata and private Supabase Storage access."""

import base64
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path, PurePosixPath

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.storage import TEMP_DIR
from app.models.database_models import Template


class TemplateStorageError(RuntimeError):
    pass


class TemplateObjectNotFound(TemplateStorageError):
    pass


def storage_settings() -> tuple[str, str, str]:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    bucket = os.getenv("SUPABASE_TEMPLATE_BUCKET", "templates").strip()
    if not url or not key or not bucket:
        raise TemplateStorageError(
            "Template Storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; "
            "SUPABASE_TEMPLATE_BUCKET must be non-empty when set"
        )
    if key.startswith("sb_publishable_"):
        raise TemplateStorageError("Template Storage requires a server-side Supabase secret key")
    key_parts = key.split(".")
    if len(key_parts) == 3:
        try:
            payload = key_parts[1] + "=" * (-len(key_parts[1]) % 4)
            role = json.loads(base64.urlsafe_b64decode(payload)).get("role")
        except (ValueError, TypeError, AttributeError, json.JSONDecodeError):
            role = None
        if role in {"anon", "authenticated"}:
            raise TemplateStorageError("Template Storage requires a server-side service-role key")
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise TemplateStorageError("SUPABASE_URL must be an absolute HTTP(S) URL")
    if parsed.path.rstrip("/") == "/rest/v1":
        url = urllib.parse.urlunparse(parsed._replace(path="", params="", query="", fragment=""))
    return url, key, bucket


def validate_storage_path(path: str, user_id: int, template_id: str) -> str:
    parts = PurePosixPath(path).parts
    if (
        len(parts) != 3
        or parts[0] != str(user_id)
        or parts[1] != template_id
        or any(part in {"", ".", ".."} for part in parts)
        or "\\" in path
    ):
        raise TemplateStorageError("Invalid template storage path")
    return "/".join(parts)


def _storage_request(method: str, path: str, body: bytes | None = None, content_type: str | None = None) -> bytes:
    url, key, bucket = storage_settings()
    encoded_path = "/".join(urllib.parse.quote(part, safe="") for part in PurePosixPath(path).parts)
    endpoint = f"{url}/storage/v1/object/{urllib.parse.quote(bucket, safe='')}/{encoded_path}"
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
        detail = exc.read().decode("utf-8", errors="replace").lower()
        if exc.code == 404:
            if "bucket not found" in detail or "bucket does not exist" in detail:
                raise TemplateStorageError("Configured template bucket was not found") from exc
            raise TemplateObjectNotFound("Template object not found") from exc
        if exc.code == 409:
            raise TemplateStorageError("Template object already exists") from exc
        raise TemplateStorageError(f"Supabase Storage returned HTTP {exc.code}: {detail[:200]}") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise TemplateStorageError("Supabase Storage is unavailable") from exc


def upload_object(path: str, body: bytes, content_type: str) -> None:
    _storage_request("POST", path, body, content_type)


def get_object(path: str) -> bytes:
    return _storage_request("GET", path)


def delete_object(path: str) -> None:
    _storage_request("DELETE", path)


def get_owned_template(db: Session, template_id: str, user_id: int) -> Template | None:
    return db.scalar(
        select(Template).where(Template.id == template_id, Template.user_id == user_id)
    )


def template_response(template: Template) -> dict:
    return {
        "template_id": template.id,
        "filename": template.original_filename,
        "content_type": template.content_type,
        "size": template.file_size_bytes,
        "metadata": template.metadata_json or {},
        "created_at": template.created_at,
    }


def render_cache_path(user_id: int, template_id: str, content_type: str) -> Path:
    suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}.get(content_type)
    if suffix is None:
        raise TemplateStorageError("Stored template content type is invalid")
    root = (TEMP_DIR / "templates" / str(user_id)).resolve()
    path = (root / f"{template_id}{suffix}").resolve()
    if not path.is_relative_to(root):
        raise TemplateStorageError("Invalid template cache path")
    return path


def materialize_template(db: Session, template_id: str, user_id: int) -> Path | None:
    template = get_owned_template(db, template_id, user_id)
    if template is None:
        return None
    path = validate_storage_path(template.storage_path, user_id, template.id)
    destination = render_cache_path(user_id, template.id, template.content_type)
    if not destination.is_file():
        data = get_object(path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(destination.suffix + ".tmp")
        temporary.write_bytes(data)
        temporary.replace(destination)
    return destination

