import re
from decimal import Decimal
from app.parsers.base import BaseParser, ParsedStatement, ParsedTransaction


class SBIParser(BaseParser):
    bank_name = "SBI"
    patterns = [r"STATE\s+BANK\s+OF\s+INDIA", r"sbicard\.com", r"SBI\s+Card"]

    def parse(self, text: str) -> ParsedStatement:
        stmt = ParsedStatement(bank_name=self.bank_name, raw_text=text)

        def ex(p):
            m = re.search(p, text, re.IGNORECASE)
            return self._parse_amount(m.group(1)) if m else Decimal(0)

        stmt.total_due = ex(r"Total\s+Amount\s+Due[:\s₹]+([\d,\.]+)")
        stmt.minimum_due = ex(r"Minimum\s+Due[:\s₹]+([\d,\.]+)")
        stmt.credit_limit = ex(r"Credit\s+Limit[:\s₹]+([\d,\.]+)")

        m = re.search(r"Payment\s+Due\s+Date[:\s]+(\d{2}/\d{2}/\d{4})", text, re.IGNORECASE)
        if m:
            stmt.due_date = self._parse_date(m.group(1))

        stmt.transactions = self._parse_transactions(text)
        stmt.parse_confidence = 0.78 if stmt.transactions else 0.3
        return stmt

    def _parse_transactions(self, text: str) -> list[ParsedTransaction]:
        transactions = []
        pattern = re.compile(
            r"(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Cr)?",
            re.MULTILINE,
        )
        for m in pattern.finditer(text):
            date_str, desc, amount_str, cr = m.groups()
            date = self._parse_date(date_str)
            if not date:
                continue
            amount = self._parse_amount(amount_str)
            tx_type = "PAYMENT" if cr else "PURCHASE"
            is_emi = bool(re.search(r"EMI", desc, re.IGNORECASE))
            if is_emi:
                tx_type = "EMI"

            transactions.append(ParsedTransaction(
                date=date, description=desc.strip(),
                amount=amount, transaction_type=tx_type, is_emi=is_emi,
            ))
        return transactions
