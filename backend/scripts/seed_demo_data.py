#!/usr/bin/env python3
"""
Seed realistic demo data for My CFO — 5 user personas, 3-5 years of data.
Run: python backend/scripts/seed_demo_data.py [--base-url http://localhost:4000]
"""
import argparse, json, random, sys, time
from datetime import date, datetime, timedelta
from decimal import Decimal

import requests

# ─── Config ───────────────────────────────────────────────────────────────────
BASE_URL = "http://localhost:4000"
VERBOSE  = False

session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

def api(path): return f"{BASE_URL}/api/v1{path}"

def post(path, payload, tok=None):
    h = {"Authorization": f"Bearer {tok}"} if tok else {}
    r = session.post(api(path), json=payload, headers=h, timeout=30)
    if VERBOSE: print(f"  POST {path} → {r.status_code}")
    return r

def patch(path, payload, tok):
    r = session.patch(api(path), json=payload,
                      headers={"Authorization": f"Bearer {tok}"}, timeout=30)
    if VERBOSE: print(f"  PATCH {path} → {r.status_code}")
    return r

def get(path, tok, params=None):
    r = session.get(api(path), headers={"Authorization": f"Bearer {tok}"},
                    params=params, timeout=30)
    return r

def register_and_login(name, email, username, password):
    post("/auth/register", {
        "name": name, "email": email,
        "username": username, "password": password,
    })
    r = post("/auth/login", {"identifier": username, "password": password})
    if r.status_code != 200:
        print(f"  ✗ Login failed for {username}: {r.text[:200]}")
        return None
    return r.json().get("access_token")

def ok(r): return r.status_code in (200, 201)

# ─── Date helpers ─────────────────────────────────────────────────────────────
def dstr(d): return d.isoformat()
def months_ago(n): return date.today() - timedelta(days=n*30)
def days_ago(n):   return date.today() - timedelta(days=n)

def date_range(start: date, end: date, step_days=1):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=step_days)

# ─── Random helpers ───────────────────────────────────────────────────────────
def rnd(lo, hi): return round(random.uniform(lo, hi), 2)
def rndint(lo, hi): return random.randint(lo, hi)
def pick(*args): return random.choice(args)

# ─── Progress ─────────────────────────────────────────────────────────────────
total_records = 0
def record(n=1):
    global total_records
    total_records += n

def log(msg): print(f"  {msg}")
def section(msg): print(f"\n  ─── {msg} ───")

# ══════════════════════════════════════════════════════════════════════════════
# USER 1 — Arjun Mehta: Mid-career salaried SE in Bangalore
# Salary: ₹1.5L/mo, growing to ₹2L, moderate savings, SIPs, home loan
# ══════════════════════════════════════════════════════════════════════════════
def seed_arjun():
    print("\n╔══════════════════════════════════════════════╗")
    print("║  USER 1: Arjun Mehta — Salaried SE, Blr      ║")
    print("╚══════════════════════════════════════════════╝")

    tok = register_and_login("Arjun Mehta", "arjun@mycfo.in", "arjun", "Arjun@1234")
    if not tok: return
    log("✓ Registered & logged in")

    # ── Bank accounts ──────────────────────────────────────────────────────────
    section("Bank Accounts")
    accs = {}
    for acc in [
        {"nickname": "HDFC Salary A/C",   "bank_name": "HDFC Bank", "account_type": "SALARY",
         "account_number_last4": "1122", "current_balance": 245000, "is_primary": True},
        {"nickname": "SBI Savings A/C",   "bank_name": "SBI",       "account_type": "SAVINGS",
         "account_number_last4": "9900", "current_balance": 87000},
        {"nickname": "HDFC FD 15M",       "bank_name": "HDFC Bank", "account_type": "FD",
         "account_number_last4": "0001", "current_balance": 300000,
         "maturity_amount": 342000, "interest_rate": 7.1,
         "maturity_date": (date.today() + timedelta(days=400)).isoformat()},
    ]:
        r = post("/bank-accounts", acc, tok)
        if ok(r):
            d = r.json(); accs[d["account_type"]] = d["id"]; record()

    salary_acc = accs.get("SALARY") or list(accs.values())[0]
    savings_acc = accs.get("SAVINGS") or salary_acc

    # ── Income sources ────────────────────────────────────────────────────────
    section("Income Sources")
    r = post("/income/sources", {"name": "Infosys Salary", "income_type": "SALARY",
                          "monthly_amount": 175000, "tax_deducted_pct": 18,
                          "is_active": True, "start_date": dstr(months_ago(48))}, tok)
    if ok(r): record()
    r = post("/income/sources", {"name": "Tech Blog Adsense", "income_type": "FREELANCE",
                          "monthly_amount": 8000, "tax_deducted_pct": 0,
                          "is_active": True, "start_date": dstr(months_ago(24))}, tok)
    if ok(r): record()

    # ── Bank transactions — 4 years ───────────────────────────────────────────
    section("Bank Transactions (4 years)")
    start_date = months_ago(48)
    today = date.today()

    tx_batch = []
    for mn, cur_date in enumerate(date_range(start_date, today, step_days=30)):
        salary = 150000 + (mn // 12) * 15000  # yearly increments
        # Salary credit first of month
        tx_batch.append({
            "amount": salary, "tx_type": "CREDIT", "description": "NEFT-INFOSYS TECHNOLOGIES LTD",
            "category": "SALARY", "transaction_date": dstr(cur_date + timedelta(days=1)),
            "merchant_name": "Infosys"
        })
        # Monthly rent
        tx_batch.append({
            "amount": 28000, "tx_type": "DEBIT", "description": "IMPS-RENT-PRIYA ESTATES",
            "category": "RENT", "transaction_date": dstr(cur_date + timedelta(days=2))
        })
        # Groceries x2/month
        for _ in range(2):
            tx_batch.append({
                "amount": rndint(3000, 7000), "tx_type": "DEBIT",
                "description": pick("BigBasket", "Swiggy Instamart", "DMart", "Zepto"),
                "category": "FOOD", "transaction_date": dstr(cur_date + timedelta(days=rndint(3, 28)))
            })
        # Dining/Zomato/Swiggy
        for _ in range(rndint(4, 10)):
            tx_batch.append({
                "amount": rndint(300, 1800), "tx_type": "DEBIT",
                "description": pick("Zomato", "Swiggy", "Pizza Hut", "McDonald's", "Starbucks", "Local restaurant"),
                "category": "FOOD", "transaction_date": dstr(cur_date + timedelta(days=rndint(1, 28)))
            })
        # Utilities
        tx_batch.append({
            "amount": rndint(1800, 3200), "tx_type": "DEBIT",
            "description": "BESCOM Electricity Bill", "category": "UTILITIES",
            "transaction_date": dstr(cur_date + timedelta(days=15))
        })
        # ATM
        if random.random() > 0.5:
            tx_batch.append({
                "amount": rndint(5000, 10000), "tx_type": "DEBIT",
                "description": "ATM WITHDRAWAL", "category": "ATM_WITHDRAWAL",
                "transaction_date": dstr(cur_date + timedelta(days=rndint(5, 25)))
            })
        # OTT / subscriptions
        for sub in [("Netflix ₹649", 649), ("Spotify ₹119", 119), ("Amazon Prime", 179)]:
            if random.random() > 0.3:
                tx_batch.append({
                    "amount": sub[1], "tx_type": "DEBIT", "description": sub[0],
                    "category": "ENTERTAINMENT",
                    "transaction_date": dstr(cur_date + timedelta(days=rndint(1, 5)))
                })
        # UPI misc
        for _ in range(rndint(5, 15)):
            tx_batch.append({
                "amount": rndint(100, 3000), "tx_type": "DEBIT",
                "description": f"UPI/{pick('PhonePe','GPay','Paytm')}/{rndint(1000,9999)}",
                "category": "UPI",
                "transaction_date": dstr(cur_date + timedelta(days=rndint(1, 28)))
            })
        # Festival spikes (Oct/Nov/Jan)
        if cur_date.month in (10, 11, 1):
            tx_batch.append({
                "amount": rndint(8000, 25000), "tx_type": "DEBIT",
                "description": pick("Amazon Festive Sale", "Flipkart Big Billion", "Myntra EORS", "Croma Electronics"),
                "category": "SHOPPING",
                "transaction_date": dstr(cur_date + timedelta(days=rndint(1, 15)))
            })
        # Annual bonus (Apr)
        if cur_date.month == 4 and mn > 11:
            tx_batch.append({
                "amount": salary * 2, "tx_type": "CREDIT",
                "description": "NEFT-INFOSYS ANNUAL BONUS",
                "category": "SALARY",
                "transaction_date": dstr(cur_date + timedelta(days=5))
            })

    # Bulk insert
    imported = 0
    for tx in tx_batch:
        r = post(f"/bank-accounts/{salary_acc}/transactions", tx, tok)
        if ok(r): imported += 1
    record(imported)
    log(f"✓ {imported} bank transactions seeded")

    # ── Credit cards ──────────────────────────────────────────────────────────
    section("Credit Cards")
    cards = {}
    for card in [
        {"nickname": "HDFC Regalia", "bank_name": "HDFC Bank", "last_four": "4421",
         "credit_limit": 500000, "current_outstanding": 38000, "billing_cycle_day": 15, "due_date_day": 5},
        {"nickname": "Axis Magnus",  "bank_name": "Axis Bank",  "last_four": "7732",
         "credit_limit": 300000, "current_outstanding": 12000, "billing_cycle_day": 20, "due_date_day": 10},
    ]:
        r = post("/cards", card, tok)
        if ok(r): d = r.json(); cards[d["nickname"]] = d["id"]; record()

    # CC transactions — 3 years
    section("CC Transactions (3 years)")
    cc_start = months_ago(36)
    cc_tx_count = 0
    for card_id in list(cards.values()):
        for mn, cur_date in enumerate(date_range(cc_start, today, step_days=30)):
            for _ in range(rndint(8, 20)):
                amount = rndint(200, 12000)
                cat = pick("SHOPPING", "FOOD", "TRAVEL", "ENTERTAINMENT", "HEALTHCARE", "UTILITIES", "OTHER")
                desc = {
                    "SHOPPING": pick("Amazon", "Myntra", "Nykaa", "Meesho"),
                    "FOOD":     pick("Zomato", "Swiggy", "Blinkit", "Dominos"),
                    "TRAVEL":   pick("MakeMyTrip", "IRCTC", "Uber", "Ola"),
                    "ENTERTAINMENT": pick("BookMyShow", "Netflix", "Apple Music"),
                    "HEALTHCARE": pick("PharmEasy", "Apollo Pharmacy", "Practo"),
                    "UTILITIES": pick("Airtel", "Jio", "BSNL", "Bescom"),
                    "OTHER": pick("Petrol Pump", "Hardware Store", "Random UPI"),
                }[cat]
                r = post("/transactions", {
                    "card_id": card_id, "amount": amount,
                    "description": desc, "category": cat,
                    "transaction_date": dstr(cur_date + timedelta(days=rndint(1, 28))),
                    "merchant_name": desc,
                }, tok)
                if ok(r): cc_tx_count += 1
    record(cc_tx_count)
    log(f"✓ {cc_tx_count} CC transactions seeded")

    # ── Loans ─────────────────────────────────────────────────────────────────
    section("Loans")
    loans = [
        {"lender_name": "HDFC Bank", "loan_type": "HOME",      "principal_amount": 4500000,
         "outstanding_balance": 3800000, "interest_rate": 8.65, "emi_amount": 39800,
         "tenure_months": 240, "start_date": dstr(months_ago(36)),
         "emi_due_day": 5, 
         "is_secured": True, "status": "ACTIVE"},
        {"lender_name": "Bajaj Finance", "loan_type": "PERSONAL", "principal_amount": 300000,
         "outstanding_balance": 145000, "interest_rate": 13.5, "emi_amount": 6800,
         "tenure_months": 48, "start_date": dstr(months_ago(18)),
         "emi_due_day": 5, 
         "is_secured": False, "status": "ACTIVE"},
    ]
    for l in loans:
        r = post("/loans", l, tok)
        if ok(r): record()

    # ── Investments ───────────────────────────────────────────────────────────
    section("Investments")
    investments = [
        {"name": "Mirae Asset Large Cap",      "investment_type": "MUTUAL_FUND", "invested_amount": 480000,
         "current_value": 612000, "is_sip": True, "sip_amount": 10000, "sip_status": "ACTIVE",
         "start_date": dstr(months_ago(48))},
        {"name": "Axis Bluechip Fund",         "investment_type": "MUTUAL_FUND", "invested_amount": 240000,
         "current_value": 298000, "is_sip": True, "sip_amount": 5000, "sip_status": "ACTIVE",
         "start_date": dstr(months_ago(36))},
        {"name": "NIFTY 50 ETF — Nippon",      "investment_type": "ETF",         "invested_amount": 180000,
         "current_value": 224000, "is_sip": False, "start_date": dstr(months_ago(30))},
        {"name": "Infosys Stocks",             "investment_type": "STOCKS",      "invested_amount": 120000,
         "current_value": 165000, "is_sip": False, "start_date": dstr(months_ago(24))},
        {"name": "PPF — SBI",                  "investment_type": "PPF",         "invested_amount": 150000,
         "current_value": 178000, "is_sip": True,  "sip_amount": 12500, "sip_status": "ACTIVE",
         "start_date": dstr(months_ago(60)), "is_locked": True},
        {"name": "EPF — Infosys",              "investment_type": "EPF",         "invested_amount": 280000,
         "current_value": 318000, "is_sip": True,  "sip_amount": 14000, "sip_status": "ACTIVE",
         "start_date": dstr(months_ago(48)), "is_locked": True},
    ]
    for inv in investments:
        r = post("/investments", inv, tok)
        if ok(r): record()

    # ── EMIs ──────────────────────────────────────────────────────────────────
    section("EMIs")
    emis = [
        {"product_name": "iPhone 15 Pro", "purchase_date": dstr(months_ago(6)),
         "total_amount": 134900, "purchase_amount": 134900, "monthly_emi": 12900,
         "tenure_months": 12, "interest_rate": 0, "is_no_cost_emi": True},
        {"product_name": "LG OLED TV",    "purchase_date": dstr(months_ago(10)),
         "total_amount": 89000, "purchase_amount": 89000, "monthly_emi": 7800,
         "tenure_months": 12, "interest_rate": 13.5},
    ]
    for e in emis:
        r = post("/emis", e, tok)
        if ok(r): record()

    # ── Assets ────────────────────────────────────────────────────────────────
    section("Physical Assets")
    assets = [
        {"name": "2BHK Apartment Whitefield", "asset_type": "REAL_ESTATE",
         "purchase_price": 5200000, "current_value": 6800000,
         "purchase_date": dstr(months_ago(36)), "is_insured": True},
        {"name": "Honda City 2022",           "asset_type": "VEHICLE",
         "purchase_price": 1350000, "current_value": 1050000,
         "purchase_date": dstr(months_ago(18)), "is_insured": True},
        {"name": "Gold Jewellery",            "asset_type": "JEWELRY",
         "purchase_price": 180000, "current_value": 245000,
         "purchase_date": dstr(months_ago(60))},
    ]
    for a in assets:
        r = post("/assets", a, tok)
        if ok(r): record()

    # ── Insurance ─────────────────────────────────────────────────────────────
    section("Insurance")
    insurances = [
        {"insurance_type": "HEALTH",   "policy_name": "Star Health Family Floater",
         "insurer": "Star Health", "premium_amount": 28000, "premium_frequency": "YEARLY",
         "sum_assured": 1000000, "cover_amount": 1000000,
         "renewal_date": dstr(date.today() + timedelta(days=180)), "is_active": True},
        {"insurance_type": "TERM",     "policy_name": "LIC Tech Term",
         "insurer": "LIC", "premium_amount": 18000, "premium_frequency": "YEARLY",
         "sum_assured": 10000000, "cover_amount": 10000000,
         "renewal_date": dstr(date.today() + timedelta(days=300)), "is_active": True},
        {"insurance_type": "VEHICLE",  "policy_name": "HDFC ERGO Car Insurance",
         "insurer": "HDFC ERGO", "premium_amount": 12500, "premium_frequency": "YEARLY",
         "sum_assured": 1350000, "cover_amount": 1350000,
         "renewal_date": dstr(date.today() + timedelta(days=45)), "is_active": True},
    ]
    for ins in insurances:
        r = post("/insurance", ins, tok)
        if ok(r): record()

    # ── Goals ─────────────────────────────────────────────────────────────────
    section("Goals")
    goals = [
        {"name": "Emergency Fund 6M", "goal_type": "EMERGENCY_FUND",
         "target_amount": 600000, "current_amount": 245000, "monthly_contribution": 15000,
         "target_date": dstr(months_ago(-18)), "priority": "HIGH"},
        {"name": "Europe Trip 2027",  "goal_type": "VACATION",
         "target_amount": 350000, "current_amount": 80000, "monthly_contribution": 12000,
         "target_date": dstr(months_ago(-24)), "priority": "MEDIUM"},
        {"name": "Retirement Corpus", "goal_type": "RETIREMENT",
         "target_amount": 30000000, "current_amount": 496000, "monthly_contribution": 26500,
         "target_date": dstr(months_ago(-240)), "priority": "HIGH"},
        {"name": "New Car Fund",      "goal_type": "CAR",
         "target_amount": 1500000, "current_amount": 220000, "monthly_contribution": 20000,
         "target_date": dstr(months_ago(-36)), "priority": "LOW"},
    ]
    for g in goals:
        r = post("/goals", g, tok)
        if ok(r): record()

    # ── Friends ───────────────────────────────────────────────────────────────
    section("Friends / Split")
    friend_ids = {}
    for f in [
        {"name": "Rohit Kumar", "notes": "Goa trip split", "relation": "FRIEND"},
        {"name": "Sneha Patel", "notes": "Dinner + groceries", "relation": "FRIEND"},
    ]:
        r = post("/friends", f, tok)
        if ok(r): d = r.json(); friend_ids[d["name"]] = d["id"]; record()

    # Friend EMIs so that total_pending is computed correctly
    for fname, amount, product in [
        ("Rohit Kumar", 8500, "Goa trip share"),
        ("Sneha Patel", 3200, "Dinner split"),
    ]:
        fid = friend_ids.get(fname)
        if fid:
            r = post("/emis", {
                "friend_id": fid, "product_name": product,
                "purchase_date": dstr(months_ago(2)),
                "total_amount": amount, "purchase_amount": amount,
                "monthly_emi": amount, "tenure_months": 1,
                "interest_rate": 0, "is_no_cost_emi": True,
                "owner_type": "SHARED",
            }, tok)
            if ok(r): record()

    # ── Net Worth snapshot ─────────────────────────────────────────────────────
    get("/net-worth/snapshot", tok)
    post("/net-worth/snapshots", {}, tok)

    log(f"✓ Arjun Mehta seeded completely")


# ══════════════════════════════════════════════════════════════════════════════
# USER 2 — Priya & Kiran Nair: Married dual-income family, Pune
# Combined income ₹3.2L, kids, school EMI, family insurance, joint goals
# ══════════════════════════════════════════════════════════════════════════════
def seed_priya():
    print("\n╔══════════════════════════════════════════════╗")
    print("║  USER 2: Priya Nair — Married Family, Pune    ║")
    print("╚══════════════════════════════════════════════╝")

    tok = register_and_login("Priya Nair", "priya@mycfo.in", "priya", "Priya@1234")
    if not tok: return
    log("✓ Registered & logged in")

    section("Bank Accounts")
    accs = {}
    for acc in [
        {"nickname": "ICICI Salary A/C",  "bank_name": "ICICI Bank", "account_type": "SALARY",
         "account_number_last4": "2233", "current_balance": 188000, "is_primary": True},
        {"nickname": "SBI Joint Savings",  "bank_name": "SBI",       "account_type": "SAVINGS",
         "account_number_last4": "5566", "current_balance": 340000},
        {"nickname": "ICICI FD 2Y",        "bank_name": "ICICI Bank","account_type": "FD",
         "account_number_last4": "0001", "current_balance": 500000,
         "maturity_amount": 573000, "interest_rate": 7.5,
         "maturity_date": (date.today() + timedelta(days=730)).isoformat()},
        {"nickname": "Post Office RD",     "bank_name": "Post Office","account_type": "RD",
         "account_number_last4": "0001", "current_balance": 120000, "interest_rate": 6.7,
         "maturity_date": (date.today() + timedelta(days=365)).isoformat()},
    ]:
        r = post("/bank-accounts", acc, tok)
        if ok(r): d = r.json(); accs[d["account_type"]] = d["id"]; record()

    salary_acc = accs.get("SALARY") or list(accs.values())[0]

    section("Income Sources")
    for inc in [
        {"name": "Priya — TCS Salary",  "income_type": "SALARY", "monthly_amount": 185000,
         "tax_deducted_pct": 20, "is_active": True},
        {"name": "Kiran — HCL Salary",  "income_type": "SALARY", "monthly_amount": 142000,
         "tax_deducted_pct": 15, "is_active": True},
        {"name": "Rental Income — Flat", "income_type": "RENTAL", "monthly_amount": 18000,
         "tax_deducted_pct": 0, "is_active": True},
    ]:
        r = post("/income/sources", inc, tok); record() if ok(r) else None

    section("Bank Transactions (4 years)")
    start_date = months_ago(48)
    today = date.today()
    tx_count = 0
    for mn, cur_date in enumerate(date_range(start_date, today, step_days=30)):
        combined_salary = 325000 + (mn // 12) * 20000
        txs = [
            {"amount": combined_salary, "tx_type": "CREDIT",
             "description": "NEFT-TCS + HCL SALARY", "category": "SALARY",
             "transaction_date": dstr(cur_date + timedelta(days=1))},
            {"amount": 32000, "tx_type": "DEBIT", "description": "HOME LOAN EMI — SBI",
             "category": "EMI_PAYMENT", "transaction_date": dstr(cur_date + timedelta(days=3))},
            {"amount": 18000, "tx_type": "DEBIT", "description": "SCHOOL FEE — DPS PUNE",
             "category": "EDUCATION", "transaction_date": dstr(cur_date + timedelta(days=5))},
            {"amount": rndint(15000, 28000), "tx_type": "DEBIT",
             "description": "BigBasket / DMart / Zepto", "category": "FOOD",
             "transaction_date": dstr(cur_date + timedelta(days=rndint(6,25)))},
            {"amount": rndint(2500, 5000), "tx_type": "DEBIT",
             "description": "MSEDCL Electricity", "category": "UTILITIES",
             "transaction_date": dstr(cur_date + timedelta(days=15))},
            {"amount": 18000, "tx_type": "CREDIT", "description": "RENT RECEIVED",
             "category": "TRANSFER_IN", "transaction_date": dstr(cur_date + timedelta(days=7))},
        ]
        for _ in range(rndint(3, 8)):
            txs.append({"amount": rndint(200, 5000), "tx_type": "DEBIT",
                         "description": f"UPI/GPay/{rndint(1000,9999)}", "category": "UPI",
                         "transaction_date": dstr(cur_date + timedelta(days=rndint(1,28)))})
        if cur_date.month in (1, 4, 10):  # school/holiday spikes
            txs.append({"amount": rndint(15000, 50000), "tx_type": "DEBIT",
                          "description": pick("Family vacation — Goa", "Family vacation — Ooty",
                                              "Diwali gifts + shopping", "Summer camp + books"),
                          "category": pick("TRAVEL", "SHOPPING", "EDUCATION"),
                          "transaction_date": dstr(cur_date + timedelta(days=10))})
        for tx in txs:
            r = post(f"/bank-accounts/{salary_acc}/transactions", tx, tok)
            if ok(r): tx_count += 1
    record(tx_count); log(f"✓ {tx_count} bank transactions")

    section("Credit Cards")
    cards = {}
    for card in [
        {"nickname": "ICICI Amazon Pay", "bank_name": "ICICI Bank", "last_four": "5521",
         "credit_limit": 400000, "current_outstanding": 52000, "billing_cycle_day": 18, "due_date_day": 8},
        {"nickname": "SBI SimplySave",   "bank_name": "SBI",         "last_four": "3312",
         "credit_limit": 250000, "current_outstanding": 28000, "billing_cycle_day": 10, "due_date_day": 1},
    ]:
        r = post("/cards", card, tok)
        if ok(r): d = r.json(); cards[d["nickname"]] = d["id"]; record()

    cc_tx_count = 0
    cc_start = months_ago(36)
    categories_family = ["FOOD", "SHOPPING", "HEALTHCARE", "EDUCATION", "TRAVEL", "UTILITIES"]
    for card_id in list(cards.values()):
        for _, cur_date in enumerate(date_range(cc_start, today, step_days=30)):
            for _ in range(rndint(12, 25)):
                cat = random.choice(categories_family)
                merch = {
                    "FOOD": pick("BigBasket", "Zomato", "Swiggy", "Blinkit", "Milkbasket"),
                    "SHOPPING": pick("Amazon", "Firstcry", "Myntra", "Hopscotch"),
                    "HEALTHCARE": pick("Apollo Pharmacy", "Practo", "1mg", "MedPlus"),
                    "EDUCATION": pick("BYJU's", "Vedantu", "Udemy", "Coursera"),
                    "TRAVEL": pick("IRCTC", "MakeMyTrip", "Yatra", "Ola"),
                    "UTILITIES": pick("Jio", "Airtel", "MSEDCL", "Mahanagar Gas"),
                }[cat]
                r = post("/transactions", {
                    "card_id": card_id, "amount": rndint(300, 18000),
                    "description": merch, "category": cat,
                    "transaction_date": dstr(cur_date + timedelta(days=rndint(1, 28))),
                    "merchant_name": merch,
                }, tok)
                if ok(r): cc_tx_count += 1
    record(cc_tx_count); log(f"✓ {cc_tx_count} CC transactions")

    section("Loans")
    for l in [
        {"lender_name": "SBI Home Loans", "loan_type": "HOME", "principal_amount": 5800000,
         "outstanding_balance": 4800000, "interest_rate": 8.35, "emi_amount": 48500,
         "tenure_months": 300, "start_date": dstr(months_ago(48)),
         "emi_due_day": 5, "is_secured": True, "status": "ACTIVE"},
        {"lender_name": "HDFC Bank", "loan_type": "VEHICLE", "principal_amount": 900000,
         "outstanding_balance": 320000, "interest_rate": 9.5, "emi_amount": 18500,
         "tenure_months": 60, "start_date": dstr(months_ago(30)),
         "emi_due_day": 5, "is_secured": True, "status": "ACTIVE"},
    ]:
        r = post("/loans", l, tok); record() if ok(r) else None

    section("Investments")
    for inv in [
        {"name": "HDFC Top 100 Fund",        "investment_type": "MUTUAL_FUND", "invested_amount": 600000,
         "current_value": 782000, "is_sip": True, "sip_amount": 15000, "sip_status": "ACTIVE"},
        {"name": "PPF — ICICI",              "investment_type": "PPF",         "invested_amount": 200000,
         "current_value": 238000, "is_sip": True, "sip_amount": 12500, "sip_status": "ACTIVE", "is_locked": True},
        {"name": "Gold ETF — Kotak",         "investment_type": "ETF",         "invested_amount": 120000,
         "current_value": 158000, "is_sip": False},
        {"name": "Sukanya Samriddhi Yojana", "investment_type": "PPF",         "invested_amount": 150000,
         "current_value": 178000, "is_sip": True, "sip_amount": 12500, "sip_status": "ACTIVE", "is_locked": True},
        {"name": "NPS — Priya",             "investment_type": "NPS",          "invested_amount": 96000,
         "current_value": 112000, "is_sip": True, "sip_amount": 8000, "sip_status": "ACTIVE", "is_locked": True},
    ]:
        r = post("/investments", inv, tok); record() if ok(r) else None

    section("Insurance")
    for ins in [
        {"insurance_type": "HEALTH", "policy_name": "Niva Bupa Family Floater 10L",
         "insurer": "Niva Bupa", "premium_amount": 42000, "premium_frequency": "YEARLY",
         "sum_assured": 1000000, "cover_amount": 1000000,
         "renewal_date": dstr(date.today() + timedelta(days=210)), "is_active": True},
        {"insurance_type": "TERM", "policy_name": "HDFC Life Click2Protect",
         "insurer": "HDFC Life", "premium_amount": 22000, "premium_frequency": "YEARLY",
         "sum_assured": 15000000, "cover_amount": 15000000,
         "renewal_date": dstr(date.today() + timedelta(days=290)), "is_active": True},
        {"insurance_type": "LIFE", "policy_name": "LIC Jeevan Anand",
         "insurer": "LIC", "premium_amount": 38000, "premium_frequency": "YEARLY",
         "sum_assured": 2000000, "cover_amount": 2000000,
         "renewal_date": dstr(date.today() + timedelta(days=120)), "is_active": True},
        {"insurance_type": "VEHICLE", "policy_name": "Bajaj Allianz Car Insurance",
         "insurer": "Bajaj Allianz", "premium_amount": 16000, "premium_frequency": "YEARLY",
         "sum_assured": 900000, "cover_amount": 900000,
         "renewal_date": dstr(date.today() + timedelta(days=60)), "is_active": True},
    ]:
        r = post("/insurance", ins, tok); record() if ok(r) else None

    section("Goals")
    for g in [
        {"name": "Children's Education Fund", "goal_type": "EDUCATION",
         "target_amount": 5000000, "current_amount": 350000, "monthly_contribution": 20000,
         "target_date": dstr(months_ago(-180)), "priority": "HIGH"},
        {"name": "Home Loan Prepayment",      "goal_type": "DEBT_FREE",
         "target_amount": 4800000, "current_amount": 0, "monthly_contribution": 10000,
         "target_date": dstr(months_ago(-120)), "priority": "MEDIUM"},
        {"name": "Family Emergency Fund",     "goal_type": "EMERGENCY_FUND",
         "target_amount": 900000, "current_amount": 340000, "monthly_contribution": 20000,
         "target_date": dstr(months_ago(-18)), "priority": "HIGH"},
        {"name": "Family Europe Trip",        "goal_type": "VACATION",
         "target_amount": 600000, "current_amount": 120000, "monthly_contribution": 15000,
         "target_date": dstr(months_ago(-30)), "priority": "LOW"},
    ]:
        r = post("/goals", g, tok); record() if ok(r) else None

    section("Assets")
    for a in [
        {"name": "3BHK Flat — Baner Pune",  "asset_type": "REAL_ESTATE",
         "purchase_price": 7200000, "current_value": 9500000,
         "purchase_date": dstr(months_ago(48)), "is_insured": True},
        {"name": "Investment Plot — Lavasa", "asset_type": "REAL_ESTATE",
         "purchase_price": 1800000, "current_value": 2400000,
         "purchase_date": dstr(months_ago(60))},
        {"name": "Maruti Ertiga",            "asset_type": "VEHICLE",
         "purchase_price": 1150000, "current_value": 850000,
         "purchase_date": dstr(months_ago(30)), "is_insured": True},
    ]:
        r = post("/assets", a, tok); record() if ok(r) else None

    section("Friends")
    priya_friend_ids = {}
    for f in [
        {"name": "Anand Sharma", "notes": "Manali trip expenses"},
        {"name": "Kavya Iyer",   "notes": "Wedding gift pooling"},
    ]:
        r = post("/friends", f, tok)
        if ok(r): d = r.json(); priya_friend_ids[d["name"]] = d["id"]; record()

    for fname, amount, product in [
        ("Anand Sharma", 12000, "Manali trip share"),
        ("Kavya Iyer",   5500,  "Wedding gift pool"),
    ]:
        fid = priya_friend_ids.get(fname)
        if fid:
            r = post("/emis", {
                "friend_id": fid, "product_name": product,
                "purchase_date": dstr(months_ago(2)),
                "total_amount": amount, "purchase_amount": amount,
                "monthly_emi": amount, "tenure_months": 1,
                "interest_rate": 0, "is_no_cost_emi": True,
                "owner_type": "SHARED",
            }, tok)
            if ok(r): record()

    get("/net-worth/snapshot", tok)
    post("/net-worth/snapshots", {}, tok)
    log("✓ Priya Nair seeded completely")


# ══════════════════════════════════════════════════════════════════════════════
# USER 3 — Vikram Rao: Freelancer/Agency owner, Mumbai
# Variable income ₹80K–3L/mo, high CC usage, no stable salary
# ══════════════════════════════════════════════════════════════════════════════
def seed_vikram():
    print("\n╔══════════════════════════════════════════════╗")
    print("║  USER 3: Vikram Rao — Freelancer, Mumbai      ║")
    print("╚══════════════════════════════════════════════╝")

    tok = register_and_login("Vikram Rao", "vikram@mycfo.in", "vikram", "Vikram@1234")
    if not tok: return
    log("✓ Registered & logged in")

    section("Bank Accounts")
    accs = {}
    for acc in [
        {"nickname": "Kotak Business A/C","bank_name": "Kotak Mahindra","account_type": "CURRENT",
         "account_number_last4": "8899", "current_balance": 420000, "is_primary": True},
        {"nickname": "ICICI Personal",    "bank_name": "ICICI Bank",   "account_type": "SAVINGS",
         "account_number_last4": "4455", "current_balance": 185000},
        {"nickname": "Paytm Wallet",      "bank_name": "Paytm",         "account_type": "WALLET",
         "account_number_last4": "0001", "current_balance": 12000},
    ]:
        r = post("/bank-accounts", acc, tok)
        if ok(r): d = r.json(); accs[d["account_type"]] = d["id"]; record()

    primary_acc = accs.get("CURRENT") or list(accs.values())[0]

    section("Income Sources")
    for inc in [
        {"name": "Agency Retainer — Clients", "income_type": "BUSINESS", "monthly_amount": 180000,
         "tax_deducted_pct": 10, "is_active": True},
        {"name": "Upwork Freelance Projects", "income_type": "FREELANCE", "monthly_amount": 85000,
         "tax_deducted_pct": 0, "is_active": True},
        {"name": "YouTube Channel",           "income_type": "SIDE_HUSTLE", "monthly_amount": 22000,
         "tax_deducted_pct": 0, "is_active": True},
    ]:
        r = post("/income/sources", inc, tok); record() if ok(r) else None

    section("Bank Transactions (3 years — variable income)")
    start_date = months_ago(36)
    today = date.today()
    tx_count = 0
    for mn, cur_date in enumerate(date_range(start_date, today, step_days=30)):
        # Variable income months — some great, some terrible
        good_month = random.random() > 0.35
        income = rndint(180000, 320000) if good_month else rndint(60000, 130000)
        num_clients = rndint(2, 5) if good_month else rndint(1, 2)
        client_names = ["Acme Corp", "TechStart Pvt", "Media House", "Brand Agency", "FinTech Client"]
        txs = []
        for i in range(num_clients):
            txs.append({"amount": income // num_clients, "tx_type": "CREDIT",
                          "description": f"NEFT-{random.choice(client_names)}-INV{rndint(1000,9999)}",
                          "category": "BUSINESS_INCOME",
                          "transaction_date": dstr(cur_date + timedelta(days=rndint(1, 20)))})
        # Expenses
        txs += [
            {"amount": 55000, "tx_type": "DEBIT", "description": "OFFICE RENT — ANDHERI",
             "category": "RENT", "transaction_date": dstr(cur_date + timedelta(days=2))},
            {"amount": rndint(18000, 35000), "tx_type": "DEBIT",
             "description": "AWS / Google Cloud / Tools", "category": "UTILITIES",
             "transaction_date": dstr(cur_date + timedelta(days=5))},
            {"amount": rndint(8000, 18000), "tx_type": "DEBIT",
             "description": pick("Freelancer salaries", "Contractor payment"),
             "category": "OTHER", "transaction_date": dstr(cur_date + timedelta(days=10))},
        ]
        # Client entertainment
        for _ in range(rndint(2, 6)):
            txs.append({"amount": rndint(1500, 12000), "tx_type": "DEBIT",
                          "description": pick("Taj Hotel", "Client dinner", "WeWork coworking"),
                          "category": "ENTERTAINMENT",
                          "transaction_date": dstr(cur_date + timedelta(days=rndint(1, 28)))})
        # Travel — frequent flyer
        if random.random() > 0.5:
            txs.append({"amount": rndint(8000, 35000), "tx_type": "DEBIT",
                          "description": pick("IndiGo BOM-DEL", "Air India MUM-BLR", "Uber Black"),
                          "category": "TRAVEL",
                          "transaction_date": dstr(cur_date + timedelta(days=rndint(5, 20)))})
        for tx in txs:
            r = post(f"/bank-accounts/{primary_acc}/transactions", tx, tok)
            if ok(r): tx_count += 1
    record(tx_count); log(f"✓ {tx_count} bank transactions")

    section("Credit Cards")
    cards = {}
    for card in [
        {"nickname": "Amex Gold Business",   "bank_name": "American Express", "last_four": "2001",
         "credit_limit": 800000, "current_outstanding": 145000, "billing_cycle_day": 25, "due_date_day": 15},
        {"nickname": "Kotak League Platinum","bank_name": "Kotak Mahindra",   "last_four": "8834",
         "credit_limit": 500000, "current_outstanding": 68000,  "billing_cycle_day": 12, "due_date_day": 3},
        {"nickname": "HDFC Diners Club",     "bank_name": "HDFC Bank",         "last_four": "9912",
         "credit_limit": 700000, "current_outstanding": 92000,  "billing_cycle_day": 20, "due_date_day": 10},
    ]:
        r = post("/cards", card, tok)
        if ok(r): d = r.json(); cards[d["nickname"]] = d["id"]; record()

    cc_tx_count = 0
    cc_start = months_ago(30)
    for card_id in list(cards.values()):
        for _, cur_date in enumerate(date_range(cc_start, today, step_days=30)):
            for _ in range(rndint(15, 35)):
                cat = pick("TRAVEL", "ENTERTAINMENT", "SHOPPING", "FOOD", "OTHER", "UTILITIES")
                merch = {
                    "TRAVEL": pick("IndiGo", "Air India", "Uber Eats", "Rapido", "OYO Rooms"),
                    "ENTERTAINMENT": pick("Taj Bistro", "Hard Rock Cafe", "PVR", "Levi's"),
                    "SHOPPING": pick("Apple Store", "Croma", "Nike", "Reliance Digital"),
                    "FOOD": pick("Zomato", "Swiggy", "Smoke House Deli", "Social"),
                    "OTHER": pick("Office supplies", "Consultant fee", "Legal retainer"),
                    "UTILITIES": pick("AWS", "Adobe CC", "Zoom", "Slack", "GitHub"),
                }[cat]
                r = post("/transactions", {
                    "card_id": card_id, "amount": rndint(500, 25000),
                    "description": merch, "category": cat,
                    "transaction_date": dstr(cur_date + timedelta(days=rndint(1, 28))),
                }, tok)
                if ok(r): cc_tx_count += 1
    record(cc_tx_count); log(f"✓ {cc_tx_count} CC transactions")

    section("Investments")
    for inv in [
        {"name": "Parag Parikh Flexi Cap",   "investment_type": "MUTUAL_FUND", "invested_amount": 350000,
         "current_value": 448000, "is_sip": True, "sip_amount": 15000, "sip_status": "ACTIVE"},
        {"name": "Bitcoin",                  "investment_type": "CRYPTO",      "invested_amount": 280000,
         "current_value": 420000, "is_sip": False},
        {"name": "Ethereum",                 "investment_type": "CRYPTO",      "invested_amount": 120000,
         "current_value": 98000,  "is_sip": False},  # loss
        {"name": "NIFTY Next 50 ETF",        "investment_type": "ETF",         "invested_amount": 200000,
         "current_value": 256000, "is_sip": False},
        {"name": "Zerodha Stocks Portfolio", "investment_type": "STOCKS",      "invested_amount": 450000,
         "current_value": 612000, "is_sip": False},
        {"name": "SGB — Series XI",          "investment_type": "SGB",         "invested_amount": 180000,
         "current_value": 240000, "is_sip": False, "is_locked": True},
    ]:
        r = post("/investments", inv, tok); record() if ok(r) else None

    section("Insurance")
    for ins in [
        {"insurance_type": "HEALTH", "policy_name": "Niva Bupa ReAssure 10L",
         "insurer": "Niva Bupa", "premium_amount": 22000, "premium_frequency": "YEARLY",
         "sum_assured": 1000000, "cover_amount": 1000000,
         "renewal_date": dstr(date.today() + timedelta(days=95)), "is_active": True},
        {"insurance_type": "TERM", "policy_name": "ICICI Prudential iProtect Smart",
         "insurer": "ICICI Prudential", "premium_amount": 28000, "premium_frequency": "YEARLY",
         "sum_assured": 20000000, "cover_amount": 20000000,
         "renewal_date": dstr(date.today() + timedelta(days=250)), "is_active": True},
    ]:
        r = post("/insurance", ins, tok); record() if ok(r) else None

    section("Goals")
    for g in [
        {"name": "₹1 Cr by 35",         "goal_type": "INVESTMENT",
         "target_amount": 10000000, "current_amount": 2074000, "monthly_contribution": 30000,
         "target_date": dstr(months_ago(-60)), "priority": "HIGH"},
        {"name": "Emergency Fund 6M",   "goal_type": "EMERGENCY_FUND",
         "target_amount": 1800000, "current_amount": 605000, "monthly_contribution": 25000,
         "target_date": dstr(months_ago(-24)), "priority": "HIGH"},
        {"name": "Bali + Maldives Trip","goal_type": "VACATION",
         "target_amount": 400000, "current_amount": 180000, "monthly_contribution": 15000,
         "target_date": dstr(months_ago(-12)), "priority": "MEDIUM"},
    ]:
        r = post("/goals", g, tok); record() if ok(r) else None

    section("Assets")
    for a in [
        {"name": "Studio Apartment — Bandra",   "asset_type": "REAL_ESTATE",
         "purchase_price": 8500000, "current_value": 11200000,
         "purchase_date": dstr(months_ago(36))},
        {"name": "Royal Enfield Interceptor 650","asset_type": "VEHICLE",
         "purchase_price": 280000, "current_value": 210000,
         "purchase_date": dstr(months_ago(20)), "is_insured": True},
    ]:
        r = post("/assets", a, tok); record() if ok(r) else None

    section("Friends / Split")
    vikram_friend_ids = {}
    for f in [
        {"name": "Rahul Verma", "notes": "Dubai trip split"},
        {"name": "Siya Shah",   "notes": "Office party expenses"},
        {"name": "Dev Nair",    "notes": "I owe him for coworking"},
    ]:
        r = post("/friends", f, tok)
        if ok(r): d = r.json(); vikram_friend_ids[d["name"]] = d["id"]; record()

    for fname, amount, product in [
        ("Rahul Verma", 22000, "Dubai trip share"),
        ("Siya Shah",   8000,  "Office party expenses"),
    ]:
        fid = vikram_friend_ids.get(fname)
        if fid:
            r = post("/emis", {
                "friend_id": fid, "product_name": product,
                "purchase_date": dstr(months_ago(2)),
                "total_amount": amount, "purchase_amount": amount,
                "monthly_emi": amount, "tenure_months": 1,
                "interest_rate": 0, "is_no_cost_emi": True,
                "owner_type": "SHARED",
            }, tok)
            if ok(r): record()

    get("/net-worth/snapshot", tok)
    post("/net-worth/snapshots", {}, tok)
    log("✓ Vikram Rao seeded completely")


# ══════════════════════════════════════════════════════════════════════════════
# USER 4 — Meera Krishnan: Heavy investor + crypto, Chennai
# Senior PM, ₹2.4L/mo, aggressive investing, market crash exposure
# ══════════════════════════════════════════════════════════════════════════════
def seed_meera():
    print("\n╔══════════════════════════════════════════════╗")
    print("║  USER 4: Meera Krishnan — Investor, Chennai   ║")
    print("╚══════════════════════════════════════════════╝")

    tok = register_and_login("Meera Krishnan", "meera@mycfo.in", "meera", "Meera@1234")
    if not tok: return
    log("✓ Registered & logged in")

    section("Bank Accounts")
    accs = {}
    for acc in [
        {"nickname": "Axis Salary A/C", "bank_name": "Axis Bank",  "account_type": "SALARY",
         "account_number_last4": "2233", "current_balance": 320000, "is_primary": True},
        {"nickname": "HDFC Savings",    "bank_name": "HDFC Bank", "account_type": "SAVINGS",
         "account_number_last4": "0001", "current_balance": 580000},
        {"nickname": "Axis FD 16M",     "bank_name": "Axis Bank",  "account_type": "FD",
         "account_number_last4": "0002", "current_balance": 1000000,
         "maturity_amount": 1147000, "interest_rate": 7.25,
         "maturity_date": (date.today() + timedelta(days=500)).isoformat()},
    ]:
        r = post("/bank-accounts", acc, tok)
        if ok(r): d = r.json(); accs[d["account_type"]] = d["id"]; record()

    salary_acc = accs.get("SALARY") or list(accs.values())[0]

    section("Income Sources")
    for inc in [
        {"name": "Freshworks — Senior PM", "income_type": "SALARY", "monthly_amount": 240000,
         "tax_deducted_pct": 25, "is_active": True},
        {"name": "Angel Investing Returns",  "income_type": "DIVIDEND", "monthly_amount": 12000,
         "tax_deducted_pct": 10, "is_active": True},
    ]:
        r = post("/income/sources", inc, tok); record() if ok(r) else None

    section("Bank Transactions (5 years)")
    start_date = months_ago(60)
    today = date.today()
    tx_count = 0
    for mn, cur_date in enumerate(date_range(start_date, today, step_days=30)):
        salary = 180000 + (mn // 12) * 18000
        txs = [
            {"amount": salary, "tx_type": "CREDIT",
             "description": "NEFT-FRESHWORKS-SALARY", "category": "SALARY",
             "transaction_date": dstr(cur_date + timedelta(days=1))},
            {"amount": rndint(60000, 90000), "tx_type": "DEBIT",
             "description": "SIP / Investment transfer — Zerodha",
             "category": "INVESTMENT", "transaction_date": dstr(cur_date + timedelta(days=3))},
            {"amount": 28000, "tx_type": "DEBIT",
             "description": "RENT — RA PURAM CHENNAI",
             "category": "RENT", "transaction_date": dstr(cur_date + timedelta(days=2))},
        ]
        for _ in range(rndint(5, 12)):
            txs.append({"amount": rndint(200, 5000), "tx_type": "DEBIT",
                          "description": pick("Swiggy", "Zomato", "DMart", "BookMyShow", "Spotify"),
                          "category": pick("FOOD", "ENTERTAINMENT", "SHOPPING"),
                          "transaction_date": dstr(cur_date + timedelta(days=rndint(1, 28)))})
        # Market crash months — extra withdrawals
        if cur_date.month in (3, 4) and cur_date.year in (2020, 2022, 2024):
            txs.append({"amount": rndint(50000, 120000), "tx_type": "DEBIT",
                          "description": "CRYPTO/STOCK PURCHASE — MARKET DIP",
                          "category": "INVESTMENT",
                          "transaction_date": dstr(cur_date + timedelta(days=15))})
        for tx in txs:
            r = post(f"/bank-accounts/{salary_acc}/transactions", tx, tok)
            if ok(r): tx_count += 1
    record(tx_count); log(f"✓ {tx_count} bank transactions")

    section("Credit Cards")
    cards = {}
    for card in [
        {"nickname": "Axis Magnus World",  "bank_name": "Axis Bank",  "last_four": "1122",
         "credit_limit": 1000000, "current_outstanding": 28000, "billing_cycle_day": 7, "due_date_day": 28},
        {"nickname": "HDFC Infinia Metal", "bank_name": "HDFC Bank",  "last_four": "5599",
         "credit_limit": 1500000, "current_outstanding": 15000, "billing_cycle_day": 14, "due_date_day": 5},
    ]:
        r = post("/cards", card, tok)
        if ok(r): d = r.json(); cards[d["nickname"]] = d["id"]; record()

    cc_tx_count = 0
    for card_id in list(cards.values()):
        for _, cur_date in enumerate(date_range(months_ago(48), today, step_days=30)):
            for _ in range(rndint(6, 14)):
                cat = pick("TRAVEL", "SHOPPING", "FOOD", "HEALTHCARE", "OTHER")
                r = post("/transactions", {
                    "card_id": card_id, "amount": rndint(500, 20000),
                    "description": pick("Taj Coromandel", "Nykaa", "Indigo", "Decathlon", "Cult.fit"),
                    "category": cat,
                    "transaction_date": dstr(cur_date + timedelta(days=rndint(1, 28))),
                }, tok)
                if ok(r): cc_tx_count += 1
    record(cc_tx_count); log(f"✓ {cc_tx_count} CC transactions")

    section("Investments — Heavy Portfolio")
    for inv in [
        {"name": "Mirae Asset Large & Midcap", "investment_type": "MUTUAL_FUND", "invested_amount": 800000,
         "current_value": 1120000, "is_sip": True, "sip_amount": 20000, "sip_status": "ACTIVE"},
        {"name": "Quant Small Cap Fund",        "investment_type": "MUTUAL_FUND", "invested_amount": 400000,
         "current_value": 620000, "is_sip": True, "sip_amount": 10000, "sip_status": "ACTIVE"},
        {"name": "Bitcoin",                     "investment_type": "CRYPTO",      "invested_amount": 500000,
         "current_value": 840000, "is_sip": False},
        {"name": "Ethereum + Polygon",          "investment_type": "CRYPTO",      "invested_amount": 280000,
         "current_value": 210000, "is_sip": False},  # loss position
        {"name": "NIFTY 50 Direct ETF",         "investment_type": "ETF",         "invested_amount": 320000,
         "current_value": 415000, "is_sip": True, "sip_amount": 8000, "sip_status": "ACTIVE"},
        {"name": "TCS Stocks",                  "investment_type": "STOCKS",      "invested_amount": 600000,
         "current_value": 920000, "is_sip": False},
        {"name": "Infosys Stocks",              "investment_type": "STOCKS",      "invested_amount": 450000,
         "current_value": 580000, "is_sip": False},
        {"name": "EPF — Freshworks",            "investment_type": "EPF",         "invested_amount": 480000,
         "current_value": 558000, "is_sip": True, "sip_amount": 20000, "sip_status": "ACTIVE", "is_locked": True},
        {"name": "NPS Tier 1",                  "investment_type": "NPS",         "invested_amount": 240000,
         "current_value": 298000, "is_sip": True, "sip_amount": 10000, "sip_status": "ACTIVE", "is_locked": True},
        {"name": "SGB — RBI 2021",              "investment_type": "SGB",         "invested_amount": 250000,
         "current_value": 340000, "is_sip": False, "is_locked": True},
        {"name": "Bonds — 54EC NHAI",           "investment_type": "BONDS",       "invested_amount": 500000,
         "current_value": 500000, "is_sip": False, "is_locked": True},
    ]:
        r = post("/investments", inv, tok); record() if ok(r) else None

    section("Insurance")
    for ins in [
        {"insurance_type": "HEALTH", "policy_name": "Aditya Birla Activ Assure 15L",
         "insurer": "Aditya Birla Health", "premium_amount": 35000, "premium_frequency": "YEARLY",
         "sum_assured": 1500000, "cover_amount": 1500000,
         "renewal_date": dstr(date.today() + timedelta(days=330)), "is_active": True},
        {"insurance_type": "TERM", "policy_name": "Max Life Smart Secure Plus",
         "insurer": "Max Life", "premium_amount": 24000, "premium_frequency": "YEARLY",
         "sum_assured": 20000000, "cover_amount": 20000000,
         "renewal_date": dstr(date.today() + timedelta(days=200)), "is_active": True},
    ]:
        r = post("/insurance", ins, tok); record() if ok(r) else None

    section("Goals")
    for g in [
        {"name": "₹5 Cr Corpus by 40",     "goal_type": "INVESTMENT",
         "target_amount": 50000000, "current_amount": 5501000, "monthly_contribution": 68000,
         "target_date": dstr(months_ago(-96)), "priority": "HIGH"},
        {"name": "Emergency Fund",          "goal_type": "EMERGENCY_FUND",
         "target_amount": 1500000, "current_amount": 900000, "monthly_contribution": 0,
         "priority": "HIGH"},
        {"name": "House Purchase — Chennai","goal_type": "HOUSE",
         "target_amount": 8000000, "current_amount": 1200000, "monthly_contribution": 30000,
         "target_date": dstr(months_ago(-48)), "priority": "MEDIUM"},
    ]:
        r = post("/goals", g, tok); record() if ok(r) else None

    section("Assets")
    for a in [
        {"name": "Gold Coins 100g",         "asset_type": "JEWELRY",
         "purchase_price": 450000, "current_value": 620000, "purchase_date": dstr(months_ago(36))},
        {"name": "MacBook Pro M3 Max",      "asset_type": "ELECTRONICS",
         "purchase_price": 280000, "current_value": 200000, "purchase_date": dstr(months_ago(12))},
    ]:
        r = post("/assets", a, tok); record() if ok(r) else None

    get("/net-worth/snapshot", tok)
    post("/net-worth/snapshots", {}, tok)
    log("✓ Meera Krishnan seeded completely")


# ══════════════════════════════════════════════════════════════════════════════
# USER 5 — Suresh Pillai: Debt-stressed, Hyderabad
# ₹85K salary, overextended EMIs, CC maxed, personal loans, minimal savings
# ══════════════════════════════════════════════════════════════════════════════
def seed_suresh():
    print("\n╔══════════════════════════════════════════════╗")
    print("║  USER 5: Suresh Pillai — Debt-Stressed, Hyd  ║")
    print("╚══════════════════════════════════════════════╝")

    tok = register_and_login("Suresh Pillai", "suresh@mycfo.in", "suresh", "Suresh@1234")
    if not tok: return
    log("✓ Registered & logged in")

    section("Bank Accounts")
    accs = {}
    for acc in [
        {"nickname": "SBI Salary A/C",     "bank_name": "SBI",             "account_type": "SALARY",
         "account_number_last4": "0001",  "current_balance": 12000, "is_primary": True},
        {"nickname": "Airtel Money Wallet","bank_name": "Airtel Payments",  "account_type": "WALLET",
         "account_number_last4": "0001",  "current_balance": 3500},
    ]:
        r = post("/bank-accounts", acc, tok)
        if ok(r): d = r.json(); accs[d["account_type"]] = d["id"]; record()

    salary_acc = accs.get("SALARY") or list(accs.values())[0]

    section("Income Sources")
    r = post("/income/sources", {"name": "Wipro — Associate Engineer", "income_type": "SALARY",
                          "monthly_amount": 85000, "tax_deducted_pct": 10,
                          "is_active": True}, tok)
    if ok(r): record()

    section("Bank Transactions (3 years — stressed)")
    start_date = months_ago(36)
    today = date.today()
    tx_count = 0
    for mn, cur_date in enumerate(date_range(start_date, today, step_days=30)):
        salary = 75000 + (mn // 12) * 5000
        txs = [
            {"amount": salary, "tx_type": "CREDIT",
             "description": "NEFT-WIPRO SALARY", "category": "SALARY",
             "transaction_date": dstr(cur_date + timedelta(days=1))},
            {"amount": 15000, "tx_type": "DEBIT", "description": "HOME LOAN EMI SBI",
             "category": "EMI_PAYMENT", "transaction_date": dstr(cur_date + timedelta(days=3))},
            {"amount": 8500,  "tx_type": "DEBIT", "description": "PERSONAL LOAN EMI",
             "category": "EMI_PAYMENT", "transaction_date": dstr(cur_date + timedelta(days=4))},
            {"amount": 5200,  "tx_type": "DEBIT", "description": "CC MIN PAYMENT HDFC",
             "category": "EMI_PAYMENT", "transaction_date": dstr(cur_date + timedelta(days=5))},
            {"amount": 12000, "tx_type": "DEBIT", "description": "RENT — KONDAPUR 1BHK",
             "category": "RENT", "transaction_date": dstr(cur_date + timedelta(days=2))},
            {"amount": rndint(6000, 12000), "tx_type": "DEBIT",
             "description": pick("BigBasket", "Zepto", "DMart"), "category": "FOOD",
             "transaction_date": dstr(cur_date + timedelta(days=rndint(5, 25)))},
        ]
        # Occasional cash advances / payday issues
        if salary - 15000 - 8500 - 5200 - 12000 < 15000:
            txs.append({"amount": rndint(5000, 20000), "tx_type": "DEBIT",
                          "description": "ATM WITHDRAWAL / CASH ADVANCE",
                          "category": "ATM_WITHDRAWAL",
                          "transaction_date": dstr(cur_date + timedelta(days=20))})
        for tx in txs:
            r = post(f"/bank-accounts/{salary_acc}/transactions", tx, tok)
            if ok(r): tx_count += 1
    record(tx_count); log(f"✓ {tx_count} bank transactions")

    section("Credit Cards — Near Maxed")
    cards = {}
    for card in [
        {"nickname": "HDFC Millennia",   "bank_name": "HDFC Bank",  "last_four": "6610",
         "credit_limit": 100000, "current_outstanding": 94000, "billing_cycle_day": 15, "due_date_day": 5},
        {"nickname": "SBI SimplySave",   "bank_name": "SBI",        "last_four": "4423",
         "credit_limit": 80000,  "current_outstanding": 76000, "billing_cycle_day": 20, "due_date_day": 10},
        {"nickname": "Flipkart Axis CC", "bank_name": "Axis Bank",  "last_four": "9921",
         "credit_limit": 50000,  "current_outstanding": 48500, "billing_cycle_day": 25, "due_date_day": 15},
    ]:
        r = post("/cards", card, tok)
        if ok(r): d = r.json(); cards[d["nickname"]] = d["id"]; record()

    cc_tx_count = 0
    cc_start = months_ago(24)
    for card_id in list(cards.values()):
        for _, cur_date in enumerate(date_range(cc_start, today, step_days=30)):
            for _ in range(rndint(10, 20)):
                r = post("/transactions", {
                    "card_id": card_id, "amount": rndint(200, 5000),
                    "description": pick("Swiggy", "Amazon", "Flipkart", "Blinkit", "Petrol"),
                    "category": pick("FOOD", "SHOPPING", "UTILITIES"),
                    "transaction_date": dstr(cur_date + timedelta(days=rndint(1, 28))),
                }, tok)
                if ok(r): cc_tx_count += 1
    record(cc_tx_count); log(f"✓ {cc_tx_count} CC transactions")

    section("Loans — Overextended")
    for l in [
        {"lender_name": "SBI", "loan_type": "HOME", "principal_amount": 1800000,
         "outstanding_balance": 1620000, "interest_rate": 9.1, "emi_amount": 16200,
         "tenure_months": 240, "start_date": dstr(months_ago(18)),
         "emi_due_day": 5, 
         "is_secured": True, "status": "ACTIVE"},
        {"lender_name": "Bajaj Finance", "loan_type": "PERSONAL", "principal_amount": 400000,
         "outstanding_balance": 320000, "interest_rate": 16.5, "emi_amount": 9800,
         "tenure_months": 48, "start_date": dstr(months_ago(12)),
         "emi_due_day": 5, 
         "is_secured": False, "status": "ACTIVE"},
        {"lender_name": "Navi App", "loan_type": "PERSONAL", "principal_amount": 100000,
         "outstanding_balance": 85000, "interest_rate": 22.0, "emi_amount": 4500,
         "tenure_months": 24, "start_date": dstr(months_ago(8)),
         "emi_due_day": 5, 
         "is_secured": False, "status": "ACTIVE"},
        {"lender_name": "Colleague — Ravi", "loan_type": "INFORMAL", "principal_amount": 50000,
         "outstanding_balance": 50000, "interest_rate": 0, "emi_amount": 0,
         "tenure_months": 12, "start_date": dstr(months_ago(3)),
         "is_secured": False, "status": "ACTIVE"},
    ]:
        r = post("/loans", l, tok); record() if ok(r) else None

    section("Investments — Minimal")
    for inv in [
        {"name": "EPF — Wipro",    "investment_type": "EPF", "invested_amount": 85000,
         "current_value": 95000, "is_sip": True, "sip_amount": 4200, "sip_status": "ACTIVE", "is_locked": True},
        {"name": "LIC Endowment", "investment_type": "BONDS", "invested_amount": 36000,
         "current_value": 38000, "is_sip": True, "sip_amount": 3000, "sip_status": "ACTIVE"},
    ]:
        r = post("/investments", inv, tok); record() if ok(r) else None

    section("Insurance")
    # Only one basic policy — no health insurance (critical gap)
    r = post("/insurance", {
        "insurance_type": "LIFE", "policy_name": "LIC Jeevan Umang",
        "insurer": "LIC", "premium_amount": 18000, "premium_frequency": "YEARLY",
        "sum_assured": 500000, "cover_amount": 500000,
        "renewal_date": dstr(date.today() + timedelta(days=15)), "is_active": True,
    }, tok)
    if ok(r): record()

    section("Goals")
    for g in [
        {"name": "Pay off Personal Loans", "goal_type": "DEBT_FREE",
         "target_amount": 455000, "current_amount": 0, "monthly_contribution": 5000,
         "target_date": dstr(months_ago(-24)), "priority": "HIGH"},
        {"name": "Emergency Fund",         "goal_type": "EMERGENCY_FUND",
         "target_amount": 300000, "current_amount": 12000, "monthly_contribution": 2000,
         "target_date": dstr(months_ago(-30)), "priority": "HIGH"},
    ]:
        r = post("/goals", g, tok); record() if ok(r) else None

    section("Friends / Money Owed")
    suresh_friend_ids = {}
    for f in [
        {"name": "Ravi (colleague)",   "notes": "Borrowed for medical emergency"},
        {"name": "Preethi (sister)",   "notes": "Borrowed for bike repair"},
        {"name": "Landlord (advance)", "notes": "Security deposit"},
    ]:
        r = post("/friends", f, tok)
        if ok(r): d = r.json(); suresh_friend_ids[d["name"]] = d["id"]; record()

    # Landlord advance — Suresh is owed ₹24K security deposit
    for fname, amount, product in [
        ("Landlord (advance)", 24000, "Security deposit receivable"),
    ]:
        fid = suresh_friend_ids.get(fname)
        if fid:
            r = post("/emis", {
                "friend_id": fid, "product_name": product,
                "purchase_date": dstr(months_ago(6)),
                "total_amount": amount, "purchase_amount": amount,
                "monthly_emi": amount, "tenure_months": 1,
                "interest_rate": 0, "is_no_cost_emi": True,
                "owner_type": "SHARED",
            }, tok)
            if ok(r): record()

    section("EMIs — Multiple active")
    for e in [
        {"product_name": "Realme 11 Pro",    "purchase_date": dstr(months_ago(8)),
         "total_amount": 28000, "purchase_amount": 28000, "monthly_emi": 2800,
         "tenure_months": 10, "interest_rate": 0, "is_no_cost_emi": True},
        {"product_name": "AC — Voltas 1.5T", "purchase_date": dstr(months_ago(14)),
         "total_amount": 42000, "purchase_amount": 42000, "monthly_emi": 3800,
         "tenure_months": 12, "interest_rate": 16.0},
    ]:
        r = post("/emis", e, tok); record() if ok(r) else None

    get("/net-worth/snapshot", tok)
    post("/net-worth/snapshots", {}, tok)
    log("✓ Suresh Pillai seeded completely")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main():
    global BASE_URL, VERBOSE
    parser = argparse.ArgumentParser(description="Seed realistic demo data for My CFO")
    parser.add_argument("--base-url", default=BASE_URL)
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--user", choices=["arjun","priya","vikram","meera","suresh","all"],
                        default="all", help="Which user to seed")
    args = parser.parse_args()
    BASE_URL = args.base_url
    VERBOSE  = args.verbose

    print("╔══════════════════════════════════════════════════════╗")
    print("║           MY CFO — DEMO DATA SEEDER                  ║")
    print("║  5 Users × 3–5 Years of Realistic Financial Data     ║")
    print("╚══════════════════════════════════════════════════════╝")
    print(f"  Target: {BASE_URL}")

    t0 = time.time()
    seeders = {
        "arjun": seed_arjun,
        "priya": seed_priya,
        "vikram": seed_vikram,
        "meera": seed_meera,
        "suresh": seed_suresh,
    }

    if args.user == "all":
        for fn in seeders.values():
            fn()
    else:
        seeders[args.user]()

    elapsed = round(time.time() - t0, 1)
    print(f"\n╔══════════════════════════════════════════════════════╗")
    print(f"║  ✓ Seeding Complete                                   ║")
    print(f"║  Records: {total_records:<10}  Elapsed: {elapsed}s{' '*(13-len(str(elapsed)))}║")
    print(f"╚══════════════════════════════════════════════════════╝")
    print(f"\n  Users created:")
    print(f"    arjun / Arjun@1234  — Salaried SE, Bangalore")
    print(f"    priya / Priya@1234  — Married family, Pune")
    print(f"    vikram / Vikram@1234 — Freelancer, Mumbai")
    print(f"    meera / Meera@1234  — Heavy investor, Chennai")
    print(f"    suresh / Suresh@1234 — Debt-stressed, Hyderabad")

if __name__ == "__main__":
    main()
