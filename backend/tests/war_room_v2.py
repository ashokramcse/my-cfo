"""
╔══════════════════════════════════════════════════════════════╗
║       MY CFO — WAR ROOM TEST v2 (schema-corrected)          ║
║  10 Users · 12 Months · All Modules · Security · Bugs       ║
╚══════════════════════════════════════════════════════════════╝
"""
import asyncio, sys, random, uuid
from datetime import date, datetime, timedelta, timezone
sys.path.insert(0, "/app")

from httpx import AsyncClient, ASGITransport
from app.main import app

BASE = "http://test"
BUGS: list[dict] = []

G="\033[92m"; R="\033[91m"; Y="\033[93m"; B="\033[94m"; M="\033[95m"; NC="\033[0m"
def ok(m):   print(f"  {G}✓{NC} {m}")
def fail(m): print(f"  {R}✗{NC} {m}")
def warn(m): print(f"  {Y}⚠{NC} {m}")
def info(m): print(f"  {B}→{NC} {m}")
def bug(mod, sev, cat, prob, fix, impact=""):
    BUGS.append(dict(module=mod,severity=sev,category=cat,problem=prob,suggested_fix=fix,impact=impact))
    print(f"  {R}🐛 BUG [{sev}]{NC} [{mod}] {prob}")

TODAY = date.today()
def ds(d): return d.isoformat()
def ago(n): return TODAY - timedelta(days=30*n)
def rdate(s, e):
    d = (e-s).days
    return s + timedelta(days=random.randint(0, max(0, d)))

# ── Auth helpers ──────────────────────────────────────────────────────────────
async def reg(c, email, uname, pw, name, country="IN", currency="INR"):
    r = await c.post("/api/v1/auth/register", json={
        "email":email,"username":uname,"password":pw,
        "full_name":name,"country":country,"currency":currency})
    if r.status_code not in (200,201):
        fail(f"Register {uname}: {r.status_code} {r.text[:80]}")
        return None, None
    r2 = await c.post("/api/v1/auth/login", json={"identifier":uname,"password":pw})
    if r2.status_code != 200:
        fail(f"Login {uname}: {r2.status_code}")
        return None, None
    tok = r2.json()["access_token"]
    me = (await c.get("/api/v1/auth/me", headers={"Authorization":f"Bearer {tok}"})).json()
    ok(f"'{uname}' ({name}) → id={me['id'][:8]}…")
    return tok, me

def H(tok): return {"Authorization": f"Bearer {tok}"}

# ══════════════════════════════════════════════════════════════════════════════
# SEEDERS
# ══════════════════════════════════════════════════════════════════════════════

async def seed_arjun(c, tok):
    """Senior SWE, ₹2.4L→2.6L salary, HDFC+SBI, 2 CC, home+car loan, SIPs"""
    h = H(tok)

    # Bank accounts
    r = await c.post("/api/v1/bank-accounts", headers=h, json={
        "bank_name":"HDFC Bank","account_type":"SAVINGS",
        "account_number":"HDFC001ARJUN","balance":485000,"account_holder_name":"Arjun Sharma"})
    hdfc_id = r.json().get("id") if r.status_code==201 else None

    await c.post("/api/v1/bank-accounts", headers=h, json={
        "bank_name":"SBI","account_type":"SAVINGS",
        "account_number":"SBI002ARJUN","balance":120000,"account_holder_name":"Arjun Sharma"})

    # Credit cards
    r = await c.post("/api/v1/cards", headers=h, json={
        "bank_name":"HDFC Bank","card_name":"HDFC Millennia","card_type":"credit",
        "last_four":"4521","credit_limit":300000,"current_balance":87500,
        "due_date":ds(TODAY+timedelta(days=8)),"billing_cycle_day":5,"annual_fee":1000})
    c1 = r.json().get("id") if r.status_code==201 else None

    r = await c.post("/api/v1/cards", headers=h, json={
        "bank_name":"Axis Bank","card_name":"Axis Magnus","card_type":"credit",
        "last_four":"7834","credit_limit":500000,"current_balance":145000,
        "due_date":ds(TODAY+timedelta(days=15)),"billing_cycle_day":15,"annual_fee":12500})
    c2 = r.json().get("id") if r.status_code==201 else None

    # Loans (using /loans endpoint)
    r = await c.post("/api/v1/loans", headers=h, json={
        "loan_type":"HOME","lender_name":"HDFC Bank","nickname":"Home Loan",
        "principal_amount":7500000,"outstanding_balance":6820000,
        "emi_amount":68500,"interest_rate":8.65,"tenure_months":240,
        "remaining_months":204,"start_date":ds(ago(36)),"emi_due_day":5,"status":"ACTIVE"})
    if r.status_code not in (200,201):
        bug("Loans","MEDIUM","API",f"Loan creation failed: {r.status_code} {r.text[:100]}",
            "Check Loan schema field names","Loan module non-functional")

    r2 = await c.post("/api/v1/loans", headers=h, json={
        "loan_type":"VEHICLE","lender_name":"ICICI Bank","nickname":"Car Loan",
        "principal_amount":850000,"outstanding_balance":520000,
        "emi_amount":17200,"interest_rate":9.25,"tenure_months":60,
        "remaining_months":36,"start_date":ds(ago(24)),"emi_due_day":10,"status":"ACTIVE"})

    # Income source
    r = await c.post("/api/v1/income/sources", headers=h, json={
        "name":"TechCorp Engineering","income_type":"SALARY","monthly_amount":240000,
        "employer":"TechCorp India","is_active":True,"start_date":ds(ago(24))})
    src_id = r.json().get("id") if r.status_code==201 else None
    if r.status_code not in (200,201):
        bug("Income","MEDIUM","API",f"IncomeSource creation failed: {r.status_code} {r.text[:80]}",
            "Check field names: name, income_type, monthly_amount","Income module broken")

    # 12 months income entries
    for m in range(12,0,-1):
        sal = 260000 if m <= 4 else 240000
        await c.post("/api/v1/income/entries", headers=h, json={
            "source_id":src_id,"amount":sal,"date":ds(ago(m).replace(day=1)),
            "note":f"{'Post-hike s' if m<=4 else 'S'}alary {ago(m).strftime('%b %Y')}"})

    # Investments (correct schema: investment_type, invested_amount, current_value)
    invs = [
        ("HDFC Nifty 50 Index Fund","MUTUAL_FUND",True,5000,150000,ago(24)),
        ("Axis Bluechip Fund","MUTUAL_FUND",True,3000,82000,ago(18)),
        ("Reliance Industries","STOCKS",False,0,103000,ago(12)),
        ("TCS","STOCKS",False,0,131000,ago(8)),
        ("Digital Gold","GOLD",True,2000,26000,ago(6)),
        ("PPF","PPF",False,0,163000,ago(36)),
        ("EPF","EPF",False,0,345000,ago(36)),
    ]
    for name, itype, is_sip, sip_amt, curr_val, pdate in invs:
        payload = {
            "investment_type":itype,"name":name,
            "invested_amount": sip_amt*12 if is_sip else curr_val*0.85,
            "current_value": float(curr_val),
            "purchase_date":ds(pdate),
            "is_sip":is_sip,
        }
        if is_sip: payload["sip_amount"] = float(sip_amt)
        r = await c.post("/api/v1/investments", headers=h, json=payload)
        if r.status_code not in (200,201):
            bug("Investments","MEDIUM","API",f"Investment creation failed ({name}): {r.status_code} {r.text[:80]}",
                "Check investment schema","Investments module broken")
            break

    # Assets (correct schema)
    r = await c.post("/api/v1/assets", headers=h, json={
        "asset_type":"REAL_ESTATE","name":"2BHK Whitefield Bengaluru",
        "purchase_price":8500000,"current_value":11200000,
        "purchase_date":ds(ago(36)),"notes":"Primary residence",
        "is_mortgaged":True,"mortgage_outstanding":6820000})
    if r.status_code not in (200,201):
        bug("Assets","MEDIUM","API",f"Asset creation failed: {r.status_code} {r.text[:100]}",
            "Verify AssetCreate schema fields","Assets module broken")

    await c.post("/api/v1/assets", headers=h, json={
        "asset_type":"VEHICLE","name":"Maruti Swift VXi 2022",
        "purchase_price":850000,"current_value":620000,
        "purchase_date":ds(ago(24)),"registration_number":"KA01MX9234"})

    # Insurance (correct schema)
    await c.post("/api/v1/insurance", headers=h, json={
        "insurance_type":"TERM","policy_name":"HDFC Life Click2Protect",
        "insurer":"HDFC Life","premium_amount":18500,"premium_frequency":"YEARLY",
        "sum_assured":10000000,"start_date":ds(ago(24)),
        "end_date":ds(TODAY+timedelta(days=365*11)),"is_active":True})
    r = await c.post("/api/v1/insurance", headers=h, json={
        "insurance_type":"HEALTH","policy_name":"Star Health Family Floater",
        "insurer":"Star Health","premium_amount":28000,"premium_frequency":"YEARLY",
        "sum_assured":1000000,"cover_amount":1000000,
        "start_date":ds(ago(12)),"end_date":ds(TODAY+timedelta(days=180)),"is_active":True})
    if r.status_code not in (200,201):
        bug("Insurance","MEDIUM","API",f"Insurance creation failed: {r.status_code} {r.text[:80]}",
            "Check InsuranceCreate schema","Insurance module broken")

    # Goals (correct schema: goal_type, target_amount, target_date)
    goals_data = [
        ("Emergency Fund","EMERGENCY_FUND",600000,280000,ds(TODAY+timedelta(days=180))),
        ("Europe Trip","VACATION",200000,45000,ds(TODAY+timedelta(days=300))),
        ("MacBook Pro","OTHER",250000,80000,ds(TODAY+timedelta(days=120))),
    ]
    for gname, gtype, target, current, deadline in goals_data:
        r = await c.post("/api/v1/goals", headers=h, json={
            "name":gname,"goal_type":gtype,"target_amount":target,
            "current_amount":current,"target_date":deadline,"priority":"HIGH"})
        if r.status_code not in (200,201):
            bug("Goals","MEDIUM","API",f"Goal creation failed: {r.status_code} {r.text[:80]}",
                "Check GoalCreate schema: goal_type, target_amount, target_date","Goals broken")
            break

    # 12 months transactions across categories
    cats = [
        ("Food & Dining",["Swiggy","Zomato","Barbeque Nation"],3000,12000),
        ("Shopping",["Amazon","Flipkart","Myntra","Croma"],5000,35000),
        ("Travel",["MakeMyTrip","IRCTC","Ola"],2000,15000),
        ("Utilities",["BESCOM","Airtel","Jio"],2000,5000),
        ("Entertainment",["Netflix","BookMyShow","Spotify"],500,4000),
        ("Grocery",["BigBasket","DMart","Zepto"],8000,20000),
        ("Health",["Apollo Pharmacy","Cult.fit"],500,5000),
        ("Fuel",["HP Petrol","BPCL"],2000,6000),
    ]
    tx_count = 0
    for m in range(12,0,-1):
        base = ago(m)
        festival = base.month in (10,11,12,1)
        for cat, merchants, lo, hi in cats:
            for _ in range(random.randint(2,5)):
                amt = random.randint(lo, hi)
                if festival: amt = int(amt*1.4)
                dt = rdate(base, base+timedelta(days=28))
                r = await c.post("/api/v1/transactions", headers=h, json={
                    "amount":amt,"type":"debit","date":ds(dt),
                    "description":random.choice(merchants),"category":cat,"card_id":c1})
                if r.status_code in (200,201): tx_count += 1

    # Net worth snapshot
    await c.post("/api/v1/net-worth/snapshot", headers=h)

    ok(f"Arjun seeded: {tx_count} txns, 7 investments, 2 loans, 2 CC, 3 goals, 2 assets, 2 insurance")
    return c1, c2


async def seed_vikram(c, tok):
    h = H(tok)
    await c.post("/api/v1/bank-accounts", headers=h, json={
        "bank_name":"ICICI Bank","account_type":"SAVINGS",
        "account_number":"ICICI001VIKRAM","balance":1250000,"account_holder_name":"Vikram Nair"})

    await c.post("/api/v1/income/sources", headers=h, json={
        "name":"FinTech Corp","income_type":"SALARY","monthly_amount":500000,
        "employer":"FinTech Corp","is_active":True})

    invs = [
        ("Nifty 50 ETF","ETF",False,0,1400000,ago(36)),
        ("Mirae Large Cap","MUTUAL_FUND",True,25000,980000,ago(30)),
        ("HDFC Mid Cap","MUTUAL_FUND",True,15000,620000,ago(24)),
        ("Nasdaq 100 FoF","MUTUAL_FUND",False,0,326000,ago(18)),
        ("Embassy REIT","REITS",False,0,197000,ago(15)),
        ("SGB 2023-24","SGB",False,0,281000,ago(20)),
    ]
    total_inv, total_curr = 0, 0
    for name, itype, is_sip, sip_amt, curr_val, pdate in invs:
        inv_amt = sip_amt*(ago(0)-pdate).days//30 if is_sip else curr_val*0.82
        total_inv += inv_amt; total_curr += curr_val
        payload = {"investment_type":itype,"name":name,
                   "invested_amount":inv_amt,"current_value":float(curr_val),
                   "purchase_date":ds(pdate),"is_sip":is_sip}
        if is_sip: payload["sip_amount"] = float(sip_amt)
        await c.post("/api/v1/investments", headers=h, json=payload)

    await c.post("/api/v1/net-worth/snapshot", headers=h)
    ok(f"Vikram: 6 investments, ₹{total_inv/100000:.0f}L→₹{total_curr/100000:.0f}L (+{(total_curr/total_inv-1)*100:.1f}%)")


async def seed_deepak(c, tok):
    """Debt-heavy: income ₹75k, EMI burden ₹47k/mo, 3 maxed CCs"""
    h = H(tok)
    await c.post("/api/v1/bank-accounts", headers=h, json={
        "bank_name":"Axis Bank","account_type":"SAVINGS",
        "account_number":"AXIS001DEEPAK","balance":18500,"account_holder_name":"Deepak Gupta"})

    for bank, name, l4, limit, bal, dd in [
        ("HDFC Bank","HDFC Regalia","7234",200000,198000,3),
        ("ICICI Bank","Amazon ICICI","8891",150000,147000,12),
        ("SBI","SBI Click","3345",100000,96500,20),
    ]:
        await c.post("/api/v1/cards", headers=h, json={
            "bank_name":bank,"card_name":name,"card_type":"credit",
            "last_four":l4,"credit_limit":limit,"current_balance":bal,
            "due_date":ds(TODAY+timedelta(days=dd)),"billing_cycle_day":1,"annual_fee":2000})

    for ltype, lender, principal, emi, rate, months, start in [
        ("PERSONAL","HDFC Bank",400000,12800,18.5,36,ago(18)),
        ("PERSONAL","ICICI Bank",250000,9200,20.5,36,ago(12)),
        ("VEHICLE","Hero FinCorp",85000,3100,12.5,36,ago(24)),
        ("OTHER","Bajaj Finance",80000,7500,24.0,12,ago(8)),
    ]:
        await c.post("/api/v1/loans", headers=h, json={
            "loan_type":ltype,"lender_name":lender,"principal_amount":principal,
            "outstanding_balance":principal*0.6,"emi_amount":emi,"interest_rate":rate,
            "tenure_months":months,"remaining_months":max(3,months-int((TODAY-start).days//30)),
            "start_date":ds(start),"emi_due_day":5,"status":"ACTIVE"})

    await c.post("/api/v1/income/sources", headers=h, json={
        "name":"Marketing Manager","income_type":"SALARY","monthly_amount":75000,
        "employer":"AdTech Inc","is_active":True})

    total_emi = 12800+9200+3100+7500
    ok(f"Deepak: EMI ₹{total_emi:,}/mo vs income ₹75,000 → DTI {total_emi/750:.0f}%  ⚠ CRITICAL")


async def seed_karan_crypto(c, tok):
    h = H(tok)
    await c.post("/api/v1/bank-accounts", headers=h, json={
        "bank_name":"Yes Bank","account_type":"SAVINGS",
        "account_number":"YES001KARAN","balance":345000,"account_holder_name":"Karan Malhotra"})

    for name, itype, invested, curr in [
        ("Bitcoin (BTC)","CRYPTO",500000,840000),
        ("Ethereum (ETH)","CRYPTO",300000,426000),
        ("Solana (SOL)","CRYPTO",100000,71500),
        ("Polygon (MATIC)","CRYPTO",50000,18900),
        ("BNB","CRYPTO",80000,92600),
    ]:
        await c.post("/api/v1/investments", headers=h, json={
            "investment_type":itype,"name":name,
            "invested_amount":float(invested),"current_value":float(curr),
            "purchase_date":ds(ago(random.randint(6,18))),"is_sip":False})

    ok("Karan: 5 crypto positions seeded")


async def seed_meena_saver(c, tok):
    h = H(tok)
    await c.post("/api/v1/bank-accounts", headers=h, json={
        "bank_name":"Post Office","account_type":"SAVINGS",
        "account_number":"PO001MEENA","balance":820000,"account_holder_name":"Meena Pillai"})
    await c.post("/api/v1/bank-accounts", headers=h, json={
        "bank_name":"SBI","account_type":"FD",
        "account_number":"SBI_FD_MEENA","balance":2500000,"account_holder_name":"Meena Pillai"})

    for name, itype, invested, curr in [
        ("SBI FD 7.1%","OTHER",2500000,2677000),
        ("PPF Account","PPF",850000,1020000),
        ("NSC (5yr)","BONDS",500000,622000),
        ("LIC Endowment","OTHER",200000,248000),
    ]:
        await c.post("/api/v1/investments", headers=h, json={
            "investment_type":itype,"name":name,
            "invested_amount":float(invested),"current_value":float(curr),
            "purchase_date":ds(ago(random.randint(12,60))),"is_sip":False})

    ok("Meena: ₹55L+ in safe instruments, zero debt, zero CC")


async def seed_ravi_family(c, tok):
    h = H(tok)
    await c.post("/api/v1/bank-accounts", headers=h, json={
        "bank_name":"Kotak Mahindra","account_type":"SAVINGS",
        "account_number":"KOTAK001RAVI","balance":380000,"account_holder_name":"Ravi Krishnan"})

    # School fee as a loan
    await c.post("/api/v1/loans", headers=h, json={
        "loan_type":"EDUCATION","lender_name":"DPS School","nickname":"School Fees 2024-25",
        "principal_amount":240000,"outstanding_balance":160000,
        "emi_amount":20000,"interest_rate":0,"tenure_months":12,
        "remaining_months":8,"start_date":ds(ago(4)),"emi_due_day":10,"status":"ACTIVE"})

    # Family health insurance
    await c.post("/api/v1/insurance", headers=h, json={
        "insurance_type":"HEALTH","policy_name":"Niva Bupa Family First",
        "insurer":"Niva Bupa","premium_amount":42000,"premium_frequency":"YEARLY",
        "sum_assured":2000000,"cover_amount":2000000,
        "start_date":ds(ago(6)),"is_active":True})

    # Friend EMI tracking via friends module
    r = await c.post("/api/v1/friends", headers=h, json={
        "name":"Suresh Kumar","relationship":"friend","phone":"9876543210"})
    friend_id = r.json().get("id") if r.status_code==201 else None
    if friend_id:
        ok(f"Friend 'Suresh Kumar' added, id={friend_id[:8]}…")

    await c.post("/api/v1/income/sources", headers=h, json={
        "name":"IT Manager Salary","income_type":"SALARY","monthly_amount":150000,
        "employer":"MNC Corp","is_active":True})
    ok("Ravi: family setup, 2 kids, health cover, friend tracking")


async def seed_rahul_freelancer(c, tok):
    h = H(tok)
    await c.post("/api/v1/bank-accounts", headers=h, json={
        "bank_name":"Razorpay Current","account_type":"CURRENT",
        "account_number":"RZRPAY001RAHUL","balance":156000,"account_holder_name":"Rahul Dev"})

    r = await c.post("/api/v1/income/sources", headers=h, json={
        "name":"Freelance Development","income_type":"FREELANCE","monthly_amount":75000,
        "is_variable":True,"variable_min":0,"variable_max":200000,"is_active":True})
    src_id = r.json().get("id") if r.status_code==201 else None

    income_months = [85000,0,45000,120000,30000,0,95000,75000,200000,75000,75000,75000]
    for m, amt in enumerate(income_months, 1):
        if amt > 0:
            await c.post("/api/v1/income/entries", headers=h, json={
                "source_id":src_id,"amount":amt,
                "date":ds(ago(12-m+1).replace(day=1)),"note":f"Month {m} project income"})
    ok(f"Rahul: variable freelance income, 10/12 months with earnings")


async def seed_ananya_chaos(c, tok):
    h = H(tok)
    for bank, acc, bal in [
        ("Paytm Payments","PAYTM001ANANYA",12000),
        ("HDFC Bank","HDFC002ANANYA",8500),
        ("Kotak 811","KOTAK002ANANYA",3200),
    ]:
        await c.post("/api/v1/bank-accounts", headers=h, json={
            "bank_name":bank,"account_type":"SAVINGS",
            "account_number":acc,"balance":bal,"account_holder_name":"Ananya Singh"})

    # 50 messy uncategorized transactions
    for _ in range(50):
        dt = rdate(ago(6), TODAY)
        await c.post("/api/v1/transactions", headers=h, json={
            "amount":random.randint(50,5000),"type":"debit","date":ds(dt),
            "description":random.choice(["UPI","Unknown","ATM","Online","Cash"]),
            "category":"Uncategorized"})
    ok("Ananya: 3 fragmented accounts, 50 messy uncategorized txns")


# ══════════════════════════════════════════════════════════════════════════════
# TESTS
# ══════════════════════════════════════════════════════════════════════════════

async def test_sharing(c, arjun_tok, priya_tok, arjun_id):
    print(f"\n{M}[SHARING SYSTEM]{NC}")
    ha, hp = H(arjun_tok), H(priya_tok)

    r = await c.post("/api/v1/sharing/invitations", headers=ha, json={
        "invitee_identifier":"priya_mehta",
        "modules":["investments","net_worth","banking","loans"],
        "access_type":"full_read","relationship_type":"spouse",
        "relationship_label":"Wife","access_duration_days":365,
        "message":"Sharing our combined financial view"})
    if r.status_code != 201:
        bug("Sharing","HIGH","API",f"Invite creation failed: {r.status_code} {r.text[:100]}",
            "Debug sharing/invitations POST","Sharing module broken"); return
    ok("Arjun → Priya invitation created")
    invite_code = r.json()["invite_code"]

    r = await c.post(f"/api/v1/sharing/invitations/{invite_code}/accept", headers=hp)
    if r.status_code == 200:
        ok("Priya accepted → SharePermission active")
    else:
        bug("Sharing","HIGH","API",f"Accept failed: {r.status_code} {r.text[:100]}",
            "Check accept endpoint identity validation","Sharing broken"); return

    # Priya reads Arjun's investments
    r = await c.get(f"/api/v1/investments?owner_id={arjun_id}", headers=hp)
    if r.status_code == 200:
        items = r.json() if isinstance(r.json(),list) else r.json().get("items",[])
        ok(f"Priya reads Arjun's investments: {len(items)} found ✓")
    else:
        bug("Sharing","HIGH","Permission",f"Priya can't read Arjun's investments: {r.status_code}",
            "Check get_data_context dep — owner_id query param","Cross-user read broken")

    # Priya tries to CREATE a transaction for Arjun (must be 403)
    r = await c.post(f"/api/v1/transactions?owner_id={arjun_id}", headers=hp, json={
        "amount":1,"transaction_type":"PURCHASE","transaction_date":ds(TODAY)+"T00:00:00Z","description":"HACK"})
    if r.status_code == 403:
        ok("Priya cannot write to Arjun's data → 403 ✓ (read-only enforced)")
    else:
        bug("Sharing","CRITICAL","Security",
            f"Shared user can WRITE to owner data (got {r.status_code} not 403)",
            "Apply require_write() to all mutation endpoints in transactions, cards, etc.",
            "CRITICAL: shared user can corrupt owner financial data")

    # Check permissions
    r = await c.get("/api/v1/sharing/permissions/given", headers=ha)
    if r.status_code==200 and len(r.json())>0:
        ok(f"Arjun sees {len(r.json())} permission(s) given")
    else:
        bug("Sharing","MEDIUM","API","permissions/given empty after accept",
            "Check owner_id filter in given endpoint","Sharing dashboard blank")

    r = await c.get("/api/v1/sharing/permissions/received", headers=hp)
    if r.status_code==200 and len(r.json())>0:
        ok(f"Priya sees {len(r.json())} permission(s) received")
    else:
        bug("Sharing","MEDIUM","API","permissions/received empty",
            "Check grantee_id filter","Shared-with-me view blank")


async def test_security(c, tok1, tok2):
    print(f"\n{M}[SECURITY TESTS]{NC}")
    h1 = H(tok1)

    for label, hdrs, expect in [
        ("No auth",        {},                                             401),
        ("Bad JWT",        {"Authorization":"Bearer garbage.jwt.token"},  401),
        ("Forged sig",     {"Authorization":"Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwMDAwIiwidHlwZSI6ImFjY2VzcyJ9.FAKE"}, 401),
    ]:
        r = await c.get("/api/v1/cards", headers=hdrs)
        if r.status_code == expect:
            ok(f"{label} → {r.status_code} ✓")
        else:
            bug("Auth","CRITICAL","Security",f"{label} not rejected: got {r.status_code}",
                "Fix auth dependency","Auth bypass")

    # SQL injection attempt
    r = await c.get("/api/v1/transactions?description='; DROP TABLE users; --", headers=h1)
    if r.status_code < 500:
        ok(f"SQL injection handled safely ({r.status_code}) ✓")
    else:
        bug("API","HIGH","Security","SQL injection causes 500",
            "Verify parameterised queries","Potential data loss")

    # Negative amount
    r = await c.post("/api/v1/transactions", headers=h1, json={
        "amount":-5000,"type":"debit","date":ds(TODAY),"description":"Negative"})
    if r.status_code in (400,422):
        ok("Negative amount rejected ✓")
    else:
        bug("Transactions","MEDIUM","Validation","Negative amounts accepted",
            "Add validator: amount > 0","Financial corruption")

    # Duplicate email registration
    r = await c.post("/api/v1/auth/register", json={
        "email":"arjun@example.com","username":"arjun_dup","password":"Test1234!"})
    if r.status_code == 400:
        ok("Duplicate email rejected ✓")
    else:
        bug("Auth","HIGH","Security","Duplicate email allowed",
            "Email uniqueness check","Multiple accounts per email")

    # Empty password
    r = await c.post("/api/v1/auth/register", json={
        "email":"empty@example.com","username":"emptypass","password":""})
    if r.status_code in (400,422):
        ok("Empty password rejected ✓")
    else:
        bug("Auth","HIGH","Security","Empty password accepted",
            "Enforce min_length=8 in RegisterRequest","Weak accounts")

    # Short password (7 chars)
    r = await c.post("/api/v1/auth/register", json={
        "email":"short@example.com","username":"shortpw","password":"Abc123!"})
    if r.status_code in (400,422):
        ok("Short password (7 chars) rejected ✓")
    else:
        bug("Auth","MEDIUM","Validation","7-char password accepted (should require 8+)",
            "Enforce password_strength validator","Weak passwords")

    # Session management
    r = await c.get("/api/v1/auth/sessions", headers=h1)
    if r.status_code == 200:
        sessions = r.json()
        ok(f"Session list: {len(sessions)} active session(s) ✓")
        if len(sessions) == 0:
            bug("Auth","MEDIUM","Sessions","Active sessions not tracked after login",
                "Verify UserSession creation in login endpoint","Device management broken")
    else:
        bug("Auth","MEDIUM","API","Sessions endpoint fails","Debug sessions endpoint","Session mgmt broken")


async def test_financial_logic(c, tok, arjun_id):
    print(f"\n{M}[FINANCIAL LOGIC VALIDATION]{NC}")
    h = H(tok)

    # Net worth snapshot + current
    r = await c.post("/api/v1/net-worth/snapshot", headers=h)
    if r.status_code in (200,201):
        ok("Net worth snapshot created ✓")
    else:
        bug("Net Worth","HIGH","API",f"Snapshot fails: {r.status_code} {r.text[:100]}",
            "Debug net-worth/snapshot endpoint","Net worth dashboard broken")

    r = await c.get("/api/v1/net-worth/current", headers=h)
    if r.status_code == 200:
        nw = r.json()
        assets = nw.get("total_assets",0)
        liab   = nw.get("total_liabilities",0)
        net    = nw.get("net_worth",0)
        if abs(net - (assets-liab)) < 1:
            ok(f"NW math: ₹{assets:,.0f} - ₹{liab:,.0f} = ₹{net:,.0f} ✓")
        else:
            bug("Net Worth","HIGH","Calculation",
                f"NW formula wrong: {assets}-{liab}≠{net} (diff={abs(net-(assets-liab)):.0f})",
                "Fix: net_worth = total_assets - total_liabilities","Wrong wealth display")
        if liab == 0 and assets > 0:
            bug("Net Worth","MEDIUM","Aggregation",
                "total_liabilities=0 even with active loans — loans not aggregated into net worth",
                "Include loan outstanding_balance in liabilities calculation",
                "Net worth overstated; user sees false picture of wealth")
    else:
        bug("Net Worth","HIGH","API",f"NW current fails: {r.status_code}","Debug endpoint","Dashboard broken")

    # Card utilization
    r = await c.get("/api/v1/cards", headers=h)
    if r.status_code == 200:
        data = r.json()
        cards = data.get("items", data if isinstance(data,list) else [])
        for card in cards[:2]:
            r2 = await c.get(f"/api/v1/cards/{card['id']}/utilization", headers=h)
            if r2.status_code == 200:
                util = r2.json()
                exp  = round(card["current_balance"]/card["credit_limit"]*100,2)
                got  = util.get("utilization_percentage",0)
                if abs(got-exp) < 0.5:
                    ok(f"Card utilization {got:.1f}% correct ✓")
                else:
                    bug("Cards","MEDIUM","Calculation",
                        f"Util wrong: expected {exp}% got {got}%",
                        "Fix: utilization = balance/limit*100","Wrong credit health score")
    else:
        bug("Cards","MEDIUM","API","Card list fails","Debug endpoint","Card dashboard broken")

    # Investment P&L
    r = await c.get("/api/v1/investments/analytics/summary", headers=h)
    if r.status_code == 200:
        inv = r.json()
        invested = inv.get("total_invested",0)
        curr     = inv.get("total_current_value",0)
        pnl      = inv.get("total_pnl",0)
        if abs(pnl-(curr-invested)) < 1:
            ok(f"Investment P&L: ₹{pnl:,.0f} correct ✓ (invested=₹{invested:,.0f} current=₹{curr:,.0f})")
        else:
            bug("Investments","HIGH","Calculation",
                f"P&L wrong: {curr}-{invested}≠{pnl}",
                "Fix: pnl = current_value - invested_amount","Wrong portfolio P&L")
    else:
        bug("Investments","MEDIUM","API",f"Investment summary fails: {r.status_code}","Debug","P&L broken")

    # Loan summary
    r = await c.get("/api/v1/loans/analytics/summary", headers=h)
    if r.status_code == 200:
        loans = r.json()
        ok(f"Loan summary: {loans.get('total_loans',0)} loans, outstanding=₹{loans.get('total_outstanding',0):,.0f} ✓")
    else:
        bug("Loans","MEDIUM","API",f"Loan summary fails: {r.status_code}","Debug","Debt dashboard broken")

    # Reports
    for ep, name in [("/api/v1/reports/dashboard","Dashboard"),("/api/v1/reports/spending","Spending")]:
        r = await c.get(ep, headers=h)
        if r.status_code == 200:
            ok(f"{name} report ✓")
        else:
            bug("Reports","HIGH","API",f"{name} report fails: {r.status_code} {r.text[:80]}",
                "Debug reports endpoint","Main dashboard broken")

    # Category breakdown
    r = await c.get("/api/v1/transactions/analytics/category-breakdown", headers=h)
    if r.status_code == 200:
        cats = r.json()
        ok(f"Category breakdown: {len(cats)} categories ✓")
        # Validate percentages sum to ~100
        total_pct = sum(c.get("percentage",0) for c in cats if isinstance(c,dict))
        if cats and abs(total_pct-100) > 1:
            bug("Transactions","MEDIUM","Calculation",
                f"Category % sum={total_pct:.1f}% (not 100%)",
                "Normalize percentages: each % = amount/total*100","Wrong spending pie chart")
    else:
        bug("Transactions","MEDIUM","API",f"Category breakdown fails: {r.status_code}","Debug","Charts broken")

    # Monthly trend
    r = await c.get("/api/v1/transactions/analytics/monthly-trend?months=12", headers=h)
    if r.status_code == 200:
        trend = r.json()
        ok(f"Monthly trend: {len(trend)} months ✓")
    else:
        bug("Transactions","MEDIUM","API",f"Monthly trend fails: {r.status_code}","Debug","Trend chart broken")

    # Cash flow
    r = await c.get("/api/v1/bank-accounts/analytics/cashflow", headers=h)
    if r.status_code == 200:
        ok("Cash flow analytics ✓")
    else:
        bug("Banking","MEDIUM","API",f"Cash flow fails: {r.status_code}","Debug","Cash flow broken")

    # Income intelligence
    r = await c.get("/api/v1/income/analytics/intelligence", headers=h)
    if r.status_code == 200:
        ok("Income intelligence ✓")
    else:
        bug("Income","LOW","API",f"Income intelligence fails: {r.status_code}","Debug","AI income broken")

    # Insurance intelligence
    r = await c.get("/api/v1/insurance/analytics/intelligence", headers=h)
    if r.status_code == 200:
        ok("Insurance intelligence ✓")
    else:
        bug("Insurance","LOW","API",f"Insurance intelligence fails: {r.status_code}","Debug","Insurance AI broken")

    # Goals intelligence
    r = await c.get("/api/v1/goals/analytics/intelligence", headers=h)
    if r.status_code == 200:
        ok("Goals intelligence ✓")
    else:
        bug("Goals","LOW","API",f"Goals intelligence fails: {r.status_code}","Debug","Goals AI broken")

    # Asset intelligence
    r = await c.get("/api/v1/assets/analytics/intelligence", headers=h)
    if r.status_code == 200:
        ok("Assets intelligence ✓")
    else:
        bug("Assets","LOW","API",f"Assets intelligence fails: {r.status_code}","Debug","Asset analytics broken")

    # Net worth intelligence
    r = await c.get("/api/v1/net-worth/intelligence", headers=h)
    if r.status_code == 200:
        ok("Net worth intelligence ✓")
    else:
        bug("Net Worth","LOW","API",f"NW intelligence fails: {r.status_code}","Debug","NW AI broken")

    # Investment intelligence
    r = await c.get("/api/v1/investments/analytics/intelligence", headers=h)
    if r.status_code == 200:
        ok("Investment intelligence ✓")
    else:
        bug("Investments","LOW","API",f"Investment intelligence fails: {r.status_code}","Debug","Investment AI broken")


async def test_edge_cases(c, tok):
    print(f"\n{M}[QA EDGE CASES]{NC}")
    h = H(tok)

    # Pagination
    r = await c.get("/api/v1/transactions?page=1&page_size=5", headers=h)
    if r.status_code == 200:
        data = r.json()
        items = data.get("items", data if isinstance(data,list) else [])
        ok(f"Pagination: {len(items)} items on page 1 ✓")
        # Validate total count present
        if "total" not in data and not isinstance(data, list):
            bug("Transactions","LOW","API","Pagination response missing 'total' field",
                "Add total, page, page_size to paginated responses","Pagination UI can't show page count")
    else:
        bug("Transactions","MEDIUM","API","Pagination broken","Fix page/page_size params","UX degrades with data")

    # Date range filter
    r = await c.get(f"/api/v1/transactions?start_date={ds(ago(3))}&end_date={ds(TODAY)}", headers=h)
    if r.status_code == 200:
        ok("Date range filter works ✓")
        data = r.json()
        items = data.get("items", data if isinstance(data,list) else [])
        # Validate no items outside range
        for item in items:
            if isinstance(item,dict):
                item_date = item.get("date","")
                if item_date and item_date < ds(ago(3)):
                    bug("Transactions","MEDIUM","Filtering",
                        "Date range filter returns items outside requested range",
                        "Fix WHERE clause: date >= start_date AND date <= end_date","Wrong filtered reports")
                    break
    else:
        bug("Transactions","MEDIUM","API","Date range filter broken","Fix start_date/end_date params","Can't filter by date")

    # Delete non-existent
    r = await c.delete(f"/api/v1/cards/{uuid.uuid4()}", headers=h)
    if r.status_code == 404:
        ok("Delete non-existent → 404 ✓")
    else:
        bug("Cards","LOW","API",f"Delete non-existent returns {r.status_code}","Add 404 handling","Confusing errors")

    # Net worth history
    r = await c.get("/api/v1/net-worth/history?months=6", headers=h)
    if r.status_code == 200:
        ok(f"Net worth history: {len(r.json())} snapshots ✓")
    else:
        bug("Net Worth","MEDIUM","API","History endpoint fails","Debug","NW chart broken")

    # Notifications
    r = await c.get("/api/v1/notifications", headers=h)
    if r.status_code == 200:
        ok(f"Notifications: {len(r.json())} items ✓")
    else:
        bug("Notifications","LOW","API","Notifications fails","Debug","Bell broken")

    # Insights generate
    r = await c.post("/api/v1/insights/generate", headers=h)
    if r.status_code in (200,201):
        ok("Insights generate ✓")
    else:
        bug("Insights","LOW","API",f"Insights generate fails: {r.status_code}","Debug","AI insights broken")

    # User search
    r = await c.get("/api/v1/auth/users/search?q=arjun", headers=h)
    if r.status_code == 200:
        results = r.json()
        ok(f"User search 'arjun': {len(results)} result(s) ✓")
    else:
        bug("Auth","MEDIUM","API","User search fails","Debug search endpoint","Can't find users to invite")


async def test_scale(c, tok):
    print(f"\n{M}[SCALE TEST — 500 transactions]{NC}")
    h = H(tok)
    import time
    cats = ["FOOD","SHOPPING","TRAVEL","UTILITIES","ENTERTAINMENT","FUEL","GROCERIES","DINING","OTHER"]
    merchants = ["Swiggy","Amazon","Uber","BESCOM","Netflix","HP Petrol","BigBasket","Unknown"]
    t_types = ["PURCHASE","PAYMENT","REFUND"]
    t0 = time.time()
    errors = 0
    for i in range(500):
        dt = rdate(ago(12), TODAY)
        r = await c.post("/api/v1/transactions", headers=h, json={
            "amount":random.randint(10,50000),
            "transaction_type":random.choice(t_types),
            "transaction_date":ds(dt)+"T00:00:00Z",
            "description":random.choice(merchants),
            "category":random.choice(cats)})
        if r.status_code not in (200,201): errors += 1

    elapsed = time.time()-t0
    rps = 500/elapsed
    if errors == 0:
        ok(f"500 inserts in {elapsed:.1f}s ({rps:.0f} tx/s) — 0 errors ✓")
    else:
        bug("Transactions","MEDIUM","Performance",f"{errors}/500 inserts failed under load",
            "Check connection pool, DB limits","Data loss under load")
    if rps < 30:
        bug("Performance","HIGH","Scalability",f"Throughput {rps:.0f} tx/s (expect >50/s)",
            "Add DB connection pool tuning, batch insert support, COPY optimization",
            "Will degrade badly with 100 concurrent users")
    else:
        ok(f"Throughput {rps:.0f} tx/s — acceptable ✓")

    # Large read performance
    t1 = time.time()
    r = await c.get("/api/v1/transactions?page=1&page_size=100", headers=h)
    read_ms = (time.time()-t1)*1000
    if read_ms < 300:
        ok(f"Read 100 transactions: {read_ms:.0f}ms ✓")
    else:
        bug("Performance","MEDIUM","Scalability",f"Read 100 txns takes {read_ms:.0f}ms (expect <300ms)",
            "Add composite index on (user_id, date DESC) for transactions table",
            "Slow dashboard on real user data")

    # Test large pagination
    t2 = time.time()
    r = await c.get("/api/v1/transactions/analytics/category-breakdown", headers=h)
    analytics_ms = (time.time()-t2)*1000
    if analytics_ms < 500:
        ok(f"Category analytics (on 500+ txns): {analytics_ms:.0f}ms ✓")
    else:
        bug("Performance","MEDIUM","Scalability",f"Analytics on 500+ txns: {analytics_ms:.0f}ms",
            "Add DB aggregation indexes","Analytics slow with real data")


async def test_debt_user(c, tok):
    print(f"\n{M}[DEBT USER ANALYSIS — Deepak]{NC}")
    h = H(tok)

    r = await c.get("/api/v1/loans", headers=h)
    if r.status_code == 200:
        loans = r.json() if isinstance(r.json(),list) else r.json().get("items",[])
        total_emi = sum(float(l.get("emi_amount",0) or 0) for l in loans)
        income = 75000
        dti = total_emi/income*100
        ok(f"Total loan EMI=₹{total_emi:,}/mo | Income=₹{income:,} | DTI={dti:.1f}%")
        if dti > 50:
            warn(f"DTI {dti:.1f}% — CRITICAL (>50%) — user is financially distressed")
            bug("Loans","MEDIUM","Financial Logic",
                "No DTI warning when debt-to-income exceeds 40%/50% thresholds",
                "Add proactive alert: 'Your EMI burden is 62% of income — danger zone'",
                "User unaware of dangerous leverage; may default")

    # Check CC utilization for maxed cards
    r = await c.get("/api/v1/cards", headers=h)
    if r.status_code == 200:
        cards = r.json().get("items", r.json() if isinstance(r.json(),list) else [])
        over90 = [c for c in cards if c.get("credit_limit",1) > 0 and
                  c.get("current_balance",0)/c.get("credit_limit",1) > 0.9]
        if over90:
            warn(f"{len(over90)} credit card(s) above 90% utilization — credit score impact")
            if len(over90) >= 2:
                bug("Cards","MEDIUM","Financial Logic",
                    f"{len(over90)} cards above 90% utilization with no warning shown",
                    "Add high-utilization alert badge on card, notify in dashboard",
                    "User's credit score damaged without awareness")


def ux_product_review():
    print(f"\n{M}[UX/PRODUCT WAR ROOM REVIEW — 10 Findings]{NC}")
    findings = [
        ("BA1-UX","HIGH","UX Flow",
         "No onboarding wizard after signup — user lands on blank dashboard",
         "First-time experience is confusing; nothing to see until data is added",
         "Add 3-step setup wizard: 1) Add bank 2) Add income 3) Add first card"),
        ("BA1-UX","MEDIUM","UX Flow",
         "No mobile bottom navigation — sidebar-only is bad mobile UX",
         "Fintech apps (CRED, Groww, Zerodha) all use bottom nav on mobile",
         "Add bottom tab bar: Dashboard | Banking | Cards | Investments | AI CFO"),
        ("BA2-Finance","CRITICAL","Architecture",
         "EMI module and Loans module are completely separate — same data entered twice",
         "A home loan has an EMI. User must enter loan in Loans AND EMI in EMIs",
         "Unify: Loan creation auto-generates EMI schedule. EMI tab = view-only of loan repayments"),
        ("BA2-Finance","HIGH","Financial Logic",
         "Credit card outstanding NOT included in net worth liabilities",
         "CC balance is a liability. If cards have ₹2.3L outstanding, NW is overstated by that amount",
         "Add: total_liabilities += sum(card.current_balance for all active cards)"),
        ("BA2-Finance","HIGH","Financial Logic",
         "No DTI (debt-to-income) calculation or warning visible anywhere",
         "The most important metric for debt health is completely absent from the product",
         "Add DTI widget to dashboard: (total_emi / monthly_income) × 100 with RED/AMBER/GREEN"),
        ("BA3-Product","HIGH","Architecture",
         "Friend EMIs conflated with personal EMIs in the same module",
         "EMI module is for loan repayments; Friend module is for tracking money lent. These are different concepts",
         "Rename: 'EMI Tracker' = personal loan repayments. 'Friends' = money lent to others. Keep separate"),
        ("BA3-Product","MEDIUM","Architecture",
         "Income module has Sources + Entries — two-level model is confusing to regular users",
         "User wants to say 'I earn ₹2.4L/month from TechCorp'. The source→entry abstraction is invisible to them",
         "Auto-generate monthly entries from active sources. Show entries as 'history', sources as 'setup'"),
        ("AI-Rev","HIGH","AI Systems",
         "AI CFO has no automatic financial context — blind to user's actual data",
         "User asks 'Am I on track?' and AI has no idea about their loans, savings, or goals",
         "Inject financial summary into every AI conversation system prompt: income, top expenses, loan burden, net worth"),
        ("AI-Rev","MEDIUM","AI Systems",
         "No guardrails on AI financial advice — risk of specific investment recommendations",
         "AI could say 'Buy Nifty 50 ETF' without disclaimer, creating regulatory/liability risk",
         "Add system prompt guardrails: 'Never recommend specific securities. Always add: This is not financial advice'"),
        ("UX-Arch","MEDIUM","UX",
         "Settings page is static — no ability to change password, manage sessions, or delete account from UI",
         "Users expect security settings in a fintech app. Session revoke is critical for stolen device scenarios",
         "Add to settings: Change Password, Active Sessions (with revoke), Delete Account"),
    ]
    for team, sev, cat, prob, why, fix in findings:
        color = R if sev in ("CRITICAL","HIGH") else Y
        print(f"\n  {color}[{team}][{sev}]{NC} {prob}")
        print(f"    Why: {why}")
        print(f"    Fix: {fix}")
        BUGS.append(dict(module=team,severity=sev,category=cat,problem=prob,suggested_fix=fix,
                         impact="Business/UX/Financial accuracy impact"))


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
async def main():
    print(f"\n{B}{'═'*66}")
    print(f"  MY CFO — ENTERPRISE FINTECH WAR ROOM TEST SUITE v2")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'═'*66}{NC}\n")

    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as c:

        # ── Health ────────────────────────────────────────────────────────────
        print(f"{B}[STEP 0] Health{NC}")
        r = await c.get("/health")
        ok(f"Backend: {r.json()}") if r.status_code==200 else fail(f"Unhealthy: {r.status_code}")

        # ── Create 10 users ───────────────────────────────────────────────────
        print(f"\n{B}[STEP 1] 10 Realistic Users{NC}")
        USERS = [
            ("arjun@example.com",  "arjun_sharma",  "Secure@123","Arjun Sharma",  "salaried_employee"),
            ("priya@example.com",  "priya_mehta",   "Secure@123","Priya Mehta",   "married_spouse"),
            ("rahul@example.com",  "rahul_dev",     "Secure@123","Rahul Dev",     "freelancer"),
            ("sunita@example.com", "sunita_biz",    "Secure@123","Sunita Verma",  "business_owner"),
            ("vikram@example.com", "vikram_invest", "Secure@123","Vikram Nair",   "heavy_investor"),
            ("karan@example.com",  "crypto_karan",  "Secure@123","Karan Malhotra","crypto_trader"),
            ("deepak@example.com", "debt_deepak",   "Secure@123","Deepak Gupta",  "debt_heavy"),
            ("ravi@example.com",   "family_ravi",   "Secure@123","Ravi Krishnan", "family_oriented"),
            ("ananya@example.com", "chaos_ananya",  "Secure@123","Ananya Singh",  "financially_disorganized"),
            ("meena@example.com",  "conservative_m","Secure@123","Meena Pillai",  "conservative_saver"),
        ]
        toks, metas = {}, {}
        for email, uname, pw, name, persona in USERS:
            tok, me = await reg(c, email, uname, pw, name)
            if tok: toks[persona]=tok; metas[persona]=me
        print(f"\n  {len(toks)}/10 users created")

        # ── Seed data ─────────────────────────────────────────────────────────
        print(f"\n{B}[STEP 2] Seeding 12-Month Financial Data{NC}")
        arjun_tok = toks.get("salaried_employee","")
        arjun_id  = metas.get("salaried_employee",{}).get("id","")
        priya_tok = toks.get("married_spouse","")

        if arjun_tok: await seed_arjun(c, arjun_tok)
        if toks.get("heavy_investor"): await seed_vikram(c, toks["heavy_investor"])
        if toks.get("debt_heavy"):     await seed_deepak(c, toks["debt_heavy"])
        if toks.get("crypto_trader"):  await seed_karan_crypto(c, toks["crypto_trader"])
        if toks.get("conservative_saver"): await seed_meena_saver(c, toks["conservative_saver"])
        if toks.get("family_oriented"):    await seed_ravi_family(c, toks["family_oriented"])
        if toks.get("freelancer"):         await seed_rahul_freelancer(c, toks["freelancer"])
        if toks.get("financially_disorganized"): await seed_ananya_chaos(c, toks["financially_disorganized"])

        # ── Sharing ───────────────────────────────────────────────────────────
        print(f"\n{B}[STEP 3] Sharing System{NC}")
        if arjun_tok and priya_tok:
            await test_sharing(c, arjun_tok, priya_tok, arjun_id)

        # ── Security ──────────────────────────────────────────────────────────
        print(f"\n{B}[STEP 4] Security Tests{NC}")
        if arjun_tok and priya_tok:
            await test_security(c, arjun_tok, priya_tok)

        # ── Financial Logic ───────────────────────────────────────────────────
        print(f"\n{B}[STEP 5] Financial Logic Validation{NC}")
        if arjun_tok:
            await test_financial_logic(c, arjun_tok, arjun_id)

        # ── Scale ─────────────────────────────────────────────────────────────
        print(f"\n{B}[STEP 6] Scale / Stress Test{NC}")
        if toks.get("financially_disorganized"):
            await test_scale(c, toks["financially_disorganized"])

        # ── Edge Cases ────────────────────────────────────────────────────────
        print(f"\n{B}[STEP 7] QA Edge Cases{NC}")
        if arjun_tok:
            await test_edge_cases(c, arjun_tok)

        # ── Debt User ─────────────────────────────────────────────────────────
        print(f"\n{B}[STEP 8] Debt-Heavy User Analysis{NC}")
        if toks.get("debt_heavy"):
            await test_debt_user(c, toks["debt_heavy"])

        # ── UX/Product Review ─────────────────────────────────────────────────
        ux_product_review()

        # ── FINAL REPORT ──────────────────────────────────────────────────────
        from collections import Counter
        sev = Counter(b["severity"] for b in BUGS)
        print(f"\n{B}{'═'*66}")
        print(f"  WAR ROOM COMPLETE — TECH LEAD BUG MANIFEST")
        print(f"{'═'*66}{NC}")
        print(f"\n  Total: {len(BUGS)} issues  |  {R}CRITICAL:{sev['CRITICAL']}  HIGH:{sev['HIGH']}{NC}  {Y}MEDIUM:{sev['MEDIUM']}{NC}  {G}LOW:{sev['LOW']}{NC}")

        for i, b in enumerate(BUGS, 1):
            col = R if b["severity"] in ("CRITICAL","HIGH") else Y if b["severity"]=="MEDIUM" else G
            print(f"\n  {col}#{i:02d} [{b['severity']}] [{b['module']}]{NC} — {b['category']}")
            print(f"       Problem: {b['problem']}")
            print(f"       Fix:     {b['suggested_fix']}")
            if b.get("impact"): print(f"       Impact:  {b['impact']}")

        print(f"\n{G}{'═'*66}")
        print(f"  ✓ WAR ROOM TEST COMPLETE")
        print(f"  Users:{len(toks)}  Bugs:{len(BUGS)}  CRITICAL:{sev['CRITICAL']}  HIGH:{sev['HIGH']}")
        print(f"{'═'*66}{NC}\n")

asyncio.run(main())
