
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.database_models import CreditBalance, User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login",
    auto_error=False,
)

DEMO_EMAIL = "user_demo@reelkaro.local"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_or_create_demo_user(db: Session) -> User:
    """Fetch or initialize the shared demo user and its starting credit balance."""
    demo_user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if demo_user is None:
        demo_user = User(
            name="Demo Creator",
            email=DEMO_EMAIL,
            brand_name="StayKaro Demo",
        )
        db.add(demo_user)
        db.flush()
        db.add(CreditBalance(user_id=demo_user.id, balance=50))
        db.commit()
        db.refresh(demo_user)
    else:
        # Ensure credit balance exists
        bal = db.scalar(
            select(CreditBalance).where(CreditBalance.user_id == demo_user.id)
        )
        if bal is None:
            db.add(CreditBalance(user_id=demo_user.id, balance=50))
            db.commit()

    return demo_user


def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Decode token if provided and return the authenticated User, or None if anonymous/invalid."""
    if not token:
        return None

    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if not subject:
            return None

        user_id = int(subject)
        return db.scalar(select(User).where(User.id == user_id))
    except Exception:
        return None


def get_current_user_or_demo(
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
) -> User:
    """Return the authenticated user if valid, or fall back to the demo user account."""
    if user is not None:
        return user
    return get_or_create_demo_user(db)


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Strict authentication dependency for endpoints that strictly require a logged-in account."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")

        if not subject:
            raise unauthorized

        user_id = int(subject)
    except (ValueError, TypeError, Exception) as exc:
        if isinstance(exc, HTTPException):
            raise
        raise unauthorized from exc

    user = db.scalar(select(User).where(User.id == user_id))

    if user is None:
        raise unauthorized

    return user

