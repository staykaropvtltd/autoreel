
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.models.database_models import EditorProject, User, ReelHistory


def _get_user_by_id(db, user_id: int) -> User:
    user = db.scalar(
        select(User).where(User.id == user_id)
    )

    if user is None:
        raise ValueError("Authenticated user not found")

    return user


def create_reel_history(
    reel_id: str,
    user_id: int,
    title: str | None = None,
) -> None:
    with SessionLocal() as db:
        with db.begin():
            _get_user_by_id(db, user_id)

            record = ReelHistory(
                reel_id=reel_id,
                user_id=user_id,
                status="queued",
                title=title or f"Reel {reel_id[:8]}",
                output_path=None,
                created_at=datetime.now(timezone.utc),
            )
            db.add(record)


def update_reel_history(
    reel_id: str,
    *,
    status: str,
    output_path: str | None = None,
) -> None:
    with SessionLocal() as db:
        with db.begin():
            record = db.scalar(
                select(ReelHistory)
                .where(ReelHistory.reel_id == reel_id)
                .with_for_update()
            )

            if record is None:
                return

            record.status = status

            if output_path is not None:
                record.output_path = output_path


def list_reel_history(
    user_id: int,
    limit: int = 50,
) -> list[dict]:
    try:
        with SessionLocal() as db:
            _get_user_by_id(db, user_id)

            rows = db.execute(
                select(ReelHistory, EditorProject.id)
                .outerjoin(EditorProject, EditorProject.export_reel_id == ReelHistory.reel_id)
                .where(ReelHistory.user_id == user_id)
                .order_by(ReelHistory.created_at.desc())
                .limit(limit)
            ).all()

            return [
                {
                    "reel_id": record.reel_id,
                    "title": record.title,
                    "status": record.status,
                    "created_at": record.created_at,
                    "source": "image_to_reel" if editor_project_id is not None else "reel_generation",
                }
                for record, editor_project_id in rows
            ]

    except SQLAlchemyError as exc:
        raise RuntimeError(
            "Unable to retrieve reel history"
        ) from exc
