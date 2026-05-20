from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
import uuid
from app.models.transaction import TransactionType, CategoryType


class TransactionCreate(BaseModel):
    card_id: Optional[uuid.UUID] = None
    transaction_date: datetime
    description: str
    merchant_name: Optional[str] = None
    amount: Decimal
    currency: str = "INR"
    transaction_type: TransactionType = TransactionType.PURCHASE
    category: CategoryType = CategoryType.OTHER
    gst_amount: Decimal = Decimal(0)
    cashback_amount: Decimal = Decimal(0)
    reward_points: int = 0
    is_recurring: bool = False
    is_subscription: bool = False
    notes: Optional[str] = None
    tags: List[str] = []


class TransactionUpdate(BaseModel):
    description: Optional[str] = None
    merchant_name: Optional[str] = None
    amount: Optional[Decimal] = None
    transaction_type: Optional[TransactionType] = None
    category: Optional[CategoryType] = None
    is_recurring: Optional[bool] = None
    is_subscription: Optional[bool] = None
    is_excluded: Optional[bool] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class TransactionOut(BaseModel):
    id: uuid.UUID
    card_id: Optional[uuid.UUID]
    statement_id: Optional[uuid.UUID]
    transaction_date: datetime
    description: str
    merchant_name: Optional[str]
    amount: Decimal
    currency: str
    transaction_type: TransactionType
    category: CategoryType
    is_emi: bool
    emi_id: Optional[uuid.UUID]
    gst_amount: Decimal
    cashback_amount: Decimal
    reward_points: int
    is_recurring: bool
    is_subscription: bool
    is_duplicate: bool
    is_suspicious: bool
    is_excluded: bool
    notes: Optional[str]
    tags: List
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionListOut(BaseModel):
    items: list[TransactionOut]
    total: int
    total_amount: Decimal
    page: int
    page_size: int
