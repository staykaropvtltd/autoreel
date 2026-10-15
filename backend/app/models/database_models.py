
from datetime import datetime, timezone
from sqlalchemy import JSON, BigInteger, Float, UniqueConstraint

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass



class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    name: Mapped[str] = mapped_column(
        String(255), nullable=False, default=""
    )
    brand_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )



class CreditBalance(Base):
    __tablename__ = "credit_balances"

    __table_args__ = (
        CheckConstraint("balance >= 0", name="ck_credit_balance_nonnegative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    balance: Mapped[int] = mapped_column(
        Integer, default=50, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class ReelHistory(Base):
    __tablename__ = "reel_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reel_id: Mapped[str | None] = mapped_column(
        String(36), unique=True, index=True, nullable=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30), default="pending", nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    output_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class BrandSettings(Base):
    __tablename__ = "brand_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(255), default="", nullable=False
    )
    tagline: Mapped[str] = mapped_column(
        String(500), default="", nullable=False
    )
    primary_color: Mapped[str] = mapped_column(
        String(7), default="#000000", nullable=False
    )
    secondary_color: Mapped[str] = mapped_column(
        String(7), default="#FFFFFF", nullable=False
    )
    text_color: Mapped[str] = mapped_column(
        String(7), default="#FFFFFF", nullable=False
    )

    # Storage object path, not a local filesystem path or public URL.
    logo_storage_path: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    # Preserve additional existing branding options without repeated
    # schema changes as the branding UI evolves.
    options: Mapped[dict] = mapped_column(
        JSON, default=dict, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class UserPreferences(Base):
    """Durable, non-sensitive preferences owned by one account."""
    __tablename__ = "user_preferences"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    theme: Mapped[str] = mapped_column(String(10), default="dark", nullable=False)
    default_target_duration: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    default_aspect_ratio: Mapped[str] = mapped_column(String(10), default="9:16", nullable=False)
    default_resolution: Mapped[str] = mapped_column(String(20), default="1080x1920", nullable=False)
    default_frame_rate: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    preferred_music_track_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    preferred_template_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    auto_save: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notifications: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    compact_layout: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )


class MusicTrack(Base):
    __tablename__ = "music_tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # NULL means a built-in/shared track; otherwise, it belongs to a user.
    owner_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )

    title: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    original_filename: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    storage_path: Mapped[str] = mapped_column(
        Text, unique=True, nullable=False
    )
    file_format: Mapped[str] = mapped_column(
        String(20), nullable=False
    )
    file_size_bytes: Mapped[int] = mapped_column(
        BigInteger, nullable=False
    )
    duration_seconds: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )
    is_builtin: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class UploadedAsset(Base):
    __tablename__ = "uploaded_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # Examples: source_video, source_photo, logo, thumbnail.
    asset_type: Mapped[str] = mapped_column(
        String(40), nullable=False
    )
    original_filename: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    storage_path: Mapped[str] = mapped_column(
        Text, unique=True, nullable=False
    )
    mime_type: Mapped[str] = mapped_column(
        String(150), nullable=False
    )
    file_size_bytes: Mapped[int] = mapped_column(
        BigInteger, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class EditorProject(Base):
    """Persistent Image-to-Reel editor state and export recovery metadata."""
    __tablename__ = "editor_projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    project_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    export_status: Mapped[str] = mapped_column(String(30), default="idle", nullable=False)
    export_reel_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    export_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    export_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # Store a positive quantity and distinguish the operation by type.
    transaction_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )
    amount: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    balance_after: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    reel_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, index=True
    )
    description: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class ReelJob(Base):
    __tablename__ = "reel_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Generic job identifier used by uploads, analysis, reel render and the
    # free Image-to-Reel exporter. `reel_id` remains the generated reel ID.
    job_id: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)
    reel_id: Mapped[str | None] = mapped_column(
        String(36), unique=True, index=True, nullable=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    request_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(30), default="pending", nullable=False
    )
    job_type: Mapped[str] = mapped_column(String(40), default="reel", nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    stage: Mapped[str] = mapped_column(
        String(50), default="queued", nullable=False
    )
    error: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    # Keep the result metadata in PostgreSQL, not the generated MP4.
    response_data: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )
    output_path: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "request_id",
            name="uq_reel_jobs_user_request",
        ),
    )
