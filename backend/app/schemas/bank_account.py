from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime
import uuid


class BankAccountCreate(BaseModel):
    nickname: str
    bank_name: str
    account_type: str = "SAVINGS"
    account_number_last4: Optional[str] = None
    ifsc_code: Optional[str] = None
    branch: Optional[str] = None
    current_balance: Decimal = Decimal("0")
    minimum_balance: Decimal = Decimal("0")
    interest_rate: Decimal = Decimal("0")
    maturity_date: Optional[datetime] = None
    maturity_amount: Optional[Decimal] = None
    account_color: str = "#0EA5E9"
    is_active: bool = True
    is_primary: bool = False
    notes: Optional[str] = None


class BankAccountUpdate(BaseModel):
    nickname: Optional[str] = None
    bank_name: Optional[str] = None
    account_type: Optional[str] = None
    current_balance: Optional[Decimal] = None
    minimum_balance: Optional[Decimal] = None
    interest_rate: Optional[Decimal] = None
    maturity_date: Optional[datetime] = None
    maturity_amount: Optional[Decimal] = None
    account_color: Optional[str] = None
    is_active: Optional[bool] = None
    is_primary: Optional[bool] = None
    notes: Optional[str] = None


class BankAccountOut(BaseModel):
    id: uuid.UUID
    nickname: str
    bank_name: str
    account_type: str
    account_number_last4: Optional[str]
    ifsc_code: Optional[str]
    current_balance: Decimal
    minimum_balance: Decimal
    interest_rate: Decimal
    maturity_date: Optional[datetime]
    maturity_amount: Optional[Decimal]
    account_color: str
    is_active: bool
    is_primary: bool
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
