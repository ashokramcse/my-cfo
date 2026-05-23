from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from typing import Optional
from datetime import datetime
import uuid
import re


class LoginRequest(BaseModel):
    identifier: str  # email or username
    password: str
    remember_device: bool = False


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    country: str = "IN"
    currency: str = "INR"

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9_]{3,30}$", v):
            raise ValueError("Username must be 3–30 chars: lowercase letters, digits, underscores only")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


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
    phone: Optional[str]
    country: str
    currency: str
    timezone: str
    avatar_url: Optional[str]
    profile_bio: Optional[str]
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserPublicOut(BaseModel):
    """Minimal public profile for search results / relationship listings."""
    id: uuid.UUID
    username: str
    full_name: Optional[str]
    avatar_url: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class SessionOut(BaseModel):
    id: uuid.UUID
    device_name: Optional[str]
    ip_address: Optional[str]
    last_used_at: datetime
    created_at: datetime
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v
