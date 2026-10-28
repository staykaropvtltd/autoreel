
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.core.auth_dependencies import get_current_user
from app.models.database_models import User
from app.services.credit_service import REEL_GENERATION_COST, get_balance

router = APIRouter(prefix="/credits", tags=["Credits"])


class CreditsResponse(BaseModel):
    user_id: str
    credits: int = Field(ge=0)


class ReelCostResponse(BaseModel):
    cost: int = Field(gt=0)


@router.get("", response_model=CreditsResponse)
def get_user_credits(
    current_user: User = Depends(get_current_user),
):
    return {
        "user_id": str(current_user.id),
        "credits": get_balance(current_user.id),
    }


@router.get("/reel-cost", response_model=ReelCostResponse)
def get_reel_cost():
    return {"cost": REEL_GENERATION_COST}
