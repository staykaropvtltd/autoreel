from fastapi.testclient import TestClient

from app.main import app
from app.services.credit_service import REEL_GENERATION_COST

client = TestClient(app)


def test_credit_endpoints_return_typed_compatible_fields():
    balance = client.get("/api/credits")
    cost = client.get("/api/credits/reel-cost")

    assert balance.status_code == 200
    assert set(balance.json()) == {"user_id", "credits"}
    assert isinstance(balance.json()["user_id"], str)
    assert isinstance(balance.json()["credits"], int)

    assert cost.status_code == 200
    assert set(cost.json()) == {"cost"}
    assert cost.json()["cost"] == REEL_GENERATION_COST
