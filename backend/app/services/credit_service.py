"""Persistent, user-scoped credit operations.

Each balance mutation and its ledger row commit together. PostgreSQL serializes
operations for one account by locking the parent user row before the balance
row; SQLite uses BEGIN IMMEDIATE for deterministic local/test serialization.
"""

from contextlib import contextmanager

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.database_models import CreditBalance, CreditTransaction, User

INITIAL_CREDITS = 50
REEL_GENERATION_COST = 10
MAX_CREDITS = 50


@contextmanager
def _credit_session():
    with SessionLocal() as db:
        try:
            with db.begin():
                # PostgreSQL row locks are the production concurrency control.
                # SQLite ignores FOR UPDATE, so acquire its write reservation
                # before reading the balance in tests/local development.
                if db.bind is not None and db.bind.dialect.name == "sqlite":
                    db.execute(text("BEGIN IMMEDIATE"))
                yield db
        except Exception:
            db.rollback()
            raise


def _locked_balance(db: Session, user_id: int) -> CreditBalance:
    user = db.scalar(select(User).where(User.id == user_id).with_for_update())
    if user is None:
        raise ValueError("Authenticated user not found")

    balance = db.scalar(
        select(CreditBalance)
        .where(CreditBalance.user_id == user_id)
        .with_for_update()
    )
    if balance is None:
        balance = CreditBalance(user_id=user_id, balance=INITIAL_CREDITS)
        db.add(balance)
        db.flush()
        db.add(CreditTransaction(
            user_id=user_id,
            transaction_type="addition",
            amount=INITIAL_CREDITS,
            balance_after=INITIAL_CREDITS,
            description="Initial credit grant",
        ))
        db.flush()
    return balance


def _existing_reel_transaction(
    db: Session, user_id: int, transaction_type: str, reel_id: str | None
) -> CreditTransaction | None:
    if not reel_id:
        return None
    return db.scalar(
        select(CreditTransaction).where(
            CreditTransaction.user_id == user_id,
            CreditTransaction.transaction_type == transaction_type,
            CreditTransaction.reel_id == reel_id,
        ).limit(1)
    )


def get_balance(user_id: int) -> int:
    with _credit_session() as db:
        return _locked_balance(db, user_id).balance


def deduct_credits(
    user_id: int,
    amount: int,
    *,
    reel_id: str | None = None,
    description: str | None = None,
) -> int:
    if amount <= 0:
        raise ValueError("Credit amount must be greater than 0")
    with _credit_session() as db:
        balance = _locked_balance(db, user_id)
        if _existing_reel_transaction(db, user_id, "deduction", reel_id):
            return balance.balance
        if balance.balance < amount:
            raise ValueError(
                f"Insufficient credits. Available: {balance.balance}, required: {amount}"
            )
        balance.balance -= amount
        db.add(CreditTransaction(
            user_id=user_id,
            transaction_type="deduction",
            amount=amount,
            balance_after=balance.balance,
            reel_id=reel_id,
            description=description or "Reel generation credit deduction",
        ))
        db.flush()
        return balance.balance


def add_credits(
    user_id: int,
    amount: int,
    *,
    reel_id: str | None = None,
    description: str | None = None,
) -> int:
    if amount <= 0:
        raise ValueError("Credit amount must be greater than 0")
    with _credit_session() as db:
        balance = _locked_balance(db, user_id)
        new_balance = min(balance.balance + amount, MAX_CREDITS)
        applied = new_balance - balance.balance
        balance.balance = new_balance
        db.add(CreditTransaction(
            user_id=user_id,
            transaction_type="addition",
            amount=applied,
            balance_after=new_balance,
            reel_id=reel_id,
            description=description or "Credits added",
        ))
        db.flush()
        return new_balance


def refund_credits(
    user_id: int,
    amount: int,
    *,
    reel_id: str | None = None,
    description: str | None = None,
) -> int:
    if amount <= 0:
        raise ValueError("Refund amount must be greater than 0")
    with _credit_session() as db:
        balance = _locked_balance(db, user_id)
        # The reel's refund row is the idempotency marker, including when the
        # account cap means that no additional credits can be applied.
        if _existing_reel_transaction(db, user_id, "refund", reel_id):
            return balance.balance
        new_balance = min(balance.balance + amount, MAX_CREDITS)
        applied = new_balance - balance.balance
        balance.balance = new_balance
        db.add(CreditTransaction(
            user_id=user_id,
            transaction_type="refund",
            amount=applied,
            balance_after=new_balance,
            reel_id=reel_id,
            description=description or "Failed reel generation refund",
        ))
        db.flush()
        return new_balance
