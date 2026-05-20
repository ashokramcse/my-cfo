from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


@dataclass
class ParsedTransaction:
    date: datetime
    description: str
    amount: Decimal
    transaction_type: str = "PURCHASE"
    merchant_name: Optional[str] = None
    is_emi: bool = False
    gst_amount: Decimal = Decimal(0)
    cashback_amount: Decimal = Decimal(0)
    reward_points: int = 0
    currency: str = "INR"
    raw_text: Optional[str] = None


@dataclass
class ParsedStatement:
    bank_name: str
    card_last_four: Optional[str] = None
    statement_date: Optional[datetime] = None
    period_from: Optional[datetime] = None
    period_to: Optional[datetime] = None
    due_date: Optional[datetime] = None
    opening_balance: Decimal = Decimal(0)
    closing_balance: Decimal = Decimal(0)
    total_due: Decimal = Decimal(0)
    minimum_due: Decimal = Decimal(0)
    credit_limit: Decimal = Decimal(0)
    available_credit: Decimal = Decimal(0)
    cash_limit: Decimal = Decimal(0)
    total_payments: Decimal = Decimal(0)
    total_purchases: Decimal = Decimal(0)
    total_fees: Decimal = Decimal(0)
    total_interest: Decimal = Decimal(0)
    reward_points_earned: int = 0
    reward_points_balance: int = 0
    transactions: List[ParsedTransaction] = field(default_factory=list)
    raw_text: str = ""
    parse_confidence: float = 0.0


class BaseParser:
    bank_name: str = "UNKNOWN"
    patterns: list = []  # regex patterns to detect this bank

    @classmethod
    def can_parse(cls, text: str) -> bool:
        import re
        for pattern in cls.patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False

    def parse(self, text: str) -> ParsedStatement:
        raise NotImplementedError

    def _parse_amount(self, s: str) -> Decimal:
        import re
        s = re.sub(r"[₹,\s]", "", str(s)).strip()
        s = s.replace("CR", "").replace("Dr", "").replace("Cr", "")
        try:
            return Decimal(s)
        except Exception:
            return Decimal(0)

    def _parse_date(self, s: str) -> Optional[datetime]:
        from dateutil import parser as dparser
        try:
            return dparser.parse(s, dayfirst=True)
        except Exception:
            return None
