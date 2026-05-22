from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import date, datetime
import uuid


class LoanCreate(BaseModel):
    loan_type: str
    lender_name: str
    loan_account_number: Optional[str] = None
    nickname: Optional[str] = None
    principal_amount: Decimal
    outstanding_balance: Decimal
    emi_amount: Optional[Decimal] = None
    interest_rate: Decimal
    tenure_months: Optional[int] = None
    remaining_months: Optional[int] = None
    start_date: date
    end_date: Optional[date] = None
    emi_due_day: int = 5
    status: str = "ACTIVE"
    is_secured: bool = False
    collateral: Optional[str] = None
    prepayment_penalty: Decimal = Decimal("0")
    is_floating_rate: bool = False
    next_rate_reset_date: Optional[date] = None
    floating_rate_index: Optional[str] = None
    notes: Optional[str] = None


class LoanUpdate(BaseModel):
    lender_name: Optional[str] = None
    nickname: Optional[str] = None
    outstanding_balance: Optional[Decimal] = None
    emi_amount: Optional[Decimal] = None
    total_paid: Optional[Decimal] = None
    total_interest_paid: Optional[Decimal] = None
    remaining_months: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class LoanOut(BaseModel):
    id: uuid.UUID
    loan_type: str
    lender_name: str
    loan_account_number: Optional[str]
    nickname: Optional[str]
    principal_amount: Decimal
    outstanding_balance: Decimal
    emi_amount: Optional[Decimal]
    total_paid: Decimal
    total_interest_paid: Decimal
    interest_rate: Decimal
    tenure_months: Optional[int]
    remaining_months: Optional[int]
    start_date: date
    end_date: Optional[date]
    emi_due_day: int
    status: str
    is_secured: bool
    collateral: Optional[str]
    prepayment_penalty: Decimal
    is_floating_rate: bool
    next_rate_reset_date: Optional[date]
    floating_rate_index: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
