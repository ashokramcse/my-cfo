import re
from decimal import Decimal
from app.parsers.base import BaseParser, ParsedStatement, ParsedTransaction


class GenericParser(BaseParser):
    bank_name = "GENERIC"
    patterns = []

    @classmethod
    def can_parse(cls, text: str) -> bool:
        return True  # always fallback

    def parse(self, text: str) -> ParsedStatement:
        stmt = ParsedStatement(bank_name="UNKNOWN", raw_text=text)

        def ex(p):
            m = re.search(p, text, re.IGNORECASE)
            return self._parse_amount(m.group(1)) if m else Decimal(0)

        stmt.total_due = ex(r"(?:Total\s+)?Amount\s+Due[:\s₹]+([\d,\.]+)")
        stmt.minimum_due = ex(r"Minimum\s+(?:Amount\s+)?Due[:\s₹]+([\d,\.]+)")
        stmt.credit_limit = ex(r"Credit\s+Limit[:\s₹]+([\d,\.]+)")

        stmt.transactions = self._parse_transactions(text)
        stmt.parse_confidence = 0.4 if stmt.transactions else 0.1
        return stmt

    def _parse_transactions(self, text: str) -> list[ParsedTransaction]:
        transactions = []
        # Multiple date format patterns
        patterns = [
            re.compile(r"(\d{2}/\d{2}/\d{4})\s+(.{5,80}?)\s+([\d,]+\.\d{2})\s*(Cr)?", re.MULTILINE),
            re.compile(r"(\d{2}-\d{2}-\d{4})\s+(.{5,80}?)\s+([\d,]+\.\d{2})\s*(Cr)?", re.MULTILINE),
            re.compile(r"(\d{2}\s+[A-Za-z]{3}\s+\d{4})\s+(.{5,80}?)\s+([\d,]+\.\d{2})\s*(Cr)?", re.MULTILINE),
        ]
        for pattern in patterns:
            for m in pattern.finditer(text):
                date_str, desc, amount_str, cr = m.groups()
                date = self._parse_date(date_str)
                if not date:
                    continue
                amount = self._parse_amount(amount_str)
                if amount <= 0:
                    continue
                tx_type = "PAYMENT" if cr else "PURCHASE"
                is_emi = bool(re.search(r"EMI", desc, re.IGNORECASE))
                if is_emi:
                    tx_type = "EMI"

                transactions.append(ParsedTransaction(
                    date=date, description=desc.strip(),
                    amount=amount, transaction_type=tx_type, is_emi=is_emi,
                ))
            if transactions:
                break

        return transactions
