from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import date, datetime
import uuid


class AssetCreate(BaseModel):
    asset_type: str
    name: str
    description: Optional[str] = None
    purchase_price: Optional[Decimal] = None
    current_value: Decimal
    purchase_date: Optional[date] = None
    depreciation_rate: Decimal = Decimal("0")
    depreciation_method: str = "NONE"
    location: Optional[str] = None
    area_sqft: Optional[Decimal] = None
    registration_number: Optional[str] = None
    make_model: Optional[str] = None
    year_of_manufacture: Optional[int] = None
    is_insured: bool = False
    insurance_expiry: Optional[date] = None
    insurance_value: Optional[Decimal] = None
    is_mortgaged: bool = False
    mortgage_outstanding: Decimal = Decimal("0")
    notes: Optional[str] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    current_value: Optional[Decimal] = None
    description: Optional[str] = None
    is_insured: Optional[bool] = None
    insurance_expiry: Optional[date] = None
    is_mortgaged: Optional[bool] = None
    mortgage_outstanding: Optional[Decimal] = None
    notes: Optional[str] = None


class AssetOut(BaseModel):
    id: uuid.UUID
    asset_type: str
    name: str
    description: Optional[str]
    purchase_price: Optional[Decimal]
    current_value: Decimal
    purchase_date: Optional[date]
    depreciation_rate: Decimal
    location: Optional[str]
    area_sqft: Optional[Decimal]
    registration_number: Optional[str]
    make_model: Optional[str]
    year_of_manufacture: Optional[int]
    is_insured: bool
    insurance_expiry: Optional[date]
    insurance_value: Optional[Decimal]
    is_mortgaged: bool
    mortgage_outstanding: Decimal
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
