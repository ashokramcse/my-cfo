from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional
from datetime import datetime
import uuid


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    full_name: Optional[str]
    currency: str
    timezone: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
