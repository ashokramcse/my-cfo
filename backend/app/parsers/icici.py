import re
from decimal import Decimal
from app.parsers.base import BaseParser, ParsedStatement, ParsedTransaction


class ICICIParser(BaseParser):
    bank_name = "ICICI"
    patterns = [r"ICICI\s+BANK", r"icicidirect\.com", r"ICICI\s+Credit\s+Card"]

    def parse(self, text: str) -> ParsedStatement:
        stmt = ParsedStatement(bank_name=self.bank_name, raw_text=text)

        def extract(pattern):
            m = re.search(pattern, text, re.IGNORECASE)
            return self._parse_amount(m.group(1)) if m else Decimal(0)

        stmt.total_due = extract(r"Total\s+Amount\s+Due[:\s₹]+([\d,\.]+)")
        stmt.minimum_due = extract(r"Minimum\s+Amount\s+Due[:\s₹]+([\d,\.]+)")
        stmt.credit_limit = extract(r"Credit\s+Limit[:\s₹]+([\d,\.]+)")
        stmt.available_credit = extract(r"Available\s+Credit[:\s₹]+([\d,\.]+)")

        m = re.search(r"Due\s+Date[:\s]+(\d{2}-[A-Za-z]{3}-\d{4})", text)
        if m:
            stmt.due_date = self._parse_date(m.group(1))

        m = re.search(r"[X*\-\s]*(\d{4})\b", text)
        if m:
            stmt.card_last_four = m.group(1)

        stmt.transactions = self._parse_transactions(text)
        stmt.parse_confidence = 0.82 if stmt.transactions else 0.3
        return stmt

    def _parse_transactions(self, text: str) -> list[ParsedTransaction]:
        transactions = []
        pattern = re.compile(
            r"(\d{2}-[A-Za-z]{3}-\d{4})\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Cr)?",
            re.MULTILINE,
        )
        for m in pattern.finditer(text):
            tx_date, post_date, desc, amount_str, cr = m.groups()
            date = self._parse_date(tx_date)
            if not date:
                continue
            amount = self._parse_amount(amount_str)
            tx_type = "PAYMENT" if cr else "PURCHASE"
            is_emi = bool(re.search(r"EMI", desc, re.IGNORECASE))
            if is_emi:
                tx_type = "EMI"

            transactions.append(ParsedTransaction(
                date=date,
                description=desc.strip(),
                amount=amount,
                transaction_type=tx_type,
                is_emi=is_emi,
            ))
        return transactions
