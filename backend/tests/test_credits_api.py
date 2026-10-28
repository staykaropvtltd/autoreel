import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth_dependencies import get_current_user, get_db
from app.main import app
from app.models.database_models import Base, User
from app.services import credit_service
from app.services.credit_service import REEL_GENERATION_COST


@pytest.fixture
def credits_client(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'credits-api.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    user = User(id=765432, email="credits-api@example.test", name="Credits API")
    with sessions() as db:
        db.add(user)
        db.commit()

    def override_db():
        with sessions() as db:
            yield db

    monkeypatch.setitem(app.dependency_overrides, get_db, override_db)
    monkeypatch.setitem(
        app.dependency_overrides,
        get_current_user,
        lambda: User(id=765432, email="credits-api@example.test", name="Credits API"),
    )
    monkeypatch.setattr(credit_service, "SessionLocal", sessions)
    with TestClient(app) as test_client:
        yield test_client
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_credit_endpoints_return_typed_compatible_fields(credits_client):
    balance = credits_client.get("/api/credits")
    cost = credits_client.get("/api/credits/reel-cost")

    assert balance.status_code == 200
    assert set(balance.json()) == {"user_id", "credits"}
    assert isinstance(balance.json()["user_id"], str)
    assert isinstance(balance.json()["credits"], int)

    assert cost.status_code == 200
    assert set(cost.json()) == {"cost"}
    assert cost.json()["cost"] == REEL_GENERATION_COST
