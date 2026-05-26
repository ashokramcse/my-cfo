"""
Comprehensive test suite for my-cfo backend.
Tests: security, encryption, parsers, categorizer, schema imports.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import re
import pytest
from decimal import Decimal
from datetime import datetime, timedelta


# ─── Security ─────────────────────────────────────────────────────────────────
def test_password_hash_verify():
    from app.utils.security import hash_password, verify_password
    pw = "TestP@ss123"
    h = hash_password(pw)
    assert h != pw
    assert verify_password(pw, h)
    assert not verify_password("wrong", h)

def test_jwt_access_token():
    from app.utils.security import create_access_token, decode_token
    import uuid
    uid = str(uuid.uuid4())
    token = create_access_token({"sub": uid})
    payload = decode_token(token)
    assert payload["sub"] == uid

def test_jwt_refresh_token():
    from app.utils.security import create_refresh_token, decode_token
    import uuid
    uid = str(uuid.uuid4())
    token = create_refresh_token({"sub": uid})
    payload = decode_token(token)
    assert payload["sub"] == uid


# ─── Encryption ───────────────────────────────────────────────────────────────
def test_encryption_roundtrip():
    from app.utils.encryption import encrypt, decrypt
    plaintext = "sensitive-card-data-1234"
    ct = encrypt(plaintext)
    assert ct != plaintext
    assert decrypt(ct) == plaintext

def test_encryption_nonce_uniqueness():
    from app.utils.encryption import encrypt
    c1 = encrypt("same")
    c2 = encrypt("same")
    assert c1 != c2  # different nonces


# ─── Categorizer ──────────────────────────────────────────────────────────────
def test_categorizer_rules():
    from app.services.categorizer import categorize, extract_merchant_name
    cases = [
        ("SWIGGY ORDER 12345", "FOOD"),
        ("ZOMATO DELIVERY", "FOOD"),
        ("NETFLIX SUBSCRIPTION", "SUBSCRIPTION"),
        ("SPOTIFY PREMIUM", "SUBSCRIPTION"),
        ("AMAZON PRIME", "SUBSCRIPTION"),
        ("AMAZON ORDER 123", "SHOPPING"),
        ("FLIPKART PURCHASE", "SHOPPING"),
        ("MAKEMYTRIP FLIGHT", "TRAVEL"),
        ("IRCTC BOOKING", "TRAVEL"),
        ("BSES ELECTRICITY BILL", "UTILITIES"),
        ("JIO RECHARGE", "UTILITIES"),
        ("BOOKMYSHOW TICKET", "ENTERTAINMENT"),
        ("PVR CINEMAS", "ENTERTAINMENT"),
        ("ANNUAL FEE CHARGE", "FEES"),
        ("ATM WITHDRAWAL 5000", "CASH_WITHDRAWAL"),
        ("BIGBASKET ORDER", "GROCERIES"),
        ("HP PETROL PUMP", "FUEL"),
    ]
    for desc, expected in cases:
        result = categorize(desc)
        assert result == expected, f"'{desc}' -> got '{result}', expected '{expected}'"

def test_extract_merchant_name():
    from app.services.categorizer import extract_merchant_name
    result = extract_merchant_name("SWIGGY ORDER UPI REF 123456 INR")
    assert "Swiggy" in result


# ─── HDFC Parser ──────────────────────────────────────────────────────────────
HDFC_SAMPLE = """
HDFC BANK Credit Card Statement
Card No.: XXXX-XXXX-XXXX-4242
Statement Date: 15/01/2024
Payment Due Date: 05/02/2024

Total Amount Due: ₹15,234.50
Minimum Amount Due: ₹1,523.45
Credit Limit: ₹3,00,000
Available Credit Limit: ₹2,84,765.50
Opening Balance: ₹5,000.00
Closing Balance: ₹15,234.50
Reward Points Balance: 12,450

Transactions:
10/01/2024  SWIGGY ORDER FOOD              450.00 Dr
11/01/2024  AMAZON PURCHASE               2,350.00 Dr
12/01/2024  NETFLIX SUBSCRIPTION          649.00 Dr
13/01/2024  EMI HDFC PERSONAL LOAN       3,500.00 Dr
14/01/2024  PAYMENT RECEIVED            12,000.00 Cr
15/01/2024  ZOMATO DELIVERY               280.00 Dr
16/01/2024  FLIPKART ELECTRONICS         5,200.00 Dr
"""

def test_hdfc_parser():
    from app.parsers.hdfc import HDFCParser
    p = HDFCParser()
    stmt = p.parse(HDFC_SAMPLE)
    assert stmt.bank_name == "HDFC"
    assert stmt.total_due == Decimal("15234.50"), f"total_due: {stmt.total_due}"
    assert stmt.minimum_due == Decimal("1523.45")
    assert stmt.credit_limit == Decimal("300000")
    assert stmt.card_last_four == "4242", f"Card last4 FAIL: {stmt.card_last_four}"
    assert stmt.reward_points_balance == 12450
    assert len(stmt.transactions) >= 6
    
    # Check EMI detected
    emi_txns = [t for t in stmt.transactions if t.is_emi]
    assert len(emi_txns) >= 1, "EMI transaction not detected"
    
    # Check payment detected
    payment_txns = [t for t in stmt.transactions if t.transaction_type == "PAYMENT"]
    assert len(payment_txns) >= 1, "Payment not detected"


# ─── ICICI Parser ─────────────────────────────────────────────────────────────
ICICI_SAMPLE = """
ICICI BANK Credit Card Statement
Card ending XXXX 5678
Due Date: 10-Feb-2024
Total Amount Due: ₹8,500.00
Minimum Amount Due: ₹850.00
Credit Limit: ₹2,00,000
Available Credit: ₹1,91,500

Transaction Date  Post Date    Description           Amount
05-Jan-2024       06-Jan-2024  SWIGGY FOOD           350.00
07-Jan-2024       08-Jan-2024  PAYMENT RECEIVED    5,000.00 Cr
09-Jan-2024       10-Jan-2024  AMAZON ORDER        1,200.00
10-Jan-2024       11-Jan-2024  EMI APPLE IPHONE    3,500.00
"""

def test_icici_parser():
    from app.parsers.icici import ICICIParser
    p = ICICIParser()
    stmt = p.parse(ICICI_SAMPLE)
    assert stmt.bank_name == "ICICI"
    assert stmt.total_due == Decimal("8500.00")
    assert stmt.card_last_four == "5678", f"Card last4: {stmt.card_last_four}"
    assert len(stmt.transactions) >= 3


# ─── Deduplication ────────────────────────────────────────────────────────────
def _dedup_key(t):
    d = t.date.date() if hasattr(t.date, 'date') else t.date
    return (d, t.amount, t.description[:30])

def test_deduplication():
    from app.parsers.base import ParsedTransaction
    d = datetime(2024, 1, 10)
    t = ParsedTransaction(date=d, description="SWIGGY ORDER FOOD", amount=Decimal("450"), transaction_type="PURCHASE")
    assert _dedup_key(t) == _dedup_key(t)

def test_dedup_key_uniqueness():
    from app.parsers.base import ParsedTransaction
    d = datetime(2024, 1, 10)
    t1 = ParsedTransaction(date=d, description="SWIGGY", amount=Decimal("450"), transaction_type="PURCHASE")
    t2 = ParsedTransaction(date=d, description="ZOMATO", amount=Decimal("450"), transaction_type="PURCHASE")
    assert _dedup_key(t1) != _dedup_key(t2)


# ─── Schema imports ───────────────────────────────────────────────────────────
def test_schema_imports():
    from app import schemas  # noqa – ensures no import-time errors
    # Actual exported names from schemas/__init__.py
    assert hasattr(schemas, "RegisterRequest")
    assert hasattr(schemas, "CardCreate")
    assert hasattr(schemas, "TransactionCreate")

def test_insight_model_import():
    from app.models.insight import Insight
    cols = {c.key for c in Insight.__table__.columns}
    assert "insight_data" in cols, f"'insight_data' not in {cols}"
    assert "metadata" not in cols, "'metadata' still present — rename not applied"

def test_all_model_imports():
    from app.models.user import User
    from app.models.card import CreditCard
    from app.models.transaction import Transaction
    from app.models.emi import EMI
    from app.models.friend import Friend
    from app.models.statement import Statement
    from app.models.insight import Insight
    for model in [User, CreditCard, Transaction, EMI, Friend, Statement, Insight]:
        assert hasattr(model, "__tablename__")


# ─── Pydantic schema validation ───────────────────────────────────────────────
def test_user_register_schema():
    from app.schemas import RegisterRequest
    u = RegisterRequest(username="testuser", email="test@example.com", password="SecureP@ss1")
    assert u.email == "test@example.com"

def test_credit_card_create_schema():
    from app.schemas import CardCreate
    cc = CardCreate(
        bank_name="HDFC",
        card_name="Regalia",
        nickname="My HDFC",
        last_four="4242",
        credit_limit=300000,
        due_date_day=5,
    )
    assert cc.bank_name == "HDFC"

def test_transaction_create_schema():
    from app.schemas import TransactionCreate
    import uuid
    from datetime import date
    tx = TransactionCreate(
        card_id=uuid.uuid4(),
        transaction_date=date.today(),
        description="SWIGGY ORDER",
        amount=Decimal("450.00"),
        transaction_type="PURCHASE",
        category="FOOD",
    )
    assert tx.amount == Decimal("450.00")


# ─── Parser auto-detection ────────────────────────────────────────────────────
def test_parser_autodetect_hdfc():
    from app.parsers import PARSERS
    for cls in PARSERS:
        p = cls()
        if any(re.search(pat, HDFC_SAMPLE, re.IGNORECASE) for pat in p.patterns):
            assert p.bank_name == "HDFC"
            return
    pytest.fail("No parser matched HDFC sample")

def test_parser_autodetect_icici():
    from app.parsers import PARSERS
    for cls in PARSERS:
        p = cls()
        if any(re.search(pat, ICICI_SAMPLE, re.IGNORECASE) for pat in p.patterns):
            assert p.bank_name == "ICICI"
            return
    pytest.fail("No parser matched ICICI sample")

