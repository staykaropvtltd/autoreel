import pytest
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.models.database_models import Base, CreditBalance, CreditTransaction, User
from app.services import credit_service


@pytest.fixture
def isolated_credit_user(tmp_path, monkeypatch):
    """Exercise persistence against a temporary SQLite database and user."""
    engine = create_engine(
        f"sqlite:///{tmp_path / 'credits.db'}",
        connect_args={"timeout": 20},
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    user_id = 987654

    with sessions() as db:
        db.add(User(id=user_id, email="credits@example.test", name="Credit Test"))
        db.commit()

    monkeypatch.setattr(credit_service, "SessionLocal", sessions)
    yield user_id

    Base.metadata.drop_all(engine)
    engine.dispose()


def test_credit_balance_persists_across_database_sessions(isolated_credit_user):
    user_id = isolated_credit_user

    initial = credit_service.get_balance(user_id)
    after_deduction = credit_service.deduct_credits(user_id, 10)
    persisted = credit_service.get_balance(user_id)
    restored = credit_service.refund_credits(user_id, 10)

    assert initial == credit_service.INITIAL_CREDITS
    assert after_deduction == persisted == initial - 10
    assert restored == credit_service.get_balance(user_id) == initial

    # Ledger rows survive closing and reopening an independent DB session.
    with credit_service.SessionLocal() as db:
        rows = db.scalars(
            select(CreditTransaction)
            .where(CreditTransaction.user_id == user_id)
            .order_by(CreditTransaction.id)
        ).all()
    assert [(row.transaction_type, row.amount, row.balance_after) for row in rows] == [
        ("addition", 50, 50), ("deduction", 10, 40), ("refund", 10, 50)
    ]
    assert rows[1].description and rows[1].created_at and rows[1].reel_id is None


def test_add_credits_respects_the_account_balance_limit(isolated_credit_user):
    user_id = isolated_credit_user
    assert credit_service.deduct_credits(user_id, 20) == 30
    assert credit_service.add_credits(user_id, 30) == credit_service.MAX_CREDITS

    with credit_service.SessionLocal() as db:
        addition = db.scalar(
            select(CreditTransaction)
            .where(CreditTransaction.user_id == user_id,
                   CreditTransaction.transaction_type == "addition")
            .order_by(CreditTransaction.id.desc())
        )
    assert addition.amount == 20  # Record the amount actually credited at the cap.
    assert addition.balance_after == 50


def test_insufficient_deduction_does_not_change_balance_or_write_ledger(isolated_credit_user):
    user_id = isolated_credit_user
    with pytest.raises(ValueError, match="Insufficient credits"):
        credit_service.deduct_credits(user_id, 51)
    assert credit_service.get_balance(user_id) == 50
    with credit_service.SessionLocal() as db:
        rows = db.scalars(select(CreditTransaction).where(CreditTransaction.user_id == user_id)).all()
    assert len(rows) == 1  # initial grant only


def test_reel_deduction_and_refund_are_idempotent(isolated_credit_user):
    user_id = isolated_credit_user
    reel_id = "11111111-1111-4111-8111-111111111111"
    assert credit_service.deduct_credits(user_id, 10, reel_id=reel_id) == 40
    assert credit_service.deduct_credits(user_id, 10, reel_id=reel_id) == 40
    assert credit_service.refund_credits(user_id, 10, reel_id=reel_id) == 50
    assert credit_service.refund_credits(user_id, 10, reel_id=reel_id) == 50
    with credit_service.SessionLocal() as db:
        rows = db.scalars(
            select(CreditTransaction).where(
                CreditTransaction.user_id == user_id,
                CreditTransaction.reel_id == reel_id,
            )
        ).all()
    assert [(row.transaction_type, row.amount) for row in rows] == [
        ("deduction", 10), ("refund", 10)
    ]


def test_concurrent_deductions_serialize_without_overspending(isolated_credit_user):
    user_id = isolated_credit_user

    def deduct_once(_):
        try:
            credit_service.deduct_credits(user_id, 10)
            return True
        except ValueError as exc:
            assert "Insufficient credits" in str(exc)
            return False

    with ThreadPoolExecutor(max_workers=8) as pool:
        outcomes = list(pool.map(deduct_once, range(8)))
    assert sum(outcomes) == 5
    assert credit_service.get_balance(user_id) == 0
    with credit_service.SessionLocal() as db:
        deductions = db.scalars(
            select(CreditTransaction).where(
                CreditTransaction.user_id == user_id,
                CreditTransaction.transaction_type == "deduction",
            )
        ).all()
    assert len(deductions) == 5
    assert all(item.balance_after >= 0 for item in deductions)


def test_credit_operations_reject_unknown_user_without_creating_an_account(isolated_credit_user):
    unknown_user_id = isolated_credit_user + 1
    with pytest.raises(ValueError, match="Authenticated user not found"):
        credit_service.get_balance(unknown_user_id)
