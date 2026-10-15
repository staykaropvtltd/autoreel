
from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    brand_name: str | None = Field(default=None, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class GoogleLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    credential: str = Field(min_length=20, max_length=8192)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict
