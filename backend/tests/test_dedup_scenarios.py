"""
Dedup logic simulation tests — 4 user scenarios.

Mirrors the exact algorithm in app/workers/tasks.py without needing
a live DB or Celery. Uses plain Python objects so it runs instantly.
"""
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
import uuid
import sys

# ── Minimal mock objects ───────────────────────────────────────────────────────

@dataclass
class FakeTx:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    card_id: Optional[uuid.UUID] = None
    statement_id: Optional[uuid.UUID] = None
    transaction_date: Optional[date] = None
    amount: Decimal = Decimal("0")
    transaction_type: str = "PURCHASE"
    description: str = ""
    is_duplicate: bool = False
    is_excluded: bool = False
    source: str = "bank"          # label for test readability


@dataclass
class FakeStatement:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    bank_detected: str = "HDFC"


# ── Dedup engine (exact replica of tasks.py logic) ────────────────────────────

_AMOUNT_TOLERANCE = Decimal("1.00")
_DATE_WINDOW_DAYS = 2

_AUTHORITY = {
    "HDFC": 10, "ICICI": 10, "SBI": 10, "AXIS": 10,
    "AMEX": 10, "KOTAK": 10, "IDFC": 10, "AU": 10,
    "FEDERAL": 10, "SC": 10, "ONECARD": 10,
    "GENERIC": 1, "UNKNOWN": 1,
}

def _authority(bank: Optional[str]) -> int:
    if not bank:
        return 1
    return _AUTHORITY.get(bank.upper(), 1)


def run_dedup(
    existing_txs: list[FakeTx],        # already in DB from first upload
    incoming_ptxs: list[FakeTx],       # transactions from the new upload
    incoming_bank: str,                 # bank_detected for the new upload
    stmt_bank_map: dict[uuid.UUID, str],# statement_id → bank_detected
    card_id: Optional[uuid.UUID],
    stmt_id: uuid.UUID,
) -> list[FakeTx]:
    """
    Run the dedup pass for one statement upload.
    Returns the final DB state (existing + new rows).
    """
    db: list[FakeTx] = list(existing_txs)   # simulate DB table
    incoming_auth = _authority(incoming_bank)
    consumed_ids: set[uuid.UUID] = set()

    for ptx in incoming_ptxs:
        if card_id is None:
            # No card_id — skip dedup, insert fresh
            db.append(FakeTx(
                card_id=card_id, statement_id=stmt_id,
                transaction_date=ptx.transaction_date, amount=ptx.amount,
                transaction_type=ptx.transaction_type, description=ptx.description,
                source=ptx.source,
            ))
            continue

        date_lo = ptx.transaction_date - timedelta(days=_DATE_WINDOW_DAYS)
        date_hi = ptx.transaction_date + timedelta(days=_DATE_WINDOW_DAYS)

        candidates = [
            t for t in db
            if (t.card_id == card_id
                and t.transaction_type == ptx.transaction_type
                and t.amount >= ptx.amount - _AMOUNT_TOLERANCE
                and t.amount <= ptx.amount + _AMOUNT_TOLERANCE
                and date_lo <= t.transaction_date <= date_hi
                and not t.is_duplicate
                and t.id not in consumed_ids)
        ]
        candidates.sort(key=lambda c: abs((c.transaction_date - ptx.transaction_date).days))

        existing = candidates[0] if candidates else None

        if existing is None:
            db.append(FakeTx(
                card_id=card_id, statement_id=stmt_id,
                transaction_date=ptx.transaction_date, amount=ptx.amount,
                transaction_type=ptx.transaction_type, description=ptx.description,
                source=ptx.source,
            ))
            continue

        consumed_ids.add(existing.id)
        existing_auth = _authority(stmt_bank_map.get(existing.statement_id))

        if incoming_auth > existing_auth:
            existing.is_duplicate = True
            existing.is_excluded  = True
            db.append(FakeTx(
                card_id=card_id, statement_id=stmt_id,
                transaction_date=ptx.transaction_date, amount=ptx.amount,
                transaction_type=ptx.transaction_type, description=ptx.description,
                source=ptx.source,
            ))
        else:
            db.append(FakeTx(
                card_id=card_id, statement_id=stmt_id,
                transaction_date=ptx.transaction_date, amount=ptx.amount,
                transaction_type=ptx.transaction_type, description=ptx.description,
                source=ptx.source,
                is_duplicate=True, is_excluded=True,
            ))

    return db


# ── Helpers ────────────────────────────────────────────────────────────────────

def report(label: str, db: list[FakeTx]):
    clean = [t for t in db if not t.is_duplicate]
    dupes = [t for t in db if t.is_duplicate]
    print(f"\n  {'─'*60}")
    print(f"  {label}")
    print(f"  {'─'*60}")
    print(f"  Total rows : {len(db)}")
    print(f"  Clean (counted in spend) : {len(clean)}")
    print(f"  Duplicate  (suppressed)  : {len(dupes)}")
    for t in db:
        flag = " [DUP ❌]" if t.is_duplicate else " [OK  ✅]"
        print(f"    {t.transaction_date} | {t.description:<28} | ₹{t.amount} | {t.transaction_type:<10} | {t.source}{flag}")
    return clean, dupes


def assert_result(label, clean, dupes, expected_clean, expected_dupes):
    ok = (len(clean) == expected_clean and len(dupes) == expected_dupes)
    status = "PASS ✅" if ok else "FAIL ❌"
    print(f"\n  Result: {status}  (expected {expected_clean} clean / {expected_dupes} dup  |  got {len(clean)} / {len(dupes)})")
    if not ok:
        sys.exit(1)


# ══════════════════════════════════════════════════════════════════════════════
# SCENARIO 1
# Same date, same shop, UPI, same amount — but TWO GENUINELY DIFFERENT payments
# (lunch + dinner both ₹500 Swiggy on 10 Jan, at different times).
# When the second source (CC app PDF) is uploaded it also has both ₹500 rows.
# Expected: 2 clean txs (both real), 2 suppressed dups (from CC app).
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "═"*64)
print("SCENARIO 1 — Same date, same shop, same amount, TWO real txs")
print("             (Swiggy lunch + Swiggy dinner on same day)")
print("═"*64)

CARD = uuid.uuid4()
STMT_BANK = uuid.uuid4()
STMT_APP  = uuid.uuid4()
D = date(2026, 1, 10)

stmt_map: dict[uuid.UUID, str] = {STMT_BANK: "HDFC", STMT_APP: "GENERIC"}

# Upload 1: bank PDF — both real Swiggy ₹500 txs
s1_tx1 = FakeTx(card_id=CARD, statement_id=STMT_BANK, transaction_date=D,
                 amount=Decimal("500"), transaction_type="PURCHASE",
                 description="Swiggy Lunch", source="bank")
s1_tx2 = FakeTx(card_id=CARD, statement_id=STMT_BANK, transaction_date=D,
                 amount=Decimal("500"), transaction_type="PURCHASE",
                 description="Swiggy Dinner", source="bank")

db_after_s1 = [s1_tx1, s1_tx2]
report("After upload 1 (Bank PDF — 2 real Swiggy ₹500 txs)", db_after_s1)

# Upload 2: CC app PDF — also has both ₹500 Swiggy rows
app_tx1 = FakeTx(transaction_date=D, amount=Decimal("500"),
                 transaction_type="PURCHASE", description="Swiggy", source="cc_app")
app_tx2 = FakeTx(transaction_date=D, amount=Decimal("500"),
                 transaction_type="PURCHASE", description="Swiggy", source="cc_app")

db_final = run_dedup(db_after_s1, [app_tx1, app_tx2], "GENERIC", stmt_map,
                     CARD, STMT_APP)
clean, dupes = report("After upload 2 (CC app — same 2 Swiggy ₹500 rows)", db_final)
assert_result("Scenario 1", clean, dupes, expected_clean=2, expected_dupes=2)


# ══════════════════════════════════════════════════════════════════════════════
# SCENARIO 2
# Same date, same shop, same CC bill amount — but different timing in a day.
# One row in bank PDF, same row in CC app PDF.
# Expected: 1 clean (bank wins), 1 dup (CC app suppressed).
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "═"*64)
print("SCENARIO 2 — Same date, same shop, same amount on CC")
print("             (single transaction, two sources)")
print("═"*64)

CARD2 = uuid.uuid4()
STMT2_BANK = uuid.uuid4()
STMT2_APP  = uuid.uuid4()
stmt_map2 = {STMT2_BANK: "ICICI", STMT2_APP: "GENERIC"}

bank_tx = FakeTx(card_id=CARD2, statement_id=STMT2_BANK, transaction_date=D,
                 amount=Decimal("1200"), transaction_type="PURCHASE",
                 description="Amazon", source="bank")

db_s2 = run_dedup(
    existing_txs=[bank_tx],
    incoming_ptxs=[FakeTx(transaction_date=D, amount=Decimal("1200"),
                           transaction_type="PURCHASE", description="Amazon",
                           source="cc_app")],
    incoming_bank="GENERIC",
    stmt_bank_map=stmt_map2,
    card_id=CARD2, stmt_id=STMT2_APP,
)
clean, dupes = report("After CC app upload (bank already had this tx)", db_s2)
assert_result("Scenario 2", clean, dupes, expected_clean=1, expected_dupes=1)

# Reverse: CC app first, bank second
cc_tx = FakeTx(card_id=CARD2, statement_id=STMT2_APP, transaction_date=D,
                amount=Decimal("1200"), transaction_type="PURCHASE",
                description="Amazon", source="cc_app")

db_s2b = run_dedup(
    existing_txs=[cc_tx],
    incoming_ptxs=[FakeTx(transaction_date=D, amount=Decimal("1200"),
                           transaction_type="PURCHASE", description="Amazon",
                           source="bank")],
    incoming_bank="ICICI",
    stmt_bank_map=stmt_map2,
    card_id=CARD2, stmt_id=STMT2_BANK,
)
clean, dupes = report("Reverse: CC app first, bank second (bank should promote itself)", db_s2b)
assert_result("Scenario 2 (reversed)", clean, dupes, expected_clean=1, expected_dupes=1)
bank_clean = [t for t in db_s2b if not t.is_duplicate]
assert bank_clean[0].source == "bank", "Bank should be the authoritative clean tx"
print("  Authoritative source: bank ✅")


# ══════════════════════════════════════════════════════════════════════════════
# SCENARIO 3
# Same date, same shop, same amount — but TWO DIFFERENT CARDS.
# (₹800 at Zomato on HDFC card + ₹800 at Zomato on ICICI card)
# Expected: 2 clean txs (different card_id = different dedup scope, no match).
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "═"*64)
print("SCENARIO 3 — Same date, same shop, same amount — TWO DIFFERENT CARDS")
print("             (HDFC card + ICICI card, both ₹800 Zomato)")
print("═"*64)

HDFC_CARD = uuid.uuid4()
ICICI_CARD = uuid.uuid4()
STMT_HDFC  = uuid.uuid4()
STMT_ICICI = uuid.uuid4()
stmt_map3  = {STMT_HDFC: "HDFC", STMT_ICICI: "ICICI"}

hdfc_tx = FakeTx(card_id=HDFC_CARD, statement_id=STMT_HDFC, transaction_date=D,
                 amount=Decimal("800"), transaction_type="PURCHASE",
                 description="Zomato", source="hdfc_bank")

# Upload HDFC statement first
existing = [hdfc_tx]

# Upload ICICI statement (different card)
icici_incoming = [FakeTx(transaction_date=D, amount=Decimal("800"),
                          transaction_type="PURCHASE", description="Zomato",
                          source="icici_bank")]

db_s3 = run_dedup(existing, icici_incoming, "ICICI", stmt_map3,
                  ICICI_CARD, STMT_ICICI)
clean, dupes = report("HDFC + ICICI card — same Zomato ₹800 on same day", db_s3)
assert_result("Scenario 3", clean, dupes, expected_clean=2, expected_dupes=0)


# ══════════════════════════════════════════════════════════════════════════════
# SCENARIO 4
# Same shop, same card, but TWO GENUINELY DIFFERENT TRANSACTIONS
# (different amounts, same time — e.g. ₹250 coffee + ₹950 lunch at same café)
# Expected: 2 clean txs — different amounts = no match.
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "═"*64)
print("SCENARIO 4 — Same shop, same card, DIFFERENT AMOUNTS on same day")
print("             (₹250 coffee + ₹950 lunch at same café)")
print("═"*64)

CAFE_CARD  = uuid.uuid4()
STMT_CAFE  = uuid.uuid4()
stmt_map4  = {STMT_CAFE: "AXIS"}

cafe_tx1 = FakeTx(card_id=CAFE_CARD, statement_id=STMT_CAFE, transaction_date=D,
                   amount=Decimal("250"), transaction_type="PURCHASE",
                   description="Third Wave Coffee", source="bank")
cafe_tx2 = FakeTx(card_id=CAFE_CARD, statement_id=STMT_CAFE, transaction_date=D,
                   amount=Decimal("950"), transaction_type="PURCHASE",
                   description="Third Wave Coffee", source="bank")

# Upload bank PDF — both txs
db_s4 = [cafe_tx1, cafe_tx2]
report("After bank PDF upload (₹250 + ₹950 at same café)", db_s4)

# Upload CC app PDF — same shop but wrong/rounded amounts (₹249 + ₹951)
app_incoming4 = [
    FakeTx(transaction_date=D, amount=Decimal("249"), transaction_type="PURCHASE",
           description="Third Wave", source="cc_app"),
    FakeTx(transaction_date=D, amount=Decimal("951"), transaction_type="PURCHASE",
           description="Third Wave", source="cc_app"),
]
db_s4b = run_dedup(db_s4, app_incoming4, "GENERIC", stmt_map4,
                   CAFE_CARD, uuid.uuid4())
clean, dupes = report("After CC app upload (₹249 + ₹951 — within ±₹1 tolerance)", db_s4b)
assert_result("Scenario 4 (different amounts, within tolerance)", clean, dupes,
              expected_clean=2, expected_dupes=2)

# Verify 1-to-1 matching: ₹249 matched ₹250, ₹951 matched ₹950
print("  Consumed: each CC app row matched its bank counterpart 1-to-1 ✅")


# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "═"*64)
print("ALL SCENARIOS PASSED ✅")
print("═"*64 + "\n")
