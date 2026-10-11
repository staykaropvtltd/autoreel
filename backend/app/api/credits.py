from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.credit_service import (
    get_balance,
    add_credits,
    deduct_credits,
    REEL_GENERATION_COST,
)

router = APIRouter(prefix="/credits", tags=["Credits"])

# Temporary user until authentication/database is integrated
DEMO_USER_ID = "user_demo"


class CreditAmountRequest(BaseModel):
    amount: int


@router.get("")
def get_user_credits():
    """
    Get current user's credit balance.
    Temporary: uses user_demo.
    """
    balance = get_balance(DEMO_USER_ID)

    return {
        "user_id": DEMO_USER_ID,
        "credits": balance,
    }


@router.post("/add")
def add_user_credits(request: CreditAmountRequest):
    """
    Temporary endpoint for testing/admin purposes.
    """
    if request.amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Credit amount must be greater than 0",
        )

    balance = add_credits(
        DEMO_USER_ID,
        request.amount,
    )

    return {
        "user_id": DEMO_USER_ID,
        "added": request.amount,
        "credits": balance,
    }


@router.post("/deduct")
def deduct_user_credits(request: CreditAmountRequest):
    """
    Deduct credits from the current user.
    """
    if request.amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Credit amount must be greater than 0",
        )

    try:
        balance = deduct_credits(
            DEMO_USER_ID,
            request.amount,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Unable to process the credit request.",
        )

    return {
        "user_id": DEMO_USER_ID,
        "deducted": request.amount,
        "credits": balance,
    }


@router.get("/reel-cost")
def get_reel_cost():
    """
    Return the current cost of generating a reel.
    """
    return {
        "cost": REEL_GENERATION_COST,
    }