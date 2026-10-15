import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.api import auth as auth_api
from app.core.auth_dependencies import get_db
from app.core.security import decode_access_token
from app.main import app
from app.models.database_models import Base, CreditBalance, User
from app.services import google_identity


@pytest.fixture
def signing_keys(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()

    class FakeJwksClient:
        def get_signing_key_from_jwt(self, _credential):
            return SimpleNamespace(key=public_key)

    monkeypatch.setattr(google_identity, "_jwks_client", FakeJwksClient())
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "reelkaro-test.apps.googleusercontent.com")

    def issue_token(**changes):
        now = int(time.time())
        claims = {
            "iss": "https://accounts.google.com",
            "aud": "reelkaro-test.apps.googleusercontent.com",
            "sub": "google-subject-123",
            "email": "creator@example.test",
            "email_verified": True,
            "name": "Google Creator",
            "exp": now + 300,
            "iat": now,
        }
        claims.update(changes)
        return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "test-key"})

    return issue_token


def test_google_identity_verifies_signature_audience_issuer_and_verified_email(signing_keys):
    claims = google_identity.verify_google_id_token(signing_keys())
    assert claims["sub"] == "google-subject-123"
    assert claims["email"] == "creator@example.test"
    assert claims["email_verified"] is True


@pytest.mark.parametrize(
    "claims",
    [
        {"aud": "another-client.apps.googleusercontent.com"},
        {"iss": "https://attacker.example"},
        {"email_verified": False},
    ],
)
def test_google_identity_rejects_untrusted_claims(signing_keys, claims):
    with pytest.raises(google_identity.InvalidGoogleCredential):
        google_identity.verify_google_id_token(signing_keys(**claims))


@pytest.fixture
def google_client(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'google-auth.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with sessions() as db:
        db.add(User(id=701, email="existing@example.test", name="Existing", password_hash="kept-hash"))
        db.add(CreditBalance(user_id=701, balance=37))
        db.commit()

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app) as client:
            yield client, sessions
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def _claims(email="google@example.test"):
    return {
        "sub": "validated-google-subject",
        "email": email,
        "email_verified": True,
        "name": "Verified Google User",
        "picture": "https://lh3.googleusercontent.com/verified-avatar",
    }


def test_google_login_issues_backend_token_and_creates_isolated_account(google_client, monkeypatch):
    client, sessions = google_client
    monkeypatch.setattr(auth_api, "verify_google_id_token", lambda credential: _claims())

    response = client.post("/api/auth/google", json={"credential": "a-validated-google-id-token"})

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["provider"] == "google"
    assert body["user"]["email"] == "google@example.test"
    assert body["user"]["id"] != "validated-google-subject"
    assert decode_access_token(body["access_token"])["sub"] == body["user"]["id"]
    with sessions() as db:
        created = db.scalar(select(User).where(User.email == "google@example.test"))
        assert created is not None
        balance = db.scalar(select(CreditBalance).where(CreditBalance.user_id == created.id))
        assert balance.balance == 50


def test_google_login_links_only_verified_email_and_preserves_existing_credits(google_client, monkeypatch):
    client, sessions = google_client
    monkeypatch.setattr(auth_api, "verify_google_id_token", lambda credential: _claims("existing@example.test"))

    response = client.post("/api/auth/google", json={"credential": "a-validated-google-id-token"})

    assert response.status_code == 200
    assert response.json()["user"]["id"] == "701"
    with sessions() as db:
        assert db.query(User).filter_by(email="existing@example.test").count() == 1
        assert db.scalar(select(CreditBalance).where(CreditBalance.user_id == 701)).balance == 37


def test_google_login_rejects_invalid_token_and_frontend_user_id(google_client, monkeypatch):
    client, _sessions = google_client
    monkeypatch.setattr(
        auth_api,
        "verify_google_id_token",
        lambda _credential: (_ for _ in ()).throw(google_identity.InvalidGoogleCredential("invalid")),
    )
    invalid = client.post("/api/auth/google", json={"credential": "a-validated-google-id-token"})
    assert invalid.status_code == 401

    supplied_id = client.post(
        "/api/auth/google",
        json={"credential": "a-validated-google-id-token", "user_id": 701},
    )
    assert supplied_id.status_code == 422
