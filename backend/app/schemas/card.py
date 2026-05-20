from pydantic import BaseModel, ConfigDict
from typing import Optional
from decimal import Decimal
from datetime import datetime
import uuid
from app.models.card import CardNetwork, CardStatus


class CardCreate(BaseModel):
    nickname: str
    bank_name: str
    card_name: Optional[str] = None
    last_four: str
    network: CardNetwork = CardNetwork.VISA
    credit_limit: Decimal = Decimal(0)
    interest_rate: Decimal = Decimal(0)
    billing_cycle_day: int = 1
    due_date_day: int = 25
    annual_fee: Decimal = Decimal(0)
    joining_fee: Decimal = Decimal(0)
    reward_program: Optional[str] = None
    reward_rate: Decimal = Decimal(0)
    lounge_access: bool = False
    lounge_quota_quarterly: int = 0
    expiry_month: Optional[int] = None
    expiry_year: Optional[int] = None
    card_color: str = "#6366f1"
    notes: Optional[str] = None


class CardUpdate(BaseModel):
    nickname: Optional[str] = None
    card_name: Optional[str] = None
    status: Optional[CardStatus] = None
    credit_limit: Optional[Decimal] = None
    available_limit: Optional[Decimal] = None
    current_outstanding: Optional[Decimal] = None
    interest_rate: Optional[Decimal] = None
    billing_cycle_day: Optional[int] = None
    due_date_day: Optional[int] = None
    annual_fee: Optional[Decimal] = None
    reward_rate: Optional[Decimal] = None
    total_reward_points: Optional[int] = None
    lounge_access: Optional[bool] = None
    card_color: Optional[str] = None
    notes: Optional[str] = None


class CardOut(BaseModel):
    id: uuid.UUID
    nickname: str
    bank_name: str
    card_name: Optional[str]
    last_four: str
    network: CardNetwork
    status: CardStatus
    credit_limit: Decimal
    available_limit: Decimal
    current_outstanding: Decimal
    interest_rate: Decimal
    billing_cycle_day: int
    due_date_day: int
    annual_fee: Decimal
    reward_program: Optional[str]
    reward_rate: Decimal
    total_reward_points: int
    lounge_access: bool
    lounge_quota_quarterly: int
    expiry_month: Optional[int]
    expiry_year: Optional[int]
    card_color: str
    notes: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CardListOut(BaseModel):
    items: list[CardOut]
    total: int
