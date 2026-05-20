from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime
import uuid
from app.models.emi import EMIStatus, EMIOwnerType


class EMICreate(BaseModel):
    card_id: Optional[uuid.UUID] = None
    friend_id: Optional[uuid.UUID] = None
    product_name: str
    merchant_name: Optional[str] = None
    purchase_date: datetime
    purchase_amount: Decimal
    total_amount: Decimal
    monthly_emi: Decimal
    tenure_months: int
    interest_rate: Decimal = Decimal(0)
    is_no_cost_emi: bool = False
    processing_fee: Decimal = Decimal(0)
    start_date: Optional[datetime] = None
    owner_type: EMIOwnerType = EMIOwnerType.SELF
    user_share_percent: Decimal = Decimal(100)
    reminder_enabled: bool = True
    reminder_day: int = 5
    notes: Optional[str] = None


class EMIUpdate(BaseModel):
    product_name: Optional[str] = None
    paid_months: Optional[int] = None
    amount_paid: Optional[Decimal] = None
    amount_collected: Optional[Decimal] = None
    status: Optional[EMIStatus] = None
    next_due_date: Optional[datetime] = None
    reminder_enabled: Optional[bool] = None
    reminder_day: Optional[int] = None
    notes: Optional[str] = None


class EMIPaymentCreate(BaseModel):
    installment_no: int
    due_date: datetime
    paid_date: Optional[datetime] = None
    expected_amount: Decimal
    paid_amount: Decimal = Decimal(0)
    is_paid: bool = False
    notes: Optional[str] = None


class EMIPaymentOut(BaseModel):
    id: uuid.UUID
    emi_id: uuid.UUID
    installment_no: int
    due_date: datetime
    paid_date: Optional[datetime]
    expected_amount: Decimal
    paid_amount: Decimal
    is_paid: bool
    is_overdue: bool
    late_fee: Decimal
    notes: Optional[str]

    class Config:
        from_attributes = True


class EMIOut(BaseModel):
    id: uuid.UUID
    card_id: Optional[uuid.UUID]
    friend_id: Optional[uuid.UUID]
    product_name: str
    merchant_name: Optional[str]
    purchase_date: datetime
    purchase_amount: Decimal
    total_amount: Decimal
    monthly_emi: Decimal
    tenure_months: int
    interest_rate: Decimal
    is_no_cost_emi: bool
    processing_fee: Decimal
    total_interest: Decimal
    paid_months: int
    remaining_months: Optional[int]
    amount_paid: Decimal
    amount_remaining: Optional[Decimal]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    next_due_date: Optional[datetime]
    owner_type: EMIOwnerType
    user_share_percent: Decimal
    status: EMIStatus
    amount_collected: Decimal
    reminder_enabled: bool
    reminder_day: int
    notes: Optional[str]
    created_at: datetime
    payments: list[EMIPaymentOut] = []

    class Config:
        from_attributes = True
