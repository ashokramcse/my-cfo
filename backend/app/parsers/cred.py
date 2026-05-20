"""
Cred app screenshot parser.
Handles two screenshot types:
  - Bill summary: total due, min due, due date, credit limit, available limit
  - Spending summary: category breakdowns + individual transaction list
"""
import re
from decimal import Decimal
from typing import Optional
from app.parsers.base import BaseParser, ParsedStatement, ParsedTransaction


class CredParser(BaseParser):
    bank_name = "CRED"
    # Cred shows the bank card name inside the screenshot
    patterns = [
        r"\bCRED\b",
        r"cred\.club",
        r"pay\s+now.*min\s+due",
        r"total\s+outstanding",
        r"min(?:imum)?\.?\s+due.*pay\s+by",
        r"cred\s+coins",
        r"cashback\s+earned.*cred",
    ]

    # Map Cred's display category names → our internal categories
    CRED_CATEGORY_MAP = {
        "food": "FOOD",
        "food & drinks": "FOOD",
        "food and drinks": "FOOD",
        "dining": "DINING",
        "restaurants": "DINING",
        "groceries": "GROCERIES",
        "grocery": "GROCERIES",
        "shopping": "SHOPPING",
        "fashion": "SHOPPING",
        "apparels": "SHOPPING",
        "travel": "TRAVEL",
        "flights": "TRAVEL",
        "hotels": "TRAVEL",
        "transport": "TRAVEL",
        "fuel": "FUEL",
        "petrol": "FUEL",
        "entertainment": "ENTERTAINMENT",
        "movies": "ENTERTAINMENT",
        "subscriptions": "SUBSCRIPTION",
        "subscription": "SUBSCRIPTION",
        "utilities": "UTILITIES",
        "bills": "UTILITIES",
        "bill payments": "UTILITIES",
        "healthcare": "HEALTHCARE",
        "health": "HEALTHCARE",
        "medical": "HEALTHCARE",
        "education": "EDUCATION",
        "investments": "INVESTMENT",
        "investment": "INVESTMENT",
        "emi": "EMI",
        "rent": "RENT",
        "fees": "FEES",
        "charges": "FEES",
        "cash": "CASH_WITHDRAWAL",
        "atm": "CASH_WITHDRAWAL",
        "others": "OTHER",
        "other": "OTHER",
        "miscellaneous": "OTHER",
    }

    def parse(self, text: str) -> ParsedStatement:
        stmt = ParsedStatement(bank_name=self.bank_name, raw_text=text)

        # Detect underlying bank from card name shown in Cred
        stmt.bank_name = self._detect_card_bank(text)

        stmt.card_last_four = self._extract_card_last_four(text)
        stmt.total_due = self._extract_amount_near(text, r"total\s+(?:outstanding|amount\s+due|due)")
        stmt.minimum_due = self._extract_amount_near(text, r"min(?:imum)?\.?\s+(?:due|amount)")
        stmt.credit_limit = self._extract_amount_near(text, r"credit\s+limit|total\s+limit")
        stmt.available_credit = self._extract_amount_near(text, r"available\s+(?:credit|limit|balance)")
        stmt.due_date = self._extract_due_date(text)

        stmt.transactions = self._parse_transactions(text)

        # Confidence: high if we got due amount, medium if only transactions
        if stmt.total_due > 0:
            stmt.parse_confidence = 0.88
        elif stmt.transactions:
            stmt.parse_confidence = 0.72
        else:
            stmt.parse_confidence = 0.40

        return stmt

    # ── helpers ──────────────────────────────────────────────────────────────

    def _detect_card_bank(self, text: str) -> str:
        text_lower = text.lower()
        bank_map = {
            "HDFC": ["hdfc"],
            "ICICI": ["icici"],
            "SBI": ["sbi", "state bank"],
            "AXIS": ["axis"],
            "AMEX": ["amex", "american express"],
            "KOTAK": ["kotak"],
            "INDUSIND": ["indusind"],
            "YES": ["yes bank"],
            "CITIBANK": ["citibank", "citi"],
            "STANDARD_CHARTERED": ["standard chartered", "sc bank"],
            "HSBC": ["hsbc"],
            "RBL": ["rbl"],
            "IDFC": ["idfc"],
        }
        for bank, keywords in bank_map.items():
            if any(kw in text_lower for kw in keywords):
                return bank
        return "CRED"

    def _extract_card_last_four(self, text: str) -> Optional[str]:
        # Cred shows "•••• 4242" or "XX 4242" or "ending 4242"
        patterns = [
            r"[•\*x]{2,4}\s*(\d{4})\b",
            r"ending\s+(\d{4})\b",
            r"card\s+(?:no\.?|number)?\s*[•\*x\-\s]+(\d{4})\b",
        ]
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                return m.group(1)
        return None

    def _extract_amount_near(self, text: str, label_pattern: str) -> Decimal:
        """Find an INR amount on the same or next line as the label."""
        # Amount: optional ₹, then digits with commas
        amount_pat = r"[₹₹]?\s*([\d,]+(?:\.\d{1,2})?)"
        # Wrap label in non-capturing group so alternations don't break the capture group
        combined = rf"(?:{label_pattern})[:\s]*[₹₹]?\s*([\d,]+(?:\.\d{{1,2}})?)"
        m = re.search(combined, text, re.IGNORECASE)
        if m:
            return self._parse_amount(m.group(1))
        # Try label on one line, amount within next 120 chars
        m = re.search(label_pattern, text, re.IGNORECASE)
        if m:
            tail = text[m.end():m.end() + 120]
            m2 = re.search(amount_pat, tail)
            if m2:
                return self._parse_amount(m2.group(1))
        return Decimal(0)

    def _extract_due_date(self, text: str):
        patterns = [
            r"(?:pay\s+by|due\s+(?:on|date)|payment\s+due)[:\s]+(\d{1,2}[\/\-\s][A-Za-z]{3,9}[\/\-\s]?\d{0,4})",
            r"(?:pay\s+by|due\s+(?:on|date))[:\s]+([A-Za-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?)",
            r"(?:pay\s+by|due\s+(?:on|date))[:\s]+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})",
            r"(?:pay\s+by|due\s+(?:on|date))[:\s]+(\d{2}/\d{2}/\d{4})",
        ]
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                d = self._parse_date(m.group(1).strip())
                if d:
                    return d
        return None

    def _parse_transactions(self, text: str) -> list:
        transactions = []
        transactions.extend(self._parse_transaction_list(text))
        if not transactions:
            transactions.extend(self._parse_category_blocks(text))
        return transactions

    def _parse_transaction_list(self, text: str) -> list:
        """
        Cred transaction list format (two common variants):
          Variant A: "Merchant Name  ₹1,234  12 Jan"
          Variant B: "Merchant Name\n₹1,234\n12 Jan 2024"
        """
        txns = []
        # Variant A — all on one line
        pat_a = re.compile(
            r"^(.+?)\s+[₹₹]([\d,]+(?:\.\d{1,2})?)\s+(\d{1,2}\s+[A-Za-z]{3}(?:\s+\d{4})?)",
            re.MULTILINE,
        )
        for m in pat_a.finditer(text):
            desc, amt_str, date_str = m.group(1).strip(), m.group(2), m.group(3)
            if len(desc) < 3 or len(desc) > 80:
                continue
            date = self._parse_date(date_str)
            if not date:
                continue
            amt = self._parse_amount(amt_str)
            if amt <= 0:
                continue
            txns.append(ParsedTransaction(
                date=date,
                description=desc,
                amount=amt,
                transaction_type="PAYMENT" if re.search(r"payment|credit|refund", desc, re.IGNORECASE) else "PURCHASE",
                is_emi=bool(re.search(r"\bemi\b", desc, re.IGNORECASE)),
            ))

        if txns:
            return txns

        # Variant B — multi-line: merchant / amount / date on separate lines
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        i = 0
        while i < len(lines) - 1:
            line = lines[i]
            # Skip header-like lines
            if re.match(r"^(transactions?|spends?|activity|date|amount|merchant|description)$", line, re.IGNORECASE):
                i += 1
                continue
            # Look for amount on next line
            if i + 1 < len(lines):
                amt_m = re.match(r"^[₹₹]?([\d,]+(?:\.\d{1,2})?)$", lines[i + 1].replace(",", ""))
                amt_m2 = re.match(r"^[₹₹]([\d,]+(?:\.\d{1,2})?)", lines[i + 1])
                amt_match = amt_m2 or amt_m
                if amt_match and 2 < len(line) < 80 and not re.match(r"^[\d₹₹]", line):
                    amt = self._parse_amount(amt_match.group(1))
                    if amt <= 0:
                        i += 1
                        continue
                    date = None
                    if i + 2 < len(lines):
                        date = self._parse_date(lines[i + 2])
                    if not date:
                        from datetime import datetime
                        date = datetime.now().replace(day=1)
                    txns.append(ParsedTransaction(
                        date=date,
                        description=line,
                        amount=amt,
                        transaction_type="PAYMENT" if re.search(r"payment|credit|refund", line, re.IGNORECASE) else "PURCHASE",
                        is_emi=bool(re.search(r"\bemi\b", line, re.IGNORECASE)),
                    ))
                    i += 3
                    continue
            i += 1

        return txns

    def _parse_category_blocks(self, text: str) -> list:
        """
        Spending summary view shows categories + totals.
        Synthesise one aggregate transaction per category.
        """
        txns = []
        # Pattern: "Food & Drinks  ₹4,500" or "Food & Drinks\n₹4,500"
        cat_pat = re.compile(
            r"(food[\w\s&]*|dining|groceri\w+|shopping|fashion|travel|fuel|entertainment|subscri\w+|utilit\w+|health\w*|educat\w+|invest\w+|emi|rent|other\w*)"
            r"\s+[₹₹]?([\d,]+(?:\.\d{1,2})?)",
            re.IGNORECASE | re.MULTILINE,
        )
        from datetime import datetime
        fallback_date = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        seen = set()
        for m in cat_pat.finditer(text):
            raw_cat = m.group(1).strip().lower()
            amt = self._parse_amount(m.group(2))
            if amt <= 0 or raw_cat in seen:
                continue
            seen.add(raw_cat)
            category = self.CRED_CATEGORY_MAP.get(raw_cat, "OTHER")
            txns.append(ParsedTransaction(
                date=fallback_date,
                description=f"[Cred Summary] {raw_cat.title()} spending",
                amount=amt,
                transaction_type="PURCHASE",
            ))
        return txns
