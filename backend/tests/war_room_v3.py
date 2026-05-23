#!/usr/bin/env python3
"""
WAR ROOM V3 — OCD Fintech Product Audit
Phase 2: Static/wiring review
Phase 3: 5-Year Data Simulation (realistic Indian professional persona)
Phase 4: E2E API tests on all modules

Usage:
    python war_room_v3.py [--base-url http://localhost:4000] [--seed-only] [--test-only]
"""

import sys
import random
import argparse
import time
from datetime import datetime, date, timedelta

import requests

# ─── Config ─────────────────────────────────────────────────────────────────
BASE_URL  = "http://nginx"
DEMO_USER = "demo"
DEMO_PASS = "Demo@1234"


def API(path):
    return f"{BASE_URL}/api/v1{path}"


RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"


def hdr(title):
    print(f"\n{BOLD}{CYAN}{'─'*60}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'─'*60}{RESET}")


def ok(msg):   print(f"  {GREEN}✓{RESET} {msg}")
def warn(msg): print(f"  {YELLOW}⚠{RESET}  {msg}")
def fail(msg): print(f"  {RED}✗{RESET} {msg}")
def info(msg): print(f"  {CYAN}→{RESET} {msg}")


PASS = 0
FAIL = 0


def check(label, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        ok(f"{label}" + (f" — {detail}" if detail else ""))
    else:
        FAIL += 1
        fail(f"{label}" + (f" — {detail}" if detail else ""))


# ─── Session ─────────────────────────────────────────────────────────────────
session = requests.Session()
session.headers["Content-Type"] = "application/json"


def login():
    r = session.post(API("/auth/login"), json={"identifier": DEMO_USER, "password": DEMO_PASS})
    if r.status_code != 200:
        fail(f"Login failed ({r.status_code}): {r.text[:200]}")
        return False
    token = r.json()["access_token"]
    session.headers["Authorization"] = f"Bearer {token}"
    ok(f"Logged in as {DEMO_USER}")
    return True


# ─── Date helpers ─────────────────────────────────────────────────────────────
TODAY      = date.today()
FIVE_YEARS = TODAY - timedelta(days=5 * 365)


def iso(d):
    return d.isoformat()


def rand_date(start, end):
    delta = (end - start).days
    if delta <= 0:
        return start
    return start + timedelta(days=random.randint(0, delta))


def months_back(n):
    return TODAY - timedelta(days=30 * n)


# ─── PHASE 2: Static Data Detection ──────────────────────────────────────────

def phase2_static_check():
    hdr("PHASE 2 — Static/Hardcoded Data Detection")

    r = session.get(API("/reports/dashboard"))
    check("Dashboard API returns 200", r.status_code == 200)
    if r.status_code == 200:
        d = r.json()
        keys = list(d.keys())
        info(f"Dashboard keys: {keys[:8]}...")
        check("Dashboard total_outstanding field exists", "total_outstanding" in d)
        check("Dashboard monthly_trends is list", isinstance(d.get("monthly_trends", None), list))
        check("Dashboard upcoming_dues is list", isinstance(d.get("upcoming_dues", None), list))

    r2 = session.get(API("/net-worth/intelligence"))
    check("Net-worth intelligence returns 200", r2.status_code == 200)
    if r2.status_code == 200:
        d2 = r2.json()
        check("NW intelligence has health_score field", "health_score" in d2)
        check("NW intelligence has allocation array", isinstance(d2.get("allocation"), list))
        check("NW intelligence has insights array", isinstance(d2.get("insights"), list))

    analytics = [
        ("/transactions/analytics/category-breakdown", "TX category breakdown"),
        ("/transactions/analytics/monthly-trend", "TX monthly trend"),
        ("/emis/analytics/forecast", "EMI forecast"),
        ("/bank-accounts/analytics/cashflow", "Bank cashflow"),
        ("/investments/analytics/summary", "Investment summary"),
        ("/investments/analytics/intelligence", "Investment intelligence"),
        ("/loans/analytics/summary", "Loans summary"),
        ("/loans/analytics/intelligence", "Loans intelligence"),
        ("/income/analytics/intelligence", "Income intelligence"),
        ("/friends/analytics/intelligence-dashboard", "Friends intelligence"),
        ("/goals/analytics/intelligence", "Goals intelligence"),
        ("/insurance/analytics/intelligence", "Insurance intelligence"),
        ("/assets/analytics/intelligence", "Assets intelligence"),
        ("/net-worth/current", "Net worth current"),
        ("/net-worth/history", "Net worth history"),
    ]
    for path, label in analytics:
        r = session.get(API(path))
        check(f"{label} returns 200", r.status_code == 200, f"status={r.status_code}")


# ─── PHASE 3: 5-Year Data Seeding ─────────────────────────────────────────────

def seed_bank_accounts():
    """Returns {nickname: id}"""
    hdr("PHASE 3a — Bank Accounts")
    accounts = [
        {"bank_name": "HDFC", "account_type": "SAVINGS",
         "nickname": "HDFC Savings", "current_balance": 285000, "is_primary": True},
        {"bank_name": "ICICI", "account_type": "SALARY",
         "nickname": "ICICI Salary", "current_balance": 95000},
        {"bank_name": "SBI",  "account_type": "FD",
         "nickname": "SBI Fixed Dep", "current_balance": 500000},
        {"bank_name": "Axis", "account_type": "SAVINGS",
         "nickname": "Axis Emergency", "current_balance": 180000},
        {"bank_name": "Paytm", "account_type": "WALLET",
         "nickname": "Paytm Wallet", "current_balance": 12500},
    ]
    id_map = {}
    existing = session.get(API("/bank-accounts")).json()
    if not isinstance(existing, list):
        existing = []
    existing_names = {a["nickname"] for a in existing}

    for acc in accounts:
        bal = acc.get("current_balance", 0)
        if acc["nickname"] in existing_names:
            for e in existing:
                if e["nickname"] == acc["nickname"]:
                    acc_id = e["id"]
                    id_map[acc["nickname"]] = acc_id
                    # Update balance to correct seed value
                    session.patch(API(f"/bank-accounts/{acc_id}/balance"),
                                  params={"balance": bal, "notes": "War room balance seed"})
            ok(f"Exists: {acc['nickname']} — balance set to ₹{bal:,}")
            continue
        r = session.post(API("/bank-accounts"), json=acc)
        if r.status_code in (200, 201):
            acc_id = r.json()["id"]
            id_map[acc["nickname"]] = acc_id
            # Explicitly set balance via update endpoint
            session.patch(API(f"/bank-accounts/{acc_id}/balance"),
                          params={"balance": bal, "notes": "Initial balance"})
            ok(f"Created: {acc['nickname']} — ₹{bal:,}")
        else:
            fail(f"Failed {acc['nickname']}: {r.text[:150]}")
    return id_map


def seed_bank_transactions(account_ids):
    hdr("PHASE 3b — Bank Transactions (5 years)")

    hdfc_id  = account_ids.get("HDFC Savings")
    icici_id = account_ids.get("ICICI Salary")
    if not hdfc_id or not icici_id:
        warn("Missing bank account IDs, skipping bank transactions")
        return

    # Check existing count
    r = session.get(API(f"/bank-accounts/{hdfc_id}/transactions"), params={"limit": 1})
    if r.status_code == 200:
        data = r.json()
        existing = data if isinstance(data, list) else data.get("items", [])
        if len(existing) > 100:
            ok("Bank transactions already seeded (100+)")
            return

    info("Seeding 5 years of bank transactions...")
    all_txs = []

    # Salary credits (monthly, ICICI Salary)
    base_salary = 120000
    cur = FIVE_YEARS
    while cur < TODAY:
        salary_day = cur.replace(day=1)
        increment  = (salary_day.year - FIVE_YEARS.year) * 0.08
        salary     = int(base_salary * (1 + increment))
        all_txs.append({
            "account_id":       icici_id,
            "transaction_date": iso(salary_day),
            "amount":           salary,
            "transaction_type": "CREDIT",
            "description":      "Salary Credit - Infosys Ltd",
            "category":         "SALARY",
        })
        cur = (cur.replace(day=1) + timedelta(days=32)).replace(day=1)

    # Monthly expenses (HDFC Savings)
    expense_templates = [
        ("Swiggy Order",       "FOOD",          450,   1200,  8),
        ("Amazon Purchase",    "SHOPPING",       800,   5000,  4),
        ("Uber/Ola Ride",      "TRANSPORT",      150,    600, 12),
        ("Netflix",            "ENTERTAINMENT",  649,    649,  1),
        ("Electricity Bill",   "UTILITIES",     1500,   3500,  1),
        ("Mobile Recharge",    "UTILITIES",      399,    599,  1),
        ("Grocery - DMart",    "FOOD",          3000,   8000,  2),
        ("Petrol",             "TRANSPORT",     2000,   4000,  2),
        ("Restaurant",         "FOOD",           800,   3000,  3),
        ("Medical/Pharma",     "HEALTHCARE",     200,   2000,  1),
        ("Rent Transfer",      "RENT",         25000,  25000,  1),
    ]

    cur = FIVE_YEARS
    while cur < TODAY:
        month_end = (cur.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        month_end = min(month_end, TODAY - timedelta(days=1))

        for desc, cat, mn, mx, freq in expense_templates:
            for _ in range(freq):
                tx_date = rand_date(cur, month_end)
                amt     = random.randint(mn, mx)
                all_txs.append({
                    "account_id":       hdfc_id,
                    "transaction_date": iso(tx_date),
                    "amount":           -amt,
                    "transaction_type": "DEBIT",
                    "description":      desc,
                    "category":         cat,
                })

        # Occasional freelance credit
        if random.random() < 0.3:
            all_txs.append({
                "account_id":       hdfc_id,
                "transaction_date": iso(rand_date(cur, month_end)),
                "amount":           random.randint(15000, 80000),
                "transaction_type": "CREDIT",
                "description":      "Freelance Payment",
                "category":         "SALARY",
            })

        cur = (cur.replace(day=1) + timedelta(days=32)).replace(day=1)

    # Batch import
    info(f"Importing {len(all_txs)} bank transactions...")
    total_ok = 0
    chunk_size = 100
    for i in range(0, len(all_txs), chunk_size):
        chunk = all_txs[i:i + chunk_size]
        hdfc_chunk  = [t for t in chunk if t["account_id"] == hdfc_id]
        icici_chunk = [t for t in chunk if t["account_id"] == icici_id]
        for acc_id, txs in [(hdfc_id, hdfc_chunk), (icici_id, icici_chunk)]:
            if not txs:
                continue
            r = session.post(API(f"/bank-accounts/{acc_id}/transactions/import"), json=txs)
            if r.status_code in (200, 201):
                total_ok += len(txs)
    ok(f"Imported {total_ok} bank transactions")


def seed_income_sources():
    hdr("PHASE 3c — Income Sources")
    sources = [
        {"name": "Infosys - Software Engineer", "income_type": "SALARY",
         "monthly_amount": 145000, "employer": "Infosys Ltd", "is_active": True},
        {"name": "Freelance Consulting", "income_type": "FREELANCE",
         "monthly_amount": 35000, "is_variable": True, "variable_min": 10000, "variable_max": 80000,
         "is_active": True, "notes": "Variable — avg ₹35k/mo"},
        {"name": "Rental Income - HSR Apartment", "income_type": "RENTAL",
         "monthly_amount": 22000, "is_active": True},
        {"name": "Dividend Income", "income_type": "DIVIDEND",
         "monthly_amount": 5000, "is_active": True,
         "notes": "Quarterly dividends, averaged monthly"},
    ]
    ids = []
    existing = session.get(API("/income/sources")).json()
    if not isinstance(existing, list):
        existing = []
    existing_names = {s["name"] for s in existing}

    for src in sources:
        if src["name"] in existing_names:
            for e in existing:
                if e["name"] == src["name"]:
                    ids.append(e["id"])
            ok(f"Exists: {src['name']}")
            continue
        r = session.post(API("/income/sources"), json=src)
        if r.status_code in (200, 201):
            ids.append(r.json()["id"])
            ok(f"Created: {src['name']} — ₹{src['monthly_amount']:,}/mo")
        else:
            fail(f"Failed: {src['name']}: {r.text[:150]}")
    return ids


def seed_income_entries(source_ids):
    hdr("PHASE 3d — Income Entries (5 years)")
    if not source_ids:
        warn("No income sources, skipping entries")
        return

    r = session.get(API("/income/entries"), params={"limit": 1})
    d = r.json()
    existing = d if isinstance(d, list) else d.get("items", [])
    if len(existing) > 50:
        ok("Income entries already seeded")
        return

    entries  = []
    salary_id   = source_ids[0] if len(source_ids) > 0 else None
    freelance_id = source_ids[1] if len(source_ids) > 1 else None
    rental_id    = source_ids[2] if len(source_ids) > 2 else None

    cur          = FIVE_YEARS
    base_salary  = 120000
    while cur < TODAY:
        if salary_id:
            increment = (cur.year - FIVE_YEARS.year) * 0.08
            salary    = int(base_salary * (1 + increment))
            entries.append({
                "source_id":  salary_id,
                "amount":     salary,
                "entry_date": iso(cur.replace(day=1)),
                "notes":      f"Monthly salary {cur.strftime('%b %Y')}",
            })

        if freelance_id and random.random() < 0.65:
            day = rand_date(cur, min(cur + timedelta(days=27), TODAY - timedelta(days=1)))
            entries.append({
                "source_id":  freelance_id,
                "amount":     random.randint(10000, 75000),
                "entry_date": iso(day),
                "notes":      f"Freelance project — {cur.strftime('%b %Y')}",
            })

        if rental_id:
            entries.append({
                "source_id":  rental_id,
                "amount":     22000,
                "entry_date": iso(cur.replace(day=5)),
                "notes":      "Rent received",
            })

        cur = (cur.replace(day=1) + timedelta(days=32)).replace(day=1)

    info(f"Seeding {len(entries)} income entries...")
    ok_count = 0
    for e in entries:
        r = session.post(API("/income/entries"), json=e)
        if r.status_code in (200, 201):
            ok_count += 1
    ok(f"Seeded {ok_count}/{len(entries)} income entries")


def seed_credit_cards():
    hdr("PHASE 3e — Credit Cards")
    cards = [
        {"nickname": "HDFC Regalia", "bank_name": "HDFC", "card_name": "Regalia Gold",
         "last_four": "4821", "credit_limit": 500000, "billing_cycle_day": 15,
         "due_date_day": 5, "interest_rate": 3.5, "card_color": "#003087"},
        {"nickname": "ICICI Amazon", "bank_name": "ICICI", "card_name": "Amazon Pay",
         "last_four": "7293", "credit_limit": 200000, "billing_cycle_day": 20,
         "due_date_day": 10, "interest_rate": 3.4, "card_color": "#FF9900"},
        {"nickname": "Axis Magnus", "bank_name": "Axis", "card_name": "Magnus",
         "last_four": "1547", "credit_limit": 800000, "billing_cycle_day": 1,
         "due_date_day": 18, "interest_rate": 3.6, "card_color": "#800020"},
    ]
    ids = []
    existing_resp = session.get(API("/cards")).json()
    existing = existing_resp if isinstance(existing_resp, list) else existing_resp.get("items", [])
    existing_last4 = {c["last_four"] for c in existing}

    for card in cards:
        if card["last_four"] in existing_last4:
            for e in existing:
                if e["last_four"] == card["last_four"]:
                    ids.append(e["id"])
            ok(f"Exists: {card['bank_name']} {card['card_name']} ...{card['last_four']}")
            continue
        r = session.post(API("/cards"), json=card)
        if r.status_code in (200, 201):
            ids.append(r.json()["id"])
            ok(f"Created: {card['bank_name']} {card['card_name']} — limit ₹{card['credit_limit']:,}")
        else:
            fail(f"Failed: {card['bank_name']} {card['card_name']}: {r.text[:150]}")
    return ids


def seed_cc_transactions(card_ids):
    hdr("PHASE 3f — CC Transactions (5 years)")
    if not card_ids:
        warn("No cards, skipping")
        return

    r = session.get(API("/transactions"), params={"limit": 1})
    data = r.json()
    existing = data if isinstance(data, list) else data.get("items", [])
    if len(existing) > 200:
        ok("CC transactions already seeded")
        return

    CATS = [
        "FOOD_DINING", "SHOPPING", "TRAVEL", "FUEL", "ENTERTAINMENT",
        "UTILITIES", "HEALTHCARE", "GROCERIES", "SUBSCRIPTIONS",
    ]
    merchants = {
        "FOOD_DINING":   ["Swiggy", "Zomato", "Barbeque Nation", "Starbucks"],
        "SHOPPING":      ["Amazon", "Flipkart", "Myntra", "Croma"],
        "TRAVEL":        ["MakeMyTrip", "IRCTC", "Indigo Airlines", "Ola"],
        "FUEL":          ["HP Petrol", "Indian Oil", "BPCL"],
        "ENTERTAINMENT": ["BookMyShow", "PVR", "Netflix", "Spotify"],
        "UTILITIES":     ["BESCOM", "Airtel Broadband", "MSEB"],
        "HEALTHCARE":    ["Apollo Pharmacy", "Practo"],
        "GROCERIES":     ["DMart", "BigBasket", "Reliance Fresh"],
        "SUBSCRIPTIONS": ["Netflix", "Amazon Prime", "Spotify", "LinkedIn"],
    }
    amounts = {
        "FOOD_DINING": (300, 2500), "SHOPPING": (500, 12000), "TRAVEL": (800, 25000),
        "FUEL": (1000, 4000), "ENTERTAINMENT": (200, 3000), "UTILITIES": (500, 3000),
        "HEALTHCARE": (200, 5000), "GROCERIES": (1500, 8000), "SUBSCRIPTIONS": (199, 799),
    }

    txs = []
    cur = FIVE_YEARS
    while cur < TODAY:
        month_end = min(
            (cur.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1),
            TODAY - timedelta(days=1),
        )
        for card_id in card_ids:
            for _ in range(random.randint(12, 20)):
                cat      = random.choice(CATS)
                mn, mx   = amounts[cat]
                merchant = random.choice(merchants[cat])
                tx_date  = rand_date(cur, month_end)
                txs.append({
                    "card_id":          card_id,
                    "transaction_type": "PURCHASE",
                    "transaction_date": f"{iso(tx_date)}T00:00:00Z",
                    "amount":           random.randint(mn, mx),
                    "merchant_name":    merchant,
                    "category":         cat,
                    "description":      f"{merchant} purchase",
                })
            # Monthly payment
            pay_date = month_end - timedelta(days=random.randint(1, 5))
            txs.append({
                "card_id":          card_id,
                "transaction_type": "PAYMENT",
                "transaction_date": f"{iso(pay_date)}T00:00:00Z",
                "amount":           random.randint(20000, 60000),
                "description":      "Online Payment",
                "category":         "PAYMENT",
            })
        cur = (cur.replace(day=1) + timedelta(days=32)).replace(day=1)

    info(f"Seeding {len(txs)} CC transactions...")
    ok_count = 0
    for tx in txs:
        r = session.post(API("/transactions"), json=tx)
        if r.status_code in (200, 201):
            ok_count += 1
    ok(f"Seeded {ok_count}/{len(txs)} CC transactions")


def seed_emis(card_ids):
    hdr("PHASE 3g — EMIs")
    emis = [
        {"product_name": "iPhone 15 Pro", "merchant_name": "Apple Store",
         "purchase_date": f"{iso(months_back(8))}T00:00:00Z",
         "purchase_amount": 134900, "total_amount": 140000, "monthly_emi": 11667,
         "tenure_months": 12, "interest_rate": 0.0, "is_no_cost_emi": False,
         "card_id": card_ids[0] if card_ids else None, "owner_type": "SELF"},
        {"product_name": "MacBook Pro 14", "merchant_name": "Apple Store",
         "purchase_date": f"{iso(months_back(5))}T00:00:00Z",
         "purchase_amount": 189000, "total_amount": 205000, "monthly_emi": 17083,
         "tenure_months": 12, "interest_rate": 14.5,
         "card_id": card_ids[1] if len(card_ids) > 1 else None, "owner_type": "SELF"},
        {"product_name": "LG OLED TV", "merchant_name": "Croma",
         "purchase_date": f"{iso(months_back(3))}T00:00:00Z",
         "purchase_amount": 89990, "total_amount": 89990, "monthly_emi": 7499,
         "tenure_months": 12, "interest_rate": 0.0, "is_no_cost_emi": True,
         "card_id": card_ids[0] if card_ids else None, "owner_type": "SELF"},
        {"product_name": "Europe Trip 2024", "merchant_name": "MakeMyTrip",
         "purchase_date": f"{iso(months_back(6))}T00:00:00Z",
         "purchase_amount": 350000, "total_amount": 390000, "monthly_emi": 32500,
         "tenure_months": 12, "interest_rate": 15.0,
         "card_id": card_ids[1] if len(card_ids) > 1 else None, "owner_type": "SELF"},
        {"product_name": "Home Renovation", "merchant_name": "Interior Co",
         "purchase_date": f"{iso(months_back(24))}T00:00:00Z",
         "purchase_amount": 800000, "total_amount": 900000, "monthly_emi": 18500,
         "tenure_months": 60, "interest_rate": 10.5,
         "card_id": None, "owner_type": "SELF"},
    ]
    ids = []
    r = session.get(API("/emis"))
    existing_resp = r.json()
    existing = existing_resp if isinstance(existing_resp, list) else existing_resp.get("items", [])
    existing_names = {e["product_name"] for e in existing}

    for emi in emis:
        if emi["product_name"] in existing_names:
            for e in existing:
                if e["product_name"] == emi["product_name"]:
                    ids.append(e["id"])
            ok(f"Exists: {emi['product_name']}")
            continue
        payload = {k: v for k, v in emi.items() if v is not None}
        r = session.post(API("/emis"), json=payload)
        if r.status_code in (200, 201):
            ids.append(r.json()["id"])
            ok(f"Created: {emi['product_name']} — ₹{emi['monthly_emi']:,}/mo")
        else:
            fail(f"Failed: {emi['product_name']}: {r.text[:200]}")
    return ids


def seed_loans():
    hdr("PHASE 3h — Loans")
    loans = [
        {"loan_type": "HOME", "lender_name": "HDFC Bank",
         "nickname": "Home Loan - Whitefield",
         "principal_amount": 8500000, "outstanding_balance": 6230000,
         "interest_rate": 8.65, "emi_amount": 78500, "tenure_months": 240,
         "remaining_months": 204, "start_date": iso(months_back(36)),
         "emi_due_day": 5, "is_secured": True, "collateral": "2BHK Whitefield Bangalore"},
        {"loan_type": "VEHICLE", "lender_name": "Axis Bank",
         "nickname": "Car Loan - Honda City",
         "principal_amount": 1100000, "outstanding_balance": 680000,
         "interest_rate": 8.9, "emi_amount": 22800, "tenure_months": 60,
         "remaining_months": 42, "start_date": iso(months_back(18)),
         "emi_due_day": 10, "is_secured": True, "collateral": "Honda City ZX 2022"},
        {"loan_type": "PERSONAL", "lender_name": "ICICI Bank",
         "nickname": "Personal Loan - Emergency",
         "principal_amount": 300000, "outstanding_balance": 120000,
         "interest_rate": 13.5, "emi_amount": 8900, "tenure_months": 36,
         "remaining_months": 15, "start_date": iso(months_back(21)),
         "emi_due_day": 15},
    ]
    ids = []
    existing = session.get(API("/loans")).json()
    if not isinstance(existing, list):
        existing = []
    existing_nicks = {l.get("nickname", "") for l in existing}

    for loan in loans:
        if loan["nickname"] in existing_nicks:
            for e in existing:
                if e.get("nickname") == loan["nickname"]:
                    ids.append(e["id"])
            ok(f"Exists: {loan['nickname']}")
            continue
        r = session.post(API("/loans"), json=loan)
        if r.status_code in (200, 201):
            ids.append(r.json()["id"])
            ok(f"Created: {loan['nickname']} — ₹{loan['outstanding_balance']:,} @ {loan['interest_rate']}%")
        else:
            fail(f"Failed: {loan['nickname']}: {r.text[:150]}")
    return ids


def seed_investments():
    hdr("PHASE 3i — Investments")
    investments = [
        {"investment_type": "MUTUAL_FUND", "name": "Axis Bluechip Fund Direct Growth",
         "invested_amount": 850000, "units": 32450, "avg_buy_price": 26.19,
         "current_price": 38.21, "is_sip": True, "sip_amount": 15000,
         "purchase_date": iso(months_back(48)), "broker": "Zerodha",
         "notes": "Monthly SIP ₹15k since Jan 2021"},
        {"investment_type": "MUTUAL_FUND", "name": "Parag Parikh Flexi Cap Direct",
         "invested_amount": 420000, "units": 11200, "avg_buy_price": 37.5,
         "current_price": 56.07, "is_sip": True, "sip_amount": 10000,
         "purchase_date": iso(months_back(36)), "broker": "Zerodha"},
        {"investment_type": "MUTUAL_FUND", "name": "Mirae Asset Emerging Bluechip",
         "invested_amount": 300000, "units": 8750, "avg_buy_price": 34.28,
         "current_price": 50.28, "purchase_date": iso(months_back(30))},
        {"investment_type": "STOCKS", "name": "Infosys Ltd (INFY)",
         "invested_amount": 180000, "units": 120, "avg_buy_price": 1500,
         "current_price": 2208, "purchase_date": iso(months_back(24)),
         "broker": "Zerodha", "notes": "ESOP + open market"},
        {"investment_type": "STOCKS", "name": "HDFC Bank (HDFCBANK)",
         "invested_amount": 95000, "units": 80, "avg_buy_price": 1187,
         "current_price": 1475, "purchase_date": iso(months_back(20)), "broker": "Zerodha"},
        {"investment_type": "STOCKS", "name": "Tata Motors (TATAMOTORS)",
         "invested_amount": 75000, "units": 350, "avg_buy_price": 214,
         "current_price": 406, "purchase_date": iso(months_back(18)), "broker": "Zerodha"},
        {"investment_type": "PPF", "name": "PPF - SBI Branch",
         "invested_amount": 700000, "units": 1, "avg_buy_price": 700000,
         "current_price": 920000, "purchase_date": iso(months_back(60)),
         "notes": "₹1.5L deposited annually, matures in 5 years"},
        {"investment_type": "GOLD", "name": "Sovereign Gold Bonds 2022-23",
         "invested_amount": 220000, "units": 40, "weight_grams": 40,
         "avg_buy_price": 5500, "current_price": 7375,
         "purchase_date": iso(months_back(24)),
         "notes": "RBI SGB 2022-23 Series III, 2.5% interest"},
        {"investment_type": "CRYPTO", "name": "Bitcoin (BTC)",
         "invested_amount": 80000, "units": 0.00185, "avg_buy_price": 43243243,
         "current_price": 51351351, "purchase_date": iso(months_back(12)),
         "broker": "CoinDCX"},
        {"investment_type": "NPS", "name": "NPS Tier I - HDFC Pension",
         "invested_amount": 450000, "units": 1, "avg_buy_price": 450000,
         "current_price": 580000, "purchase_date": iso(months_back(48)),
         "notes": "₹50k employer + ₹50k self annually"},
    ]
    ids = []
    existing = session.get(API("/investments")).json()
    if not isinstance(existing, list):
        existing = []
    existing_names = {i["name"] for i in existing}

    for inv in investments:
        if inv["name"] in existing_names:
            for e in existing:
                if e["name"] == inv["name"]:
                    ids.append(e["id"])
            ok(f"Exists: {inv['name']}")
            continue
        r = session.post(API("/investments"), json=inv)
        if r.status_code in (200, 201):
            ids.append(r.json()["id"])
            pnl = (inv["current_price"] - inv["avg_buy_price"]) * inv["units"]
            ok(f"Created: {inv['name']} — PnL: {'+' if pnl >= 0 else ''}₹{pnl:,.0f}")
        else:
            fail(f"Failed: {inv['name']}: {r.text[:150]}")
    return ids


def seed_assets():
    hdr("PHASE 3j — Assets")
    assets = [
        {"asset_type": "REAL_ESTATE", "name": "2BHK Apartment - Whitefield Bangalore",
         "purchase_price": 8500000, "current_value": 12500000,
         "purchase_date": iso(months_back(36)),
         "location": "Whitefield, Bangalore", "area_sqft": 1245,
         "notes": "Fully furnished, tenant paying ₹22k/mo rent"},
        {"asset_type": "VEHICLE", "name": "Honda City ZX 2022",
         "purchase_price": 1450000, "current_value": 1050000,
         "purchase_date": iso(months_back(18)),
         "make_model": "Honda City ZX CVT 2022", "registration_number": "KA01AB1234",
         "year_of_manufacture": 2022, "is_insured": True},
        {"asset_type": "GOLD", "name": "Physical Gold Jewelry",
         "purchase_price": 280000, "current_value": 420000,
         "purchase_date": iso(months_back(60)),
         "notes": "Approx 50 grams — family jewelry"},
        {"asset_type": "ELECTRONICS", "name": "Apple Devices (MacBook + iPhone + iPad)",
         "purchase_price": 380000, "current_value": 180000,
         "purchase_date": iso(months_back(6))},
    ]
    ids = []
    existing = session.get(API("/assets")).json()
    if not isinstance(existing, list):
        existing = []
    existing_names = {a["name"] for a in existing}

    for asset in assets:
        if asset["name"] in existing_names:
            for e in existing:
                if e["name"] == asset["name"]:
                    ids.append(e["id"])
            ok(f"Exists: {asset['name']}")
            continue
        r = session.post(API("/assets"), json=asset)
        if r.status_code in (200, 201):
            ids.append(r.json()["id"])
            gain = asset["current_value"] - (asset.get("purchase_price") or asset["current_value"])
            ok(f"Created: {asset['name']} — ₹{asset['current_value']:,} ({'+' if gain >= 0 else ''}₹{gain:,})")
        else:
            fail(f"Failed: {asset['name']}: {r.text[:150]}")
    return ids


def seed_insurance():
    hdr("PHASE 3k — Insurance")
    policies = [
        {"insurance_type": "HEALTH", "policy_name": "Star Comprehensive Family",
         "insurer": "Star Health Insurance", "policy_number": "P/211221/01/2021/012345",
         "sum_assured": 1000000, "premium_amount": 32500, "premium_frequency": "YEARLY",
         "start_date": iso(months_back(24)), "end_date": iso(TODAY + timedelta(days=365)),
         "is_active": True, "notes": "Family floater — self + spouse + 1 kid"},
        {"insurance_type": "TERM", "policy_name": "HDFC Life Click 2 Protect Super",
         "insurer": "HDFC Life Insurance", "policy_number": "HLI-2021-456789",
         "sum_assured": 20000000, "premium_amount": 28750, "premium_frequency": "YEARLY",
         "start_date": iso(months_back(48)), "end_date": iso(TODAY + timedelta(days=365 * 27)),
         "is_active": True, "notes": "2 Cr term cover till age 65"},
        {"insurance_type": "VEHICLE", "policy_name": "Bajaj Allianz Motor Comprehensive",
         "insurer": "Bajaj Allianz General Insurance", "policy_number": "OG-2022-V-98765",
         "sum_assured": 1050000, "premium_amount": 18500, "premium_frequency": "YEARLY",
         "start_date": iso(months_back(6)), "end_date": iso(TODAY + timedelta(days=180)),
         "is_active": True, "notes": "Honda City IDV ₹10.5L + zero dep rider"},
        {"insurance_type": "HEALTH", "policy_name": "Niva Bupa Super Top-Up 45L",
         "insurer": "Niva Bupa Health Insurance", "policy_number": "NIVA-STU-11111",
         "cover_amount": 4500000, "premium_amount": 15800, "premium_frequency": "YEARLY",
         "start_date": iso(months_back(12)), "end_date": iso(TODAY + timedelta(days=365)),
         "is_active": True, "notes": "Super top-up above ₹10L base deductible"},
    ]
    ids = []
    existing = session.get(API("/insurance")).json()
    if not isinstance(existing, list):
        existing = []
    existing_names = {p["policy_name"] for p in existing}

    for pol in policies:
        if pol["policy_name"] in existing_names:
            for e in existing:
                if e["policy_name"] == pol["policy_name"]:
                    ids.append(e["id"])
            ok(f"Exists: {pol['policy_name']}")
            continue
        r = session.post(API("/insurance"), json=pol)
        if r.status_code in (200, 201):
            ids.append(r.json()["id"])
            cover = pol.get("sum_assured") or pol.get("cover_amount", 0)
            ok(f"Created: {pol['policy_name']} — ₹{cover:,} cover @ ₹{pol['premium_amount']:,}/yr")
        else:
            fail(f"Failed: {pol['policy_name']}: {r.text[:150]}")
    return ids


def seed_goals():
    hdr("PHASE 3l — Goals")
    goals = [
        {"name": "Emergency Fund", "goal_type": "EMERGENCY_FUND",
         "target_amount": 600000, "current_amount": 180000,
         "monthly_contribution": 15000,
         "target_date": iso(TODAY + timedelta(days=365 * 2)),
         "priority": "HIGH", "icon_color": "#0EA5E9",
         "notes": "6 months of expenses = ₹6L"},
        {"name": "Europe Vacation 2026", "goal_type": "VACATION",
         "target_amount": 350000, "current_amount": 85000,
         "monthly_contribution": 20000,
         "target_date": iso(TODAY + timedelta(days=365)),
         "priority": "MEDIUM", "icon_color": "#F97316"},
        {"name": "Second Property Down Payment", "goal_type": "REAL_ESTATE",
         "target_amount": 2500000, "current_amount": 620000,
         "monthly_contribution": 40000,
         "target_date": iso(TODAY + timedelta(days=365 * 3)),
         "priority": "HIGH", "icon_color": "#10B981",
         "notes": "20% down payment on ₹1.25Cr flat"},
        {"name": "Retirement Corpus", "goal_type": "RETIREMENT",
         "target_amount": 50000000, "current_amount": 3765000,
         "monthly_contribution": 30000,
         "target_date": iso(TODAY + timedelta(days=365 * 25)),
         "priority": "HIGH", "icon_color": "#7C3AED"},
        {"name": "Kids Education Fund", "goal_type": "EDUCATION",
         "target_amount": 5000000, "current_amount": 150000,
         "monthly_contribution": 10000,
         "target_date": iso(TODAY + timedelta(days=365 * 15)),
         "priority": "MEDIUM", "icon_color": "#EC4899"},
        {"name": "MacBook Pro Upgrade", "goal_type": "PURCHASE",
         "target_amount": 250000, "current_amount": 0,
         "monthly_contribution": 25000,
         "target_date": iso(TODAY + timedelta(days=180)),
         "priority": "LOW", "icon_color": "#F59E0B"},
    ]
    ids = []
    existing = session.get(API("/goals")).json()
    if not isinstance(existing, list):
        existing = []
    existing_names = {g["name"] for g in existing}

    for goal in goals:
        if goal["name"] in existing_names:
            for e in existing:
                if e["name"] == goal["name"]:
                    ids.append(e["id"])
            ok(f"Exists: {goal['name']}")
            continue
        r = session.post(API("/goals"), json=goal)
        if r.status_code in (200, 201):
            ids.append(r.json()["id"])
            pct = goal["current_amount"] / goal["target_amount"] * 100
            ok(f"Created: {goal['name']} — {pct:.0f}% of ₹{goal['target_amount']:,}")
        else:
            fail(f"Failed: {goal['name']}: {r.text[:150]}")
    return ids


def seed_friends():
    hdr("PHASE 3m — Friends")
    friends = [
        {"name": "Rohan Mehta", "phone": "+91 98765 43210",
         "email": "rohan@gmail.com", "relationship": "friend"},
        {"name": "Priya Sharma", "phone": "+91 87654 32109",
         "email": "priya@outlook.com", "relationship": "friend"},
        {"name": "Vikram Singh", "phone": "+91 76543 21098",
         "relationship": "family"},
        {"name": "Ananya Krishnan", "phone": "+91 65432 10987",
         "relationship": "colleague"},
    ]
    ids = []
    existing = session.get(API("/friends")).json()
    if not isinstance(existing, list):
        existing = []
    existing_names = {f["name"] for f in existing}

    for fr in friends:
        if fr["name"] in existing_names:
            for e in existing:
                if e["name"] == fr["name"]:
                    ids.append(e["id"])
            ok(f"Exists: {fr['name']}")
            continue
        r = session.post(API("/friends"), json=fr)
        if r.status_code in (200, 201):
            ids.append(r.json()["id"])
            ok(f"Created: {fr['name']} ({fr['relationship']})")
        else:
            fail(f"Failed: {fr['name']}: {r.text[:100]}")
    return ids


def seed_friend_emis(friend_ids, card_ids):
    hdr("PHASE 3n — Friend EMIs (receivables)")
    if not friend_ids:
        warn("No friends, skipping")
        return
    if not card_ids:
        warn("No cards for friend EMIs, skipping")
        return

    friend_emis = [
        {"product_name": "iPhone 15 Pro Split", "merchant_name": "Apple Store",
         "purchase_date": f"{iso(months_back(8))}T00:00:00Z",
         "purchase_amount": 67450, "total_amount": 67450, "monthly_emi": 5621,
         "tenure_months": 12, "interest_rate": 0.0, "is_no_cost_emi": True,
         "friend_id": friend_ids[0], "owner_type": "FRIEND",
         "user_share_percent": 50, "card_id": card_ids[0]},
        {"product_name": "Europe Trip Share - Priya", "merchant_name": "MakeMyTrip",
         "purchase_date": f"{iso(months_back(6))}T00:00:00Z",
         "purchase_amount": 87500, "total_amount": 95000, "monthly_emi": 7917,
         "tenure_months": 12, "interest_rate": 15.0,
         "friend_id": friend_ids[1] if len(friend_ids) > 1 else friend_ids[0],
         "owner_type": "FRIEND", "user_share_percent": 50, "card_id": card_ids[1] if len(card_ids) > 1 else card_ids[0]},
    ]

    r = session.get(API("/emis"))
    existing_resp = r.json()
    existing = existing_resp if isinstance(existing_resp, list) else existing_resp.get("items", [])
    existing_names = {e["product_name"] for e in existing}

    for fe in friend_emis:
        if fe["product_name"] in existing_names:
            ok(f"Exists: {fe['product_name']}")
            continue
        payload = {k: v for k, v in fe.items() if v is not None}
        r = session.post(API("/emis"), json=payload)
        if r.status_code in (200, 201):
            ok(f"Created friend EMI: {fe['product_name']} — ₹{fe['monthly_emi']:,}/mo")
        else:
            fail(f"Failed: {fe['product_name']}: {r.text[:200]}")


def seed_net_worth_snapshot():
    hdr("PHASE 3o — Net Worth Snapshot")
    info("Taking snapshot...")
    r = session.post(API("/net-worth/snapshot"))
    if r.status_code in (200, 201):
        d = r.json()
        ok(f"Snapshot: NW=₹{d.get('net_worth', 'N/A'):,} | Health={d.get('health_score', 'N/A')}/100")
    else:
        warn(f"Snapshot failed: {r.text[:100]}")


# ─── PHASE 4: E2E Tests ────────────────────────────────────────────────────────

def phase4_e2e_tests():
    hdr("PHASE 4 — End-to-End API Tests")

    # ── Dashboard ────────────────────────────────────────────────────────────
    info("Testing Dashboard...")
    r = session.get(API("/reports/dashboard"))
    check("Dashboard 200", r.status_code == 200)
    if r.status_code == 200:
        d = r.json()
        check("Dashboard monthly_trends non-empty", len(d.get("monthly_trends", [])) > 0,
              f"count={len(d.get('monthly_trends', []))}")
        check("Dashboard upcoming_dues is list", isinstance(d.get("upcoming_dues"), list))
        check("Dashboard emi_summary present", "emi_summary" in d)

    # ── Net Worth ────────────────────────────────────────────────────────────
    info("Testing Net Worth...")
    r = session.get(API("/net-worth/current"))
    check("Net Worth current 200", r.status_code == 200)
    if r.status_code == 200:
        d = r.json()
        check("NW > 0", d.get("net_worth", 0) > 0, f"NW=₹{d.get('net_worth', 0):,.0f}")
        check("NW has profile_completeness", "profile_completeness" in d)
        score = d.get("profile_completeness", {}).get("score", 0)
        check("Profile completeness > 70 (after seeding)", score > 70, f"score={score}")

    r2 = session.get(API("/net-worth/intelligence"))
    check("NW intelligence 200", r2.status_code == 200)
    if r2.status_code == 200:
        d = r2.json()
        check("NW health_score 0-100", 0 <= d.get("health_score", -1) <= 100)
        check("NW allocation non-empty", len(d.get("allocation", [])) > 0)
        check("NW insights non-empty", len(d.get("insights", [])) > 0)
        check("NW emergency_months > 0", d.get("emergency_months", 0) > 0)
        info(f"  NW: ₹{d.get('net_worth', 0):,.0f} | Health: {d.get('health_score')}/100 | Emergency: {d.get('emergency_months', 0):.1f}mo")

    r3 = session.get(API("/net-worth/history"), params={"months": 12})
    check("NW history 200", r3.status_code == 200)
    history = r3.json()
    check("NW history has data", len(history) > 0, f"count={len(history)}")

    # ── Banking ──────────────────────────────────────────────────────────────
    info("Testing Banking...")
    r = session.get(API("/bank-accounts"))
    check("Bank accounts 200", r.status_code == 200)
    accounts = r.json() if isinstance(r.json(), list) else []
    check("Bank accounts >= 4", len(accounts) >= 4, f"count={len(accounts)}")

    r = session.get(API("/bank-accounts/analytics/cashflow"))
    check("Bank cashflow 200", r.status_code == 200)
    if r.status_code == 200:
        d = r.json()
        check("Cashflow total_balance > 0", d.get("total_balance", 0) > 0,
              f"balance=₹{d.get('total_balance', 0):,.0f}")

    # ── Credit Cards ─────────────────────────────────────────────────────────
    info("Testing Credit Cards...")
    r = session.get(API("/cards"))
    cards_data = r.json()
    cards = cards_data if isinstance(cards_data, list) else cards_data.get("items", [])
    check("Cards >= 3", len(cards) >= 3, f"count={len(cards)}")
    for c in cards[:2]:
        r2 = session.get(API(f"/cards/{c['id']}/utilization"))
        check(f"Card utilization ({c['bank_name']})", r2.status_code == 200)

    # ── Transactions ─────────────────────────────────────────────────────────
    info("Testing Transactions...")
    r = session.get(API("/transactions"), params={"limit": 50})
    txs_data = r.json()
    txs = txs_data if isinstance(txs_data, list) else txs_data.get("items", [])
    check("Transactions >= 50", len(txs) >= 50, f"count={len(txs)}")

    r = session.get(API("/transactions/analytics/category-breakdown"))
    check("TX category breakdown 200", r.status_code == 200)
    if r.status_code == 200:
        d = r.json()
        cats = d if isinstance(d, list) else d.get("categories", [])
        check("Category breakdown non-empty", len(cats) > 0)

    r = session.get(API("/transactions/analytics/monthly-trend"))
    check("TX monthly trend 200", r.status_code == 200)

    # ── EMIs ─────────────────────────────────────────────────────────────────
    info("Testing EMIs...")
    r = session.get(API("/emis"))
    emis_data = r.json()
    emis = emis_data if isinstance(emis_data, list) else emis_data.get("items", [])
    check("EMIs >= 4", len(emis) >= 4, f"count={len(emis)}")

    r = session.get(API("/emis/analytics/forecast"), params={"months_ahead": 6})
    check("EMI forecast 200", r.status_code == 200)
    if r.status_code == 200:
        f = r.json()
        check("EMI forecast non-empty", len(f) > 0)

    # ── Loans ─────────────────────────────────────────────────────────────────
    info("Testing Loans...")
    r = session.get(API("/loans"))
    loans = r.json() if isinstance(r.json(), list) else []
    check("Loans >= 2", len(loans) >= 2, f"count={len(loans)}")

    r = session.get(API("/loans/analytics/summary"))
    check("Loans summary 200", r.status_code == 200)
    if r.status_code == 200:
        d = r.json()
        check("Loans DTI calculated", "dti_pct" in d)
        check("Loans total_outstanding > 0", d.get("total_outstanding", 0) > 0)
        info(f"  DTI: {d.get('dti_pct')}% ({d.get('dti_status')}) | Outstanding: ₹{d.get('total_outstanding', 0):,.0f}")

    r = session.get(API("/loans/analytics/intelligence"))
    check("Loans intelligence 200", r.status_code == 200)

    # ── Investments ───────────────────────────────────────────────────────────
    info("Testing Investments...")
    r = session.get(API("/investments"))
    invs = r.json() if isinstance(r.json(), list) else []
    check("Investments >= 8", len(invs) >= 8, f"count={len(invs)}")

    r = session.get(API("/investments/analytics/summary"))
    check("Investment summary 200", r.status_code == 200)
    if r.status_code == 200:
        d = r.json()
        check("Investment total_invested > 0", d.get("total_invested", 0) > 0)
        check("Investment total_value > 0", d.get("total_current_value", d.get("total_value", 0)) > 0)
        check("Investment overall_pnl present", "total_pnl" in d or "overall_pnl" in d)
        val = d.get("total_current_value", d.get("total_value", 0))
        info(f"  Invested: ₹{d.get('total_invested', 0):,.0f} | Value: ₹{val:,.0f}")

    r = session.get(API("/investments/analytics/intelligence"))
    check("Investment intelligence 200", r.status_code == 200)
    if r.status_code == 200:
        d = r.json()
        check("Investment intelligence has insights", len(d.get("insights", [])) > 0)

    # ── Assets ────────────────────────────────────────────────────────────────
    info("Testing Assets...")
    r = session.get(API("/assets"))
    assets = r.json() if isinstance(r.json(), list) else []
    check("Assets >= 3", len(assets) >= 3, f"count={len(assets)}")

    r = session.get(API("/assets/analytics/intelligence"))
    check("Assets intelligence 200", r.status_code == 200)
    if r.status_code == 200:
        d = r.json()
        check("Assets total_value > 0", d.get("total_value", 0) > 0)
        info(f"  Assets: ₹{d.get('total_value', 0):,.0f} | Appreciation: ₹{d.get('total_appreciation', 0):,.0f}")

    # ── Income ────────────────────────────────────────────────────────────────
    info("Testing Income...")
    r = session.get(API("/income/sources"))
    sources = r.json() if isinstance(r.json(), list) else []
    check("Income sources >= 3", len(sources) >= 3, f"count={len(sources)}")

    r = session.get(API("/income/analytics/intelligence"))
    check("Income intelligence 200", r.status_code == 200)
    if r.status_code == 200:
        d = r.json()
        check("Income total_monthly_net > 0", d.get("total_monthly_net", 0) > 0,
              f"₹{d.get('total_monthly_net', 0):,.0f}")
        info(f"  Monthly net: ₹{d.get('total_monthly_net', 0):,.0f} | Sources: {d.get('source_count', 0)}")

    # ── Insurance ─────────────────────────────────────────────────────────────
    info("Testing Insurance...")
    r = session.get(API("/insurance"))
    policies = r.json() if isinstance(r.json(), list) else []
    check("Insurance >= 3 policies", len(policies) >= 3, f"count={len(policies)}")

    r = session.get(API("/insurance/analytics/intelligence"))
    check("Insurance intelligence 200", r.status_code == 200)
    if r.status_code == 200:
        d = r.json()
        check("Has health cover", d.get("has_health_cover", False))
        check("Has term cover", d.get("has_term_cover", False))
        info(f"  Health: ₹{d.get('total_health_cover', 0):,} | Term: ₹{d.get('term_cover', 0):,}")

    # ── Goals ─────────────────────────────────────────────────────────────────
    info("Testing Goals...")
    r = session.get(API("/goals"))
    goals = r.json() if isinstance(r.json(), list) else []
    check("Goals >= 4", len(goals) >= 4, f"count={len(goals)}")

    r = session.get(API("/goals/analytics/intelligence"))
    check("Goals intelligence 200", r.status_code == 200)
    if r.status_code == 200:
        d = r.json()
        check("Goals active_count > 0", d.get("active_count", 0) > 0)
        info(f"  Active goals: {d.get('active_count')} | Avg progress: {d.get('overall_pct', 0):.1f}%")

    # ── Friends ───────────────────────────────────────────────────────────────
    info("Testing Friends...")
    r = session.get(API("/friends"))
    friends = r.json() if isinstance(r.json(), list) else []
    check("Friends >= 3", len(friends) >= 3, f"count={len(friends)}")

    r = session.get(API("/friends/analytics/intelligence-dashboard"))
    check("Friends intelligence 200", r.status_code == 200)

    # ── AI CFO ────────────────────────────────────────────────────────────────
    info("Testing AI CFO...")
    r = session.post(API("/ai-cfo/chat"), json={"message": "What is my net worth and debt-to-income ratio?"})
    check("AI CFO chat 200", r.status_code == 200)
    if r.status_code == 200:
        d = r.json()
        reply = str(d.get("reply") or d.get("response") or d.get("message") or "")
        check("AI CFO response non-empty", len(reply) > 10)

    r = session.get(API("/ai-cfo/history"))
    check("AI CFO history 200", r.status_code == 200)

    # ── Insights ──────────────────────────────────────────────────────────────
    info("Testing Insights...")
    r = session.post(API("/insights/generate"))
    check("Generate insights 200/201", r.status_code in (200, 201))

    r = session.get(API("/insights"))
    check("Insights list 200", r.status_code == 200)

    # ── Notifications ─────────────────────────────────────────────────────────
    r = session.get(API("/notifications"))
    check("Notifications 200", r.status_code == 200)

    # ── Reports ───────────────────────────────────────────────────────────────
    r = session.get(API("/reports/spending"))
    check("Reports spending 200", r.status_code == 200)


# ─── PHASE 5: Financial Snapshot ──────────────────────────────────────────────

def phase5_snapshot():
    hdr("PHASE 5 — Financial Snapshot & Advisory")

    nw        = session.get(API("/net-worth/current")).json()
    nw_intel  = session.get(API("/net-worth/intelligence")).json()
    income    = session.get(API("/income/analytics/intelligence")).json()
    loans_s   = session.get(API("/loans/analytics/summary")).json()
    inv_s     = session.get(API("/investments/analytics/summary")).json()
    goals_i   = session.get(API("/goals/analytics/intelligence")).json()
    ins_i     = session.get(API("/insurance/analytics/intelligence")).json()

    print(f"\n  {BOLD}📊 FINANCIAL SNAPSHOT{RESET}")
    print(f"  Net Worth:         ₹{nw.get('net_worth', 0):>16,.0f}")
    print(f"  Total Assets:      ₹{nw.get('total_assets', 0):>16,.0f}")
    print(f"  Total Liabilities: ₹{nw.get('total_liabilities', 0):>16,.0f}")
    print(f"  Monthly Income:    ₹{income.get('total_monthly_net', 0):>16,.0f}")
    print(f"  DTI Ratio:          {str(loans_s.get('dti_pct', 'N/A')):>15}%")
    print(f"  Health Score:       {str(nw_intel.get('health_score', 'N/A')):>15}/100")
    print(f"  Emergency Fund:     {nw_intel.get('emergency_months', 0):>15.1f} months")
    print(f"  Invested:          ₹{inv_s.get('total_invested', 0):>16,.0f}")
    print(f"  Portfolio Value:   ₹{inv_s.get('total_value', 0):>16,.0f}")
    pnl = inv_s.get('overall_pnl', 0)
    pnl_pct = inv_s.get('overall_pnl_pct', 0)
    print(f"  PnL:               ₹{pnl:>+16,.0f} ({pnl_pct:.1f}%)")
    print(f"  Active Goals:       {goals_i.get('active_count', 0):>15}")
    print(f"  Health Cover:      ₹{ins_i.get('total_health_cover', 0):>16,}")
    print(f"  Term Cover:        ₹{ins_i.get('term_cover', 0):>16,}")

    print(f"\n  {BOLD}🎯 ADVISORY CHECKS{RESET}")
    em = nw_intel.get("emergency_months", 0)
    dti = loans_s.get("dti_pct")
    hs = nw_intel.get("health_score", 0)
    annual_income = income.get("total_monthly_net", 0) * 12
    term_cover = ins_i.get("term_cover", 0)

    if em < 3:
        fail(f"Emergency fund only {em:.1f}mo — target: 6+ months")
    elif em < 6:
        warn(f"Emergency fund {em:.1f}mo — build to 6+ months")
    else:
        ok(f"Emergency fund {em:.1f}mo — excellent coverage")

    if dti is not None:
        if float(dti) > 50:
            fail(f"DTI {dti}% is dangerously high — avoid new loans")
        elif float(dti) > 35:
            warn(f"DTI {dti}% approaching limit (35%)")
        else:
            ok(f"DTI {dti}% is healthy (< 35%)")

    if hs < 40:
        fail(f"Health score {hs}/100 — needs immediate attention")
    elif hs < 60:
        warn(f"Health score {hs}/100 — room for improvement")
    else:
        ok(f"Health score {hs}/100 — good shape")

    if annual_income > 0 and term_cover > 0:
        ratio = term_cover / annual_income
        if ratio < 10:
            warn(f"Term cover {ratio:.1f}x income — recommend 15-20x")
        else:
            ok(f"Term cover {ratio:.1f}x income — adequate")

    if pnl_pct < 0:
        warn(f"Portfolio in loss — {pnl_pct:.1f}%")
    elif pnl_pct > 15:
        ok(f"Portfolio up {pnl_pct:.1f}% — strong performance")

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    global BASE_URL
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=BASE_URL)
    parser.add_argument("--seed-only", action="store_true")
    parser.add_argument("--test-only", action="store_true")
    args = parser.parse_args()
    BASE_URL = args.base_url

    print(f"\n{BOLD}{'═'*60}")
    print(f"  WAR ROOM V3 — OCD FINTECH PRODUCT AUDIT")
    print(f"  Persona: Indian Software Engineer, Bangalore")
    print(f"  Target: {BASE_URL}")
    print(f"{'═'*60}{RESET}")

    start = time.time()

    if not login():
        print(f"\n{RED}Cannot login — aborting.{RESET}")
        sys.exit(1)

    if not args.test_only:
        phase2_static_check()
        bank_ids    = seed_bank_accounts()
        seed_bank_transactions(bank_ids)
        source_ids  = seed_income_sources()
        seed_income_entries(source_ids)
        card_ids    = seed_credit_cards()
        seed_cc_transactions(card_ids)
        emi_ids     = seed_emis(card_ids)
        seed_loans()
        seed_investments()
        seed_assets()
        seed_insurance()
        seed_goals()
        friend_ids  = seed_friends()
        seed_friend_emis(friend_ids, card_ids)
        seed_net_worth_snapshot()

    if not args.seed_only:
        phase4_e2e_tests()
        phase5_snapshot()

    elapsed = time.time() - start
    hdr("FINAL RESULTS")
    total = PASS + FAIL
    pct   = (PASS / total * 100) if total else 0
    print(f"\n  {GREEN}✓ PASS: {PASS}{RESET}  {RED}✗ FAIL: {FAIL}{RESET}  | {pct:.0f}% passing")
    print(f"  Elapsed: {elapsed:.1f}s\n")

    if FAIL > 0:
        print(f"  {RED}{BOLD}War room incomplete — {FAIL} checks failed.{RESET}\n")
        sys.exit(1)
    else:
        print(f"  {GREEN}{BOLD}All checks passed! Product is war-room ready.{RESET}\n")


if __name__ == "__main__":
    main()
