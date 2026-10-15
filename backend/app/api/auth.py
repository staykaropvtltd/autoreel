
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_db
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.database_models import CreditBalance, User
from app.schemas.auth import (
    AuthResponse,
    GoogleLoginRequest,
    LoginRequest,
    SignupRequest,
)
from app.services.google_identity import (
    GoogleAuthConfigurationError,
    GoogleVerificationUnavailable,
    InvalidGoogleCredential,
    verify_google_id_token,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()

    existing_user = db.scalar(
        select(User).where(User.email == email)
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        brand_name=payload.brand_name.strip()
        if payload.brand_name and payload.brand_name.strip()
        else None,
    )

    try:
        db.add(user)
        db.flush()

        # Create the initial credit balance only once.
        db.add(CreditBalance(user_id=user.id, balance=50))
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    token = create_access_token(user.id, user.email)

    return AuthResponse(
        access_token=token,
        user={
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "brandName": user.brand_name,
            "provider": "email",
        },
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    if (
        user is None
        or user.password_hash is None
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(user.id, user.email)

    return AuthResponse(
        access_token=token,
        user={
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "brandName": user.brand_name,
            "provider": "email",
        },
    )


@router.post("/google", response_model=AuthResponse)
def login_with_google(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    try:
        claims = verify_google_id_token(payload.credential)
    except GoogleAuthConfigurationError as exc:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured") from exc
    except GoogleVerificationUnavailable as exc:
        raise HTTPException(status_code=503, detail="Google sign-in verification is unavailable") from exc
    except InvalidGoogleCredential as exc:
        raise HTTPException(status_code=401, detail="Invalid Google sign-in credential") from exc

    email = claims["email"].strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        name = str(claims.get("name") or email.split("@", 1)[0]).strip()[:255]
        user = User(name=name or email, email=email)
        db.add(user)
        try:
            db.flush()
            db.add(CreditBalance(user_id=user.id, balance=50))
            db.commit()
            db.refresh(user)
        except IntegrityError:
            db.rollback()
            user = db.scalar(select(User).where(User.email == email))
            if user is None:
                raise

    token = create_access_token(user.id, user.email)
    return AuthResponse(
        access_token=token,
        user={
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "brandName": user.brand_name,
            "provider": "google",
            "avatar": claims.get("picture"),
        },
    )
