import re
from decimal import Decimal
from datetime import datetime
from typing import Optional
from app.parsers.base import BaseParser, ParsedStatement, ParsedTransaction


class HDFCParser(BaseParser):
    bank_name = "HDFC"
    patterns = [r"HDFC\s+BANK", r"hdfcbank\.com", r"HDFC\s+Credit\s+Card"]

    def parse(self, text: str) -> ParsedStatement:
        stmt = ParsedStatement(bank_name=self.bank_name, raw_text=text)

        # Extract key financial figures
        stmt.total_due = self._extract_amount(text, r"Total\s+Amount\s+Due[:\s₹]+([\d,\.]+)")
        stmt.minimum_due = self._extract_amount(text, r"Minimum\s+Amount\s+Due[:\s₹]+([\d,\.]+)")
        stmt.credit_limit = self._extract_amount(text, r"Credit\s+Limit[:\s₹]+([\d,\.]+)")
        stmt.available_credit = self._extract_amount(text, r"Available\s+Credit\s+Limit[:\s₹]+([\d,\.]+)")
        stmt.opening_balance = self._extract_amount(text, r"Opening\s+Balance[:\s₹]+([\d,\.]+)")
        stmt.closing_balance = self._extract_amount(text, r"Closing\s+Balance[:\s₹]+([\d,\.]+)")

        # Dates
        stmt.due_date = self._extract_date(text, r"Payment\s+Due\s+Date[:\s]+(\d{2}/\d{2}/\d{4})")
        stmt.statement_date = self._extract_date(text, r"Statement\s+Date[:\s]+(\d{2}/\d{2}/\d{4})")

        # Card number
        m = re.search(r"Card\s+No[.:\s]+[X*]+(\d{4})", text, re.IGNORECASE)
        if m:
            stmt.card_last_four = m.group(1)

        # Reward points
        rp = re.search(r"Reward\s+Points\s+Balance[:\s]+([\d,]+)", text, re.IGNORECASE)
        if rp:
            stmt.reward_points_balance = int(rp.group(1).replace(",", ""))

        # Transactions
        stmt.transactions = self._parse_transactions(text)
        stmt.parse_confidence = 0.85 if stmt.transactions else 0.3
        return stmt

    def _extract_amount(self, text: str, pattern: str) -> Decimal:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return self._parse_amount(m.group(1))
        return Decimal(0)

    def _extract_date(self, text: str, pattern: str) -> Optional[datetime]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return self._parse_date(m.group(1))
        return None

    def _parse_transactions(self, text: str) -> list[ParsedTransaction]:
        transactions = []
        # HDFC transaction pattern: DD/MM/YYYY  description  amount
        pattern = re.compile(
            r"(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Cr|Dr)?",
            re.MULTILINE,
        )
        for m in pattern.finditer(text):
            date_str, desc, amount_str, cr_dr = m.groups()
            date = self._parse_date(date_str)
            if not date:
                continue
            amount = self._parse_amount(amount_str)
            tx_type = "PAYMENT" if cr_dr and cr_dr.upper() == "CR" else "PURCHASE"
            is_emi = bool(re.search(r"EMI|Equated", desc, re.IGNORECASE))
            if is_emi:
                tx_type = "EMI"

            transactions.append(ParsedTransaction(
                date=date,
                description=desc.strip(),
                amount=amount,
                transaction_type=tx_type,
                is_emi=is_emi,
                raw_text=m.group(0),
            ))
        return transactions
