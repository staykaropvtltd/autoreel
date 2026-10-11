from dataclasses import dataclass
from threading import Lock


# =========================
# CREDIT RULES
# =========================

INITIAL_CREDITS = 50
REEL_GENERATION_COST = 10
MAX_CREDITS = 50


# =========================
# CREDIT ACCOUNT
# =========================

@dataclass
class CreditAccount:
    balance: int = INITIAL_CREDITS


# Temporary in-memory storage
_credit_accounts: dict[str, CreditAccount] = {}

_lock = Lock()


# =========================
# GET / CREATE ACCOUNT
# =========================

def get_or_create_account(user_id: str) -> CreditAccount:

    with _lock:

        if user_id not in _credit_accounts:
            _credit_accounts[user_id] = CreditAccount()

        return _credit_accounts[user_id]


# =========================
# GET BALANCE
# =========================

def get_balance(user_id: str) -> int:

    account = get_or_create_account(user_id)

    return account.balance



# =========================
# DEDUCT CREDITS
# =========================

def deduct_credits(user_id: str, amount: int) -> int:

    if amount <= 0:
        raise ValueError("Credit amount must be greater than 0")

    with _lock:

        if user_id not in _credit_accounts:
            _credit_accounts[user_id] = CreditAccount()

        account = _credit_accounts[user_id]

        if account.balance < amount:
            raise ValueError(
                f"Insufficient credits. Available: {account.balance}, required: {amount}"
            )

        account.balance -= amount

        return account.balance


# =========================
# ADD CREDITS
# =========================

def add_credits(user_id: str, amount: int) -> int:

    if amount <= 0:
        raise ValueError("Credit amount must be greater than 0")

    with _lock:

        if user_id not in _credit_accounts:
            _credit_accounts[user_id] = CreditAccount()

        account = _credit_accounts[user_id]

        account.balance = min(
            account.balance + amount,
            MAX_CREDITS
        )

        return account.balance


# =========================
# REFUND CREDITS
# =========================

def refund_credits(user_id: str, amount: int) -> int:

    if amount <= 0:
        raise ValueError("Refund amount must be greater than 0")

    with _lock:

        if user_id not in _credit_accounts:
            _credit_accounts[user_id] = CreditAccount()

        account = _credit_accounts[user_id]

        account.balance += amount

        return account.balance