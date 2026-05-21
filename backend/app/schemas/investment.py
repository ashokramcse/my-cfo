from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import date, datetime
import uuid


class InvestmentCreate(BaseModel):
    investment_type: str
    name: str
    symbol: Optional[str] = None
    folio_number: Optional[str] = None
    units: Decimal = Decimal("0")
    avg_buy_price: Decimal = Decimal("0")
    current_price: Decimal = Decimal("0")
    invested_amount: Decimal = Decimal("0")
    is_sip: bool = False
    sip_amount: Optional[Decimal] = None
    sip_date: Optional[int] = None
    sip_status: str = "ACTIVE"
    sip_start_date: Optional[date] = None
    sip_end_date: Optional[date] = None
    weight_grams: Optional[Decimal] = None
    purity: Optional[str] = None
    broker: Optional[str] = None
    platform: Optional[str] = None
    lock_in_until: Optional[date] = None
    purchase_date: Optional[date] = None
    notes: Optional[str] = None


class InvestmentUpdate(BaseModel):
    name: Optional[str] = None
    units: Optional[Decimal] = None
    avg_buy_price: Optional[Decimal] = None
    current_price: Optional[Decimal] = None
    current_value: Optional[Decimal] = None
    invested_amount: Optional[Decimal] = None
    sip_status: Optional[str] = None
    sip_amount: Optional[Decimal] = None
    unrealized_pnl: Optional[Decimal] = None
    realized_pnl: Optional[Decimal] = None
    xirr: Optional[Decimal] = None
    cagr: Optional[Decimal] = None
    notes: Optional[str] = None


class InvestmentOut(BaseModel):
    id: uuid.UUID
    investment_type: str
    name: str
    symbol: Optional[str]
    folio_number: Optional[str]
    units: Decimal
    avg_buy_price: Decimal
    current_price: Decimal
    current_value: Decimal
    invested_amount: Decimal
    is_sip: bool
    sip_amount: Optional[Decimal]
    sip_date: Optional[int]
    sip_status: Optional[str]
    sip_start_date: Optional[date]
    weight_grams: Optional[Decimal]
    purity: Optional[str]
    broker: Optional[str]
    platform: Optional[str]
    lock_in_until: Optional[date]
    is_locked: bool
    unrealized_pnl: Decimal
    realized_pnl: Decimal
    xirr: Optional[Decimal]
    cagr: Optional[Decimal]
    purchase_date: Optional[date]
    notes: Optional[str]
    last_price_updated: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
