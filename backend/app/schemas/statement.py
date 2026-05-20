from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime
import uuid
from app.models.statement import StatementStatus


class StatementOut(BaseModel):
    id: uuid.UUID
    card_id: uuid.UUID
    filename: str
    statement_date: Optional[datetime]
    period_from: Optional[datetime]
    period_to: Optional[datetime]
    due_date: Optional[datetime]
    opening_balance: Decimal
    closing_balance: Decimal
    total_due: Decimal
    minimum_due: Decimal
    total_payments: Decimal
    total_purchases: Decimal
    total_emi: Decimal
    total_fees: Decimal
    total_interest: Decimal
    reward_points_earned: Decimal
    status: StatementStatus
    bank_detected: Optional[str]
    parse_error: Optional[str]
    transaction_count: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class StatementUploadResponse(BaseModel):
    statement_id: uuid.UUID
    status: StatementStatus
    message: str
    task_id: Optional[str] = None
