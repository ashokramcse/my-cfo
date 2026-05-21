from pydantic import BaseModel, ConfigDict
from typing import Optional
from decimal import Decimal
from datetime import datetime
import uuid


class FriendCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    relation: str = "FRIEND"
    avatar_color: str = "#6366f1"
    notes: Optional[str] = None


class FriendUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    relation: Optional[str] = None
    avatar_color: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class FriendOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: Optional[str]
    whatsapp: Optional[str]
    email: Optional[str]
    relation: str
    avatar_color: str
    is_active: bool
    total_emi_amount: Decimal
    total_collected: Decimal
    total_pending: Decimal
    active_emi_count: int
    risk_level: str
    notes: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
