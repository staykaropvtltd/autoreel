from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.credit_service import (
    get_balance,
    REEL_GENERATION_COST,
)

router = APIRouter(prefix="/credits", tags=["Credits"])

# Temporary user until authentication/database is integrated
DEMO_USER_ID = "user_demo"


class CreditsResponse(BaseModel):
    user_id: str
    credits: int = Field(ge=0)


class ReelCostResponse(BaseModel):
    cost: int = Field(gt=0)


@router.get("", response_model=CreditsResponse)
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


@router.get("/reel-cost", response_model=ReelCostResponse)
def get_reel_cost():
    """
    Return the current cost of generating a reel.
    """
    return {
        "cost": REEL_GENERATION_COST,
    }
