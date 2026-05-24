#!/usr/bin/env python3
"""
QA Data Seeder — 5 years of realistic Indian personal finance data.
Usage: python3 scripts/seed_qa_data.py <access_token>
All field names verified against actual Pydantic schemas.
"""
import sys, json, random, datetime, time
import urllib.request, urllib.error

TOKEN = sys.argv[1] if len(sys.argv) > 1 else ""
BASE = "http://localhost:4000/api/v1"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

TODAY = datetime.date.today()
START = TODAY - datetime.timedelta(days=5*365)

ERRORS = []

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        msg = f"{method} {path} → {e.code}: {err[:200]}"
        ERRORS.append(msg)
        print(f"  ⚠️  {msg}")
        return None

def fmt(d): return d.isoformat() if isinstance(d, datetime.date) else d
def rand_date(start, end):
    delta = (end - start).days
    return start + datetime.timedelta(days=random.randint(0, max(delta, 0)))

print("\n═══════════════════════════════════════════════════════")
print("  MY CFO — QA Data Seeder (5 Years, Schema-Verified)")
print("═══════════════════════════════════════════════════════\n")

# ─── 1. CREDIT CARDS ────────────────────────────────────────────────────────
print("📳 Creating credit cards...")
cards = {}
card_defs = [
    {"nickname": "HDFC Regalia", "bank_name": "HDFC Bank", "credit_limit": 500000, "last_four": "4521", "network": "VISA"},
    {"nickname": "ICICI Amazon Pay", "bank_name": "ICICI Bank", "credit_limit": 200000, "last_four": "7832", "network": "VISA"},
    {"nickname": "Axis Magnus", "bank_name": "Axis Bank", "credit_limit": 1000000, "last_four": "1193", "network": "MASTERCARD"},
    {"nickname": "SBI SimplyCLICK", "bank_name": "SBI", "credit_limit": 150000, "last_four": "3344", "network": "MASTERCARD"},
]
for cd in card_defs:
    r = api("POST", "/cards", {
        "nickname": cd["nickname"],
        "bank_name": cd["bank_name"],
        "credit_limit": cd["credit_limit"],
        "last_four": cd["last_four"],
        "network": cd["network"],
        "billing_cycle_day": random.randint(1, 25),
        "due_date_day": random.randint(15, 28),
        "current_outstanding": random.randint(5000, 80000),
        "card_color": random.choice(["#6366f1","#F97316","#0EA5E9","#10B981"]),
    })
    if r:
        cards[cd["nickname"]] = r["id"]
        print(f"   ✅ {cd['nickname']} — ₹{cd['credit_limit']:,} limit")

# ─── 2. BANK ACCOUNTS ───────────────────────────────────────────────────────
print("\n🏦 Creating bank accounts...")
accounts = {}
acct_defs = [
    {"nickname": "HDFC Salary", "bank_name": "HDFC Bank", "account_type": "SALARY", "current_balance": 245000},
    {"nickname": "ICICI Savings", "bank_name": "ICICI Bank", "account_type": "SAVINGS", "current_balance": 85000},
    {"nickname": "SBI FD", "bank_name": "SBI", "account_type": "FD", "current_balance": 1000000,
     "interest_rate": 7.1, "maturity_date": fmt(TODAY + datetime.timedelta(days=365))},
    {"nickname": "Paytm Wallet", "bank_name": "Paytm", "account_type": "WALLET", "current_balance": 4500},
    {"nickname": "HDFC Current", "bank_name": "HDFC Bank", "account_type": "CURRENT", "current_balance": 50000},
]
for ad in acct_defs:
    body = {
        "nickname": ad["nickname"], "bank_name": ad["bank_name"],
        "account_type": ad["account_type"], "current_balance": ad["current_balance"],
        "account_number_last4": str(random.randint(1000, 9999)),
    }
    if "interest_rate" in ad: body["interest_rate"] = ad["interest_rate"]
    if "maturity_date" in ad: body["maturity_date"] = ad["maturity_date"]
    r = api("POST", "/bank-accounts", body)
    if r:
        accounts[ad["nickname"]] = r["id"]
        print(f"   ✅ {ad['nickname']} — ₹{ad['current_balance']:,}")

# ─── 3. LOANS ───────────────────────────────────────────────────────────────
print("\n🏠 Creating loans...")
loans_ids = {}
loan_defs = [
    {"loan_type": "HOME", "lender_name": "HDFC Bank", "nickname": "HDFC Home Loan",
     "principal_amount": 7500000, "outstanding_balance": 5200000, "interest_rate": 8.5,
     "tenure_months": 240, "emi_amount": 65500, "is_secured": True,
     "is_floating_rate": True, "collateral": "3BHK Flat, Bangalore"},
    {"loan_type": "VEHICLE", "lender_name": "HDFC Bank", "nickname": "Honda City Loan",
     "principal_amount": 900000, "outstanding_balance": 380000, "interest_rate": 9.5,
     "tenure_months": 60, "emi_amount": 18900, "is_secured": True},
    {"loan_type": "PERSONAL", "lender_name": "ICICI Bank", "nickname": "ICICI Personal",
     "principal_amount": 500000, "outstanding_balance": 280000, "interest_rate": 14.0,
     "tenure_months": 48, "emi_amount": 13600},
]
for ld in loan_defs:
    start = fmt(rand_date(START, START + datetime.timedelta(days=400)))
    body = {k: v for k, v in ld.items()}
    body["start_date"] = start
    r = api("POST", "/loans", body)
    if r:
        loans_ids[ld["nickname"]] = r["id"]
        print(f"   ✅ {ld['nickname']} — ₹{ld['principal_amount']:,} @ {ld['interest_rate']}%")

# ─── 4. INVESTMENTS ─────────────────────────────────────────────────────────
print("\n📈 Creating investments...")
investments = {}

inv_defs = [
    {"name": "Reliance Industries", "investment_type": "STOCKS",
     "units": 150, "average_buy_price": 2450, "current_price": 2870,
     "purchase_date": fmt(rand_date(START, START + datetime.timedelta(days=365)))},
    {"name": "HDFC Bank Ltd", "investment_type": "STOCKS",
     "units": 200, "average_buy_price": 1580, "current_price": 1720,
     "purchase_date": fmt(rand_date(START, START + datetime.timedelta(days=365)))},
    {"name": "Infosys Ltd", "investment_type": "STOCKS",
     "units": 100, "average_buy_price": 1390, "current_price": 1620,
     "purchase_date": fmt(rand_date(START, START + datetime.timedelta(days=365)))},
    {"name": "TCS", "investment_type": "STOCKS",
     "units": 50, "average_buy_price": 3500, "current_price": 3850,
     "purchase_date": fmt(rand_date(START, START + datetime.timedelta(days=365)))},
    {"name": "Bajaj Finance", "investment_type": "STOCKS",
     "units": 75, "average_buy_price": 7200, "current_price": 7850,
     "purchase_date": fmt(rand_date(START, START + datetime.timedelta(days=365)))},
    # Mutual Funds
    {"name": "Axis Bluechip Fund — Direct Growth", "investment_type": "MUTUAL_FUND",
     "units": 5420.345, "average_buy_price": 42.50, "current_price": 56.80,
     "is_sip": True, "sip_amount": 10000,
     "purchase_date": fmt(START + datetime.timedelta(days=5))},
    {"name": "Mirae Asset Large Cap — Direct Growth", "investment_type": "MUTUAL_FUND",
     "units": 3200.123, "average_buy_price": 68.00, "current_price": 88.40,
     "is_sip": True, "sip_amount": 15000,
     "purchase_date": fmt(START + datetime.timedelta(days=5))},
    {"name": "HDFC Mid-Cap Opportunities — Direct", "investment_type": "MUTUAL_FUND",
     "units": 1850.765, "average_buy_price": 95.00, "current_price": 135.60,
     "is_sip": True, "sip_amount": 5000,
     "purchase_date": fmt(START + datetime.timedelta(days=5))},
    {"name": "Parag Parikh Flexi Cap — Direct", "investment_type": "MUTUAL_FUND",
     "units": 2100.432, "average_buy_price": 55.00, "current_price": 72.30,
     "is_sip": True, "sip_amount": 5000,
     "purchase_date": fmt(START + datetime.timedelta(days=5))},
    # SGB
    {"name": "SGB 2021-22 Series I", "investment_type": "SGB",
     "units": 10, "average_buy_price": 4850, "current_price": 6250,
     "coupon_rate": 2.5, "maturity_date": "2029-11-05",
     "purchase_date": "2021-11-05"},
    # Gold
    {"name": "Digital Gold — MMTC-PAMP", "investment_type": "GOLD",
     "units": 25.5, "average_buy_price": 4800, "current_price": 6300,
     "purchase_date": fmt(rand_date(START, START + datetime.timedelta(days=730)))},
    # ETF
    {"name": "Nippon Nifty 50 ETF", "investment_type": "ETF",
     "units": 500, "average_buy_price": 175, "current_price": 215,
     "purchase_date": fmt(rand_date(START, START + datetime.timedelta(days=365)))},
    # PPF
    {"name": "PPF — SBI Branch", "investment_type": "PPF",
     "units": 1, "average_buy_price": 850000, "current_price": 950000,
     "purchase_date": fmt(START)},
    # NPS
    {"name": "NPS Tier 1 — HDFC Pension", "investment_type": "NPS",
     "units": 1, "average_buy_price": 420000, "current_price": 510000,
     "is_sip": True, "sip_amount": 5000,
     "purchase_date": fmt(START)},
    # Crypto
    {"name": "Bitcoin (BTC)", "investment_type": "CRYPTO",
     "units": 0.15, "average_buy_price": 2800000, "current_price": 5500000,
     "purchase_date": fmt(rand_date(START, START + datetime.timedelta(days=730)))},
    {"name": "Ethereum (ETH)", "investment_type": "CRYPTO",
     "units": 2.5, "average_buy_price": 150000, "current_price": 280000,
     "purchase_date": fmt(rand_date(START, START + datetime.timedelta(days=730)))},
    # REITs
    {"name": "Embassy Office Parks REIT", "investment_type": "REITS",
     "units": 200, "average_buy_price": 340, "current_price": 370,
     "purchase_date": fmt(rand_date(START, START + datetime.timedelta(days=365)))},
]

for iv in inv_defs:
    body = dict(iv)
    body["invested_amount"] = body["units"] * body["average_buy_price"]
    body["current_value"]   = body["units"] * body["current_price"]
    body.setdefault("is_sip", False)
    r = api("POST", "/investments", body)
    if r:
        investments[iv["name"]] = r["id"]
        pnl = (iv["current_price"] - iv["average_buy_price"]) * iv["units"]
        print(f"   ✅ {iv['name']} — P&L ₹{pnl:,.0f}")

# ─── 5. ASSETS ──────────────────────────────────────────────────────────────
print("\n🏘️  Creating assets...")
asset_defs = [
    {"asset_type": "REAL_ESTATE", "name": "3BHK Flat — Whitefield, Bangalore",
     "current_value": 12500000, "purchase_price": 8500000,
     "purchase_date": fmt(START + datetime.timedelta(days=180)),
     "location": "Whitefield, Bangalore", "area_sqft": 1450,
     "is_mortgaged": True, "mortgage_outstanding": 5200000},
    {"asset_type": "VEHICLE", "name": "Honda City ZX 2022",
     "current_value": 950000, "purchase_price": 1350000,
     "purchase_date": "2022-04-15",
     "make_model": "Honda City ZX CVT", "year_of_manufacture": 2022,
     "depreciation_method": "DECLINING_BALANCE", "depreciation_rate": 15.0},
    {"asset_type": "JEWELRY", "name": "Gold Jewelry — Family",
     "current_value": 920000, "purchase_price": 650000,
     "purchase_date": fmt(START + datetime.timedelta(days=90))},
    {"asset_type": "ELECTRONICS", "name": "MacBook Pro M3 Max",
     "current_value": 165000, "purchase_price": 249000,
     "purchase_date": "2023-11-20",
     "depreciation_method": "STRAIGHT_LINE", "depreciation_rate": 25.0},
    {"asset_type": "RECEIVABLE", "name": "Loan to Rohan Verma",
     "current_value": 200000, "purchase_price": 200000,
     "purchase_date": fmt(TODAY - datetime.timedelta(days=120)),
     "notes": "Personal loan @ 12% p.a., due 6 months from disbursement"},
]
for ad in asset_defs:
    r = api("POST", "/assets", ad)
    if r: print(f"   ✅ {ad['name']} — ₹{ad['current_value']:,}")

# ─── 6. INCOME SOURCES ──────────────────────────────────────────────────────
print("\n💰 Creating income sources...")
income_defs = [
    {"name": "Salary — Infosys Ltd", "income_type": "SALARY",
     "monthly_amount": 180000, "employer": "Infosys Ltd",
     "tax_deducted_pct": 20.0, "is_active": True},
    {"name": "Freelance — Dev Projects", "income_type": "FREELANCE",
     "monthly_amount": 45000, "is_variable": True,
     "variable_min": 15000, "variable_max": 80000, "is_active": True},
    {"name": "Rental — HSR Layout Flat", "income_type": "RENTAL",
     "monthly_amount": 25000, "is_active": True},
    {"name": "Stock Dividends", "income_type": "DIVIDEND",
     "monthly_amount": 4000, "is_variable": True,
     "variable_min": 0, "variable_max": 20000, "is_active": True},
]
income_src_ids = []
for isd in income_defs:
    body = dict(isd)
    body["start_date"] = fmt(START)
    r = api("POST", "/income/sources", body)
    if r:
        income_src_ids.append(r["id"])
        print(f"   ✅ {isd['name']} — ₹{isd['monthly_amount']:,}/mo")
    else:
        income_src_ids.append(None)

print("   📊 Seeding 60 months of income entries...")
income_src_pairs = [(d, sid) for d, sid in zip(income_defs, income_src_ids) if sid]
entry_count = 0
for m in range(60):
    entry_date = START + datetime.timedelta(days=30*m + 1)
    if entry_date > TODAY: break
    for isd, sid in income_src_pairs:
        variation = random.uniform(0.90, 1.12)
        r = api("POST", "/income/entries", {
            "source_id": sid,
            "amount": round(isd["monthly_amount"] * variation, 0),
            "entry_date": fmt(entry_date),
            "notes": f"Month {m+1} income"
        })
        if r: entry_count += 1
print(f"   ✅ {entry_count} income entries created")

# ─── 7. INSURANCE ───────────────────────────────────────────────────────────
print("\n🛡️  Creating insurance policies...")
ins_defs = [
    {"insurance_type": "TERM_LIFE", "policy_name": "HDFC Life Click 2 Protect",
     "insurer": "HDFC Life", "premium_amount": 18000, "premium_frequency": "YEARLY",
     "sum_assured": 20000000},
    {"insurance_type": "HEALTH", "policy_name": "Star Health Family Floater",
     "insurer": "Star Health", "premium_amount": 35000, "premium_frequency": "YEARLY",
     "cover_amount": 2000000},
    {"insurance_type": "VEHICLE", "policy_name": "HDFC ERGO Motor Comprehensive",
     "insurer": "HDFC ERGO", "premium_amount": 8500, "premium_frequency": "YEARLY",
     "cover_amount": 1200000},
    {"insurance_type": "HOME", "policy_name": "New India Home Protector",
     "insurer": "New India Assurance", "premium_amount": 6000, "premium_frequency": "YEARLY",
     "cover_amount": 12000000},
]
for ins in ins_defs:
    body = dict(ins)
    body["start_date"] = fmt(rand_date(START, START + datetime.timedelta(days=365)))
    body["end_date"] = fmt(TODAY + datetime.timedelta(days=365))
    body["renewal_date"] = fmt(TODAY + datetime.timedelta(days=365))
    r = api("POST", "/insurance", body)
    if r: print(f"   ✅ {ins['policy_name']}")

# ─── 8. GOALS ───────────────────────────────────────────────────────────────
print("\n🎯 Creating financial goals...")
goal_defs = [
    {"name": "Emergency Fund 6 Months", "goal_type": "EMERGENCY",
     "target_amount": 1200000, "current_amount": 850000,
     "target_date": "2026-12-31", "priority": "HIGH", "monthly_contribution": 30000},
    {"name": "Europe Vacation 2027", "goal_type": "VACATION",
     "target_amount": 500000, "current_amount": 120000,
     "target_date": "2027-03-01", "priority": "MEDIUM", "monthly_contribution": 15000},
    {"name": "New Car Downpayment", "goal_type": "PURCHASE",
     "target_amount": 1500000, "current_amount": 400000,
     "target_date": "2028-01-01", "priority": "MEDIUM", "monthly_contribution": 20000},
    {"name": "Child Higher Education", "goal_type": "EDUCATION",
     "target_amount": 10000000, "current_amount": 1200000,
     "target_date": "2035-06-01", "priority": "HIGH", "monthly_contribution": 25000},
    {"name": "Retirement Corpus", "goal_type": "RETIREMENT",
     "target_amount": 50000000, "current_amount": 8500000,
     "target_date": "2045-01-01", "priority": "HIGH", "monthly_contribution": 50000},
]
for gd in goal_defs:
    r = api("POST", "/goals", gd)
    if r:
        pct = gd["current_amount"]/gd["target_amount"]*100
        print(f"   ✅ {gd['name']} — {pct:.0f}% funded")

# ─── 9. CREDIT CARD TRANSACTIONS (5 years × ~30/month) ──────────────────────
print("\n💳 Seeding credit card transactions...")
card_ids = list(cards.values())
if not card_ids:
    print("   ⚠️  No cards created — skipping card transactions")
else:
    # category must be valid CategoryType
    cc_categories = [
        ("Swiggy", "DINING"),
        ("Zomato Order", "DINING"),
        ("Amazon India", "SHOPPING"),
        ("Flipkart", "SHOPPING"),
        ("BigBasket", "GROCERIES"),
        ("DMart", "GROCERIES"),
        ("BookMyShow", "ENTERTAINMENT"),
        ("Netflix Subscription", "SUBSCRIPTION"),
        ("Spotify Premium", "SUBSCRIPTION"),
        ("Uber", "TRAVEL"),
        ("Ola Cab", "TRAVEL"),
        ("BESCOM Bill", "UTILITIES"),
        ("Airtel Postpaid", "UTILITIES"),
        ("Apollo Pharmacy", "HEALTHCARE"),
        ("Decathlon", "SHOPPING"),
        ("PVR Cinemas", "ENTERTAINMENT"),
        ("MakeMyTrip Flight", "TRAVEL"),
        ("IndiGo Airlines", "TRAVEL"),
        ("Taj Hotel Stay", "TRAVEL"),
        ("Reliance Petrol", "FUEL"),
        ("HP Petrol Pump", "FUEL"),
        ("Zepto Grocery", "GROCERIES"),
        ("Cult.fit", "HEALTHCARE"),
        ("Coursera", "EDUCATION"),
        ("H&M Fashion", "SHOPPING"),
    ]
    amt_ranges = {
        "DINING": (150, 1200), "SHOPPING": (500, 18000), "GROCERIES": (800, 6000),
        "ENTERTAINMENT": (300, 3500), "SUBSCRIPTION": (99, 649), "TRAVEL": (200, 45000),
        "UTILITIES": (400, 4000), "HEALTHCARE": (150, 8000), "FUEL": (1000, 5000),
        "EDUCATION": (999, 15000),
    }

    tx_count = 0
    for m in range(60):
        month_start = START + datetime.timedelta(days=30*m)
        if month_start > TODAY: break
        month_end = min(month_start + datetime.timedelta(days=29), TODAY)
        for _ in range(random.randint(22, 38)):
            merchant, cat = random.choice(cc_categories)
            mn, mx = amt_ranges.get(cat, (200, 3000))
            amt = round(random.uniform(mn, mx), 2)
            card_id = random.choice(card_ids)
            tx_date = rand_date(month_start, month_end)
            api("POST", "/transactions", {
                "card_id": card_id,
                "transaction_date": fmt(tx_date) + "T12:00:00",
                "description": f"{merchant} — UPI/Card",
                "merchant_name": merchant,
                "amount": amt,
                "category": cat,
                "transaction_type": "PURCHASE",
            })
            tx_count += 1
    print(f"   ✅ {tx_count} card transactions created")

# ─── 10. BANK TRANSACTIONS (5 years fixed + random) ─────────────────────────
print("\n🏦 Seeding bank transactions...")
acct_ids = list(accounts.values())
hdfc_id = accounts.get("HDFC Salary")
primary_id = hdfc_id or (acct_ids[0] if acct_ids else None)
bank_tx_count = 0

if primary_id:
    for m in range(60):
        month_start = START + datetime.timedelta(days=30*m)
        if month_start > TODAY: break
        month_end = min(month_start + datetime.timedelta(days=29), TODAY)

        # Fixed monthly recurring
        fixed_txs = [
            ("Salary credit — Infosys Ltd", "OTHER", 182000, "CREDIT"),
            ("Rent — HDFC Layout", "OTHER", 35000, "DEBIT"),
            ("EMI — HDFC Home Loan", "OTHER", 65500, "DEBIT"),
            ("SIP — Axis Bluechip", "OTHER", 10000, "DEBIT"),
            ("SIP — Mirae Large Cap", "OTHER", 15000, "DEBIT"),
            ("HDFC Life Premium", "OTHER", 1500, "DEBIT"),
            ("Star Health Premium", "OTHER", 2916, "DEBIT"),
        ]
        for desc, cat, amt, tx_type in fixed_txs:
            api("POST", f"/bank-accounts/{primary_id}/transactions", {
                "description": desc, "category": cat,
                "amount": float(amt), "tx_type": tx_type,
                "transaction_date": fmt(month_start + datetime.timedelta(days=1)) + "T09:00:00",
            })
            bank_tx_count += 1

        # Random variable transactions
        random_txs = [
            ("ATM Withdrawal", "OTHER", 5000, 20000, "DEBIT"),
            ("Grocery — Local Market", "OTHER", 800, 4000, "DEBIT"),
            ("BESCOM Electricity", "OTHER", 1200, 3500, "DEBIT"),
            ("CC Payment — HDFC Regalia", "OTHER", 8000, 75000, "DEBIT"),
            ("Freelance Transfer In", "OTHER", 25000, 70000, "CREDIT"),
            ("Rental Income", "OTHER", 24000, 26000, "CREDIT"),
            ("Medical Expense", "OTHER", 500, 8000, "DEBIT"),
            ("Dividend Credit", "OTHER", 2000, 15000, "CREDIT"),
            ("FD Interest — SBI", "OTHER", 14000, 18000, "CREDIT"),
            ("Tax Payment — Advance", "OTHER", 25000, 80000, "DEBIT"),
            ("Transfer to ICICI", "OTHER", 10000, 50000, "DEBIT"),
            ("UPI — Rohan Verma", "OTHER", 500, 5000, "DEBIT"),
            ("Zomato UPI", "OTHER", 200, 1200, "DEBIT"),
            ("Amazon UPI", "OTHER", 500, 8000, "DEBIT"),
            ("Indigo Flight UPI", "OTHER", 4000, 18000, "DEBIT"),
        ]
        for _ in range(random.randint(12, 20)):
            desc, cat, mn, mx, tx_type = random.choice(random_txs)
            amt = round(random.uniform(mn, mx), 2)
            acct_id = random.choice(acct_ids)
            api("POST", f"/bank-accounts/{acct_id}/transactions", {
                "description": desc, "category": cat,
                "amount": amt, "tx_type": tx_type,
                "transaction_date": fmt(rand_date(month_start, month_end)) + "T12:00:00",
            })
            bank_tx_count += 1

print(f"   ✅ {bank_tx_count} bank transactions created")

# ─── 11. INVESTMENT LEDGER (FIFO trail) ──────────────────────────────────────
print("\n📊 Seeding investment transaction ledger...")
inv_tx_count = 0

# Reliance: 6 BUYs, 2 SELLs, 3 dividends
reliance_id = investments.get("Reliance Industries")
if reliance_id:
    buys = [
        ("2021-06-15", 25, 1980), ("2021-11-20", 30, 2150),
        ("2022-03-10", 20, 2320), ("2022-08-05", 25, 2180),
        ("2023-01-15", 30, 2290), ("2023-09-20", 20, 2540),
    ]
    for dt, units, price in buys:
        if datetime.date.fromisoformat(dt) > TODAY: continue
        r = api("POST", f"/investments/{reliance_id}/transactions", {
            "tx_type": "BUY", "tx_date": dt,
            "units": units, "price_per_unit": price,
            "amount": units * price, "nav_source": "NSE"
        })
        if r: inv_tx_count += 1

    # Partial sell (FIFO — oldest lots first)
    for dt, units, price in [("2022-12-10", 25, 2450), ("2024-02-20", 30, 2780)]:
        if datetime.date.fromisoformat(dt) > TODAY: continue
        r = api("POST", f"/investments/{reliance_id}/transactions", {
            "tx_type": "SELL", "tx_date": dt,
            "units": units, "price_per_unit": price, "amount": units * price
        })
        if r: inv_tx_count += 1

    # Dividends
    for dt, amt in [("2022-06-30", 8000), ("2023-06-30", 9500), ("2024-06-30", 11000)]:
        if datetime.date.fromisoformat(dt) > TODAY: continue
        r = api("POST", f"/investments/{reliance_id}/transactions", {
            "tx_type": "DIVIDEND", "tx_date": dt,
            "units": 0, "price_per_unit": 0, "amount": amt
        })
        if r: inv_tx_count += 1

# Axis Bluechip: Monthly SIP 60 months
axis_id = investments.get("Axis Bluechip Fund — Direct Growth")
if axis_id:
    nav = 42.0
    for m in range(60):
        sip_date = START + datetime.timedelta(days=30*m + 5)
        if sip_date > TODAY: break
        nav = nav * (1 + 0.12/12) * random.uniform(0.97, 1.03)
        units = round(10000 / nav, 3)
        r = api("POST", f"/investments/{axis_id}/transactions", {
            "tx_type": "BUY", "tx_date": fmt(sip_date),
            "units": units, "price_per_unit": round(nav, 4),
            "amount": 10000, "is_sip_installment": True, "sip_installment_no": m + 1
        })
        if r: inv_tx_count += 1

# SGB: Semi-annual coupons
sgb_id = investments.get("SGB 2021-22 Series I")
if sgb_id:
    for yr in range(2022, 2027):
        for month_day, amt in [("05-05", 6062), ("11-05", 6062)]:
            coupon_date = f"{yr}-{month_day}"
            if datetime.date.fromisoformat(coupon_date) > TODAY: break
            api("POST", f"/investments/{sgb_id}/transactions", {
                "tx_type": "COUPON", "tx_date": coupon_date,
                "units": 0, "price_per_unit": 0, "amount": amt,
                "notes": f"Semi-annual coupon 2.5% on ₹48,500"
            })
            inv_tx_count += 1

# HDFC Bank stock: bonus shares + additional buys
hdfc_stock_id = investments.get("HDFC Bank Ltd")
if hdfc_stock_id:
    extra_buys = [
        ("2022-02-10", 50, 1450), ("2022-09-15", 40, 1600),
        ("2023-05-20", 30, 1650), ("2024-01-10", 30, 1590),
    ]
    for dt, units, price in extra_buys:
        if datetime.date.fromisoformat(dt) > TODAY: continue
        api("POST", f"/investments/{hdfc_stock_id}/transactions", {
            "tx_type": "BUY", "tx_date": dt,
            "units": units, "price_per_unit": price, "amount": units * price
        })
        inv_tx_count += 1
    # Bonus shares
    api("POST", f"/investments/{hdfc_stock_id}/transactions", {
        "tx_type": "BONUS", "tx_date": "2023-07-15",
        "units": 50, "price_per_unit": 0, "amount": 0,
        "notes": "1:4 bonus shares"
    })
    inv_tx_count += 1

print(f"   ✅ {inv_tx_count} investment ledger entries created")

# ─── 12. FRIENDS / LENDING ───────────────────────────────────────────────────
print("\n🤝 Creating friends / lending...")
friend_defs = [
    {"name": "Rohan Verma",  "phone": "9876543210", "relation": "FRIEND"},
    {"name": "Priya Nair",   "phone": "9988776655", "relation": "COLLEAGUE"},
    {"name": "Amit Kumar",   "phone": "8877665544", "relation": "FRIEND"},
    {"name": "Deepa Sharma", "phone": "7766554433", "relation": "FAMILY"},
]
for fd in friend_defs:
    r = api("POST", "/friends", {
        "name": fd["name"], "phone": fd["phone"],
        "email": f"{fd['name'].lower().replace(' ', '.')}@gmail.com",
        "relation": fd["relation"],
    })
    if r: print(f"   ✅ {fd['name']}")

# ─── 13. EMIs ────────────────────────────────────────────────────────────────
print("\n📅 Creating EMIs...")
first_card_id = list(cards.values())[0] if cards else None
if first_card_id:
    emi_defs = [
        {"product_name": "Apple iPhone 15 Pro Max", "purchase_amount": 159900,
         "total_amount": 159900, "monthly_emi": 13325, "tenure_months": 12,
         "is_no_cost_emi": True, "merchant_name": "Apple Store"},
        {"product_name": "LG OLED 65\" C3 TV", "purchase_amount": 195000,
         "total_amount": 209000, "monthly_emi": 11611, "tenure_months": 18,
         "interest_rate": 14.0, "merchant_name": "Croma"},
        {"product_name": "Samsung 9kg Washing Machine", "purchase_amount": 75000,
         "total_amount": 75000, "monthly_emi": 12500, "tenure_months": 6,
         "is_no_cost_emi": True, "merchant_name": "Reliance Digital"},
    ]
    for ed in emi_defs:
        body = dict(ed)
        body["card_id"] = first_card_id
        body["purchase_date"] = fmt(rand_date(
            TODAY - datetime.timedelta(days=ed["tenure_months"]*30 + 30),
            TODAY - datetime.timedelta(days=30)
        )) + "T00:00:00"
        r = api("POST", "/emis", body)
        if r: print(f"   ✅ {ed['product_name']} — ₹{ed['monthly_emi']:,}/mo × {ed['tenure_months']}")

# ─── SUMMARY ─────────────────────────────────────────────────────────────────
print(f"\n{'═'*55}")
print(f"  ✅ QA Data Seeding Complete")
print(f"  Total API errors: {len(ERRORS)}")
if ERRORS:
    print(f"\n  ⚠️  Error log:")
    for e in ERRORS[:20]:
        print(f"    • {e}")
print(f"{'═'*55}\n")
