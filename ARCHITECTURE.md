# My CFO — Personal Financial OS: Architecture

> **Self-Hosted Personal Financial Operating System — built for Indian users**

---

## 1. Vision & Philosophy

My CFO is not a budgeting app or an expense tracker. It is a **Financial Life Management Platform** — a single source of truth for every rupee a person earns, spends, owns, owes, or plans for.

**Core tenets:**
- **Complete**: Models the real financial life of an Indian — salary, SIPs, EMIs, gold, FD, insurance, taxes, UPI, wallets
- **Local-first**: All data self-hosted in PostgreSQL; no third-party cloud dependency
- **AI-native**: Every module feeds a local AI CFO (Ollama) that answers natural-language questions about your finances
- **Interlinked**: Every module is aware of every other — a loan payment affects banking, which affects net worth, which updates the AI context
- **Auditable**: Ledger-based tracking for every investment transaction and EMI payment

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  Next.js 15 (App Router) · TypeScript · Tailwind CSS            │
│  ECharts 5 (Sankey/Sunburst/Timeline) · D3.js 7 (Force graph)  │
│  Zustand 5 (auth + UI state) · TanStack Query v5 (server state) │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (nginx proxied)
┌──────────────────────────▼──────────────────────────────────────┐
│                      API GATEWAY (nginx :4000)                   │
│  /api/v1/** → FastAPI :8090   /*  → Next.js :3030               │
└──────────────┬─────────────────────────────┬────────────────────┘
               │                             │
┌──────────────▼──────────┐   ┌─────────────▼──────────────────┐
│   FastAPI Backend        │   │   Worker Layer (Celery + Redis) │
│   Async SQLAlchemy 2.0   │   │   - PDF/OCR parsing jobs        │
│   Pydantic v2            │   │   - Notification dispatch       │
│   JWT Auth (jose)        │   │   - Snapshot scheduler          │
│   Alembic migrations     │   │                                 │
└──────────────┬──────────┘   └────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────┐
│                     DATA LAYER                                   │
│  PostgreSQL 17 (primary store, JSONB for flexible fields)       │
│  Redis 7 (cache, task queues, session store)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Module Architecture

### 3.1 Core Financial Modules

| Module | Backend API | DB Tables | Key Feature |
|--------|-------------|-----------|-------------|
| Net Worth | `/net-worth` | net_worth_snapshots | Intelligence report, health score |
| Banking | `/bank-accounts` | bank_accounts, bank_transactions | Wallet/UPI reconciliation, cashflow |
| Income | `/income` | income_sources, income_entries | Monthly analytics, intelligence |
| Credit Cards | `/cards` | credit_cards, transactions, statements | Utilization gauge, PDF parsing |
| EMIs | `/emis` | emis, emi_payments | Month-aligned dates (relativedelta), 6-month forecast |
| Loans | `/loans` | loans | Amortization schedule, floating-rate reset |
| Investments | `/investments` | investments, investment_transactions | FIFO ledger, LTCG/STCG tax engine |
| Assets | `/assets` | assets | Depreciation, Director's loan (RECEIVABLE) |
| Insurance | `/insurance` | insurances | Premium tracking, renewal alerts |
| Goals | `/goals` | goals | Target/current tracking, milestone alerts |
| Recurring | `/recurring` | (derived from transactions) | Cross-source dedup, upcoming payments |
| Sharing | `/sharing` | share_permissions, share_invitations | Granular module-level read/write grants |

### 3.2 Cross-Module Interlinking

```
Income ──────┐
Banking ─────┤
Credit Cards ─┤
EMIs ─────────┤─→ Net Worth Intelligence Engine ─→ AI CFO Context
Loans ────────┤
Investments ──┤
Assets ───────┤
Insurance ────┘
Goals ────────→ Goal Progress Calculation
Recurring ────→ Subscription / SIP awareness
```

---

## 4. Database Schema

### 4.1 Core Identity

```sql
users
  id UUID PK
  email VARCHAR UNIQUE
  username VARCHAR UNIQUE
  full_name VARCHAR (nullable — falls back to username in UI)
  currency VARCHAR(3)   -- "INR"
  timezone VARCHAR       -- "Asia/Kolkata"
  created_at TIMESTAMPTZ

financial_entities
  id UUID PK | user_id FK
  entity_type ENUM(PERSONAL, SOLE_PROP, PRIVATE_LTD, LLP, HUF, PARTNERSHIP, TRUST)
  name | is_default | created_at

user_sessions
  id UUID PK | user_id FK
  refresh_token_hash | device_info | last_seen_at | is_active

share_permissions
  id UUID PK | owner_id FK | grantee_id FK
  module VARCHAR | can_write BOOL | created_at

share_invitations
  id UUID PK | inviter_id FK
  invite_code | expires_at | accepted_by FK | status ENUM
```

### 4.2 Banking Layer

```sql
bank_accounts
  id UUID PK | user_id FK | entity_id FK
  nickname | bank_name | ifsc_code | account_number_last4
  account_type ENUM(SAVINGS,CURRENT,SALARY,WALLET,UPI,CASH,FD,RD,NRE,NRO)
  current_balance NUMERIC(15,2) | minimum_balance | interest_rate
  maturity_date | maturity_amount
  is_primary | is_active | account_color

bank_transactions
  id UUID PK | user_id FK | account_id FK
  transaction_date | value_date | description | amount NUMERIC(15,2)
  tx_type ENUM(CREDIT,DEBIT,TRANSFER)
  category ENUM(... WALLET_LOAD, CC_WALLET_LOAD, WALLET_TRANSFER, WALLET_FEE ...)
  merchant_name | reference_no | balance_after
  -- Transfer/reconciliation fields (added in 0012):
  linked_tx_id UUID FK → bank_transactions(id) ON DELETE SET NULL
  linked_account_id UUID FK → bank_accounts(id)
  is_transfer_leg BOOLEAN DEFAULT FALSE   -- excludes from cashflow totals
  is_duplicate BOOLEAN DEFAULT FALSE
  is_excluded BOOLEAN DEFAULT FALSE
  is_hidden_charge BOOLEAN DEFAULT FALSE
  is_recurring BOOLEAN DEFAULT FALSE
  -- Enrichment fields (added in 0011):
  status ENUM(PENDING,SETTLED,RECONCILED)
  gross_amount | tds_amount | tds_section
  linked_investment_tx_id | linked_loan_id | linked_card_id
  import_source | raw_data JSONB
```

### 4.3 Credit Card Layer

```sql
credit_cards
  id UUID PK | user_id FK | nickname | bank_name | card_name
  last_four | network ENUM | status ENUM
  credit_limit | available_limit | current_outstanding
  interest_rate | billing_cycle_day | due_date_day
  annual_fee | reward_program | reward_rate | total_reward_points
  lounge_access | lounge_quota_quarterly
  expiry_month | expiry_year | card_color

transactions  -- credit card transactions
  id UUID PK | card_id FK | statement_id FK
  transaction_date | description | merchant_name | amount
  transaction_type ENUM | category ENUM
  is_emi | emi_id FK | gst_amount | cashback_amount | reward_points
  is_recurring | is_subscription | is_duplicate | is_suspicious
  is_excluded | tags JSONB

statements
  id UUID PK | card_id FK | filename | statement_date
  period_from | period_to | due_date
  opening_balance | closing_balance | total_due | minimum_due
  total_payments | total_purchases | total_emi | total_fees | total_interest
  reward_points_earned | status ENUM | bank_detected | parse_error
```

### 4.4 EMI & Loans Layer

```sql
emis
  id UUID PK | card_id FK
  product_name | merchant_name | purchase_date
  purchase_amount | total_amount | monthly_emi
  tenure_months | interest_rate | is_no_cost_emi
  processing_fee | total_interest | paid_months | remaining_months
  start_date | end_date | next_due_date  -- computed via relativedelta(months=n)
  amount_remaining  -- = total_amount - (monthly_emi * paid_months), NOT emi * remaining
  status ENUM | reminder_enabled | reminder_day

emi_payments
  id UUID PK | emi_id FK | installment_no
  due_date | paid_date | expected_amount | paid_amount
  is_paid | is_overdue | late_fee

loans
  id UUID PK | user_id FK | loan_type ENUM
  lender_name | loan_account_number | nickname
  principal_amount | outstanding_balance | emi_amount
  total_paid | total_interest_paid
  interest_rate | tenure_months | remaining_months
  start_date | end_date | emi_due_day
  status ENUM | is_secured | collateral | prepayment_penalty
  extra_data JSONB
```

### 4.5 Investment Layer

```sql
investments
  id UUID PK | user_id FK | entity_id FK
  investment_type ENUM(STOCKS,MUTUAL_FUND,ETF,CRYPTO,GOLD,SILVER,
                       SGB,PPF,EPF,NPS,BONDS,REITS,OTHER)
  name | symbol | folio_number
  units NUMERIC | avg_buy_price | current_price | current_value
  invested_amount | unrealized_pnl | realized_pnl | xirr | cagr
  is_sip | sip_amount | sip_date | sip_status ENUM
  weight_grams | purity           -- Gold/Silver specific
  maturity_date | coupon_rate     -- SGB/Bond specific
  last_coupon_date | next_coupon_date | price_source
  lock_in_until | is_locked | broker | platform
  purchase_date | extra_data JSONB

investment_transactions  -- auditable ledger
  id UUID PK | investment_id FK | user_id FK
  tx_type ENUM(BUY,SELL,BONUS,SPLIT,DIVIDEND,COUPON,SWITCH_IN,SWITCH_OUT,MATURITY)
  transaction_date | units | price | amount
  cost_basis | realized_gain | holding_days
  tax_category ENUM | estimated_tax NUMERIC
  notes | extra_data JSONB
```

### 4.6 Asset Layer

```sql
assets
  id UUID PK | user_id FK | entity_id FK
  asset_type ENUM(REAL_ESTATE,VEHICLE,JEWELRY,ELECTRONICS,
                  FURNITURE,ARTWORK,RECEIVABLE,OTHER)
  name | description
  purchase_price | current_value | purchase_date
  depreciation_rate | depreciation_method ENUM
  location | area_sqft                           -- Real estate
  registration_number | make_model | year_of_manufacture  -- Vehicle
  -- RECEIVABLE fields (Director's loan):
  counterparty_name | counterparty_entity_id FK
  due_date | interest_rate
  is_insured | insurance_expiry | is_mortgaged | mortgage_outstanding
  extra_data JSONB
```

### 4.7 Income Layer

```sql
income_sources
  id UUID PK | user_id FK
  name | income_type ENUM(SALARY,FREELANCE,BUSINESS,CONSULTING,
                          RENTAL,INTEREST,DIVIDEND,SIDE_HUSTLE,
                          PENSION,REMITTANCE,OTHER)
  monthly_amount NUMERIC | is_variable BOOL
  variable_min | variable_max
  is_active | employer | tax_deducted_pct | start_date | notes

income_entries
  id UUID PK | user_id FK | source_id FK
  entry_date | amount | notes | created_at
```

### 4.8 Insurance Layer

```sql
insurances
  id UUID PK | user_id FK
  insurance_type ENUM(HEALTH,TERM,LIFE,VEHICLE,TRAVEL,PROPERTY,OTHER)
  policy_name | insurer | policy_number
  premium_amount | premium_frequency ENUM(MONTHLY,QUARTERLY,HALF_YEARLY,YEARLY)
  sum_assured | cover_amount
  start_date | end_date | renewal_date
  beneficiary | is_active | notes | extra_data JSONB
```

### 4.9 Goals Layer

```sql
goals
  id UUID PK | user_id FK
  name | goal_type ENUM(EMERGENCY_FUND,RETIREMENT,HOUSE,CAR,
                        EDUCATION,VACATION,DEBT_FREE,INVESTMENT,OTHER)
  target_amount | current_amount
  target_date | monthly_contribution
  priority ENUM(HIGH,MEDIUM,LOW)
  status ENUM(ACTIVE,ACHIEVED,PAUSED,CANCELLED)
  icon_color | notes
```

### 4.10 Net Worth Snapshots

```sql
net_worth_snapshots
  id UUID PK | user_id FK
  snapshot_date TIMESTAMPTZ
  net_worth | total_assets | total_liabilities
  bank_balance | investment_value | asset_value
  loan_outstanding | cc_outstanding
  extra_data JSONB  -- liquid_net_worth, health_score, debt_ratio
```

---

## 5. Wallet / UPI Reconciliation Engine

`backend/app/services/wallet_reconciler.py`

### Problem classes

| Problem | Detection | Fix |
|---------|-----------|-----|
| UPI duplicate | Same `reference_no` (UTR) + both DEBIT across different accounts | Wallet side: `is_excluded=True`, `is_duplicate=True`, `linked_tx_id` → bank |
| Wallet load | Same UTR or fuzzy match: bank DEBIT + wallet CREDIT | Both legs: `is_transfer_leg=True`, `is_excluded=True`; categories → `WALLET_LOAD` / `TRANSFER_IN` |
| CC→wallet | Wallet CREDIT with CC keywords in description | Wallet CREDIT: `is_transfer_leg=True`, category → `CC_WALLET_LOAD` |
| Wallet fees | Description matches fee/MDR/GST keywords | `category=WALLET_FEE`, `is_hidden_charge=True` |

### Reconciliation passes

```
Pass 1: UTR exact match
  - Group all transactions by reference_no (min 8 chars)
  - Same ref across different accounts:
    - Both DEBIT → UPI dup (wallet side excluded)
    - DEBIT + CREDIT → wallet load (_mark_wallet_load_pair)

Pass 2: Fuzzy match (no UTR available)
  - Bank DEBIT with wallet keywords in description
  - Search wallet CREDITs within ±3 days, amount ±₹1
  - Single unambiguous match → mark as wallet load pair

Pass 3: Wallet fee tagging
  - Scan all txs for fee/MDR/GST keywords
  - category → WALLET_FEE, is_hidden_charge=True

Pass 4: CC→wallet credit
  - Wallet account CREDITs with "credit card / loaded via CC" patterns
  - category → CC_WALLET_LOAD, is_transfer_leg=True, is_excluded=True
```

### Cashflow impact

All `is_transfer_leg=True` rows are excluded from inflow/outflow totals. Money moving between accounts (bank → wallet) does not inflate expense figures.

### Index

`ix_bank_tx_user_refno ON bank_transactions(user_id, reference_no) WHERE reference_no IS NOT NULL` — enables fast UTR group lookups without full table scan.

---

## 6. API Architecture

### 6.1 REST API Structure

```
/api/v1/
├── auth/                login, register, refresh, logout, sessions, profile, /me
├── bank-accounts/       CRUD + /analytics/cashflow + /{id}/transactions + /reconcile
├── income/              CRUD sources + entries + /analytics/intelligence
├── cards/               CRUD + /utilization
├── transactions/        CRUD + /analytics/*
├── emis/                CRUD + /record-payment + /analytics/forecast
├── friends/             CRUD + /analytics/intelligence-dashboard
├── statements/          upload, status, CRUD
├── loans/               CRUD + /analytics/intelligence + /amortization
├── investments/         CRUD + /analytics/intelligence + /transactions + /tax-summary
├── assets/              CRUD + /analytics/intelligence
├── insurance/           CRUD + /analytics/intelligence
├── goals/               CRUD + /analytics/intelligence + /{id}/contribute
├── net-worth/           current + intelligence + snapshot + history
├── recurring/           summary + upcoming (deduplicated)
├── reports/             dashboard + spending
├── sharing/             permissions, invitations, relationships
└── insights/            list + mark-read + dismiss + generate
```

### 6.2 Authentication Flow

```
1. POST /auth/register → creates user + default PERSONAL entity
2. POST /auth/login    → { access_token, refresh_token }
3. All requests:         Authorization: Bearer <access_token>
4. POST /auth/refresh  → rotates both tokens (old refresh invalidated)
5. DELETE /auth/sessions/{id} → revoke a specific device session
6. POST /auth/logout-all     → revoke all sessions

Frontend 401 handling (api.ts interceptor):
  - Attempt token refresh once
  - If refresh fails AND not on /login or /signup → redirect to /login
  - If already on /login/signup → clear tokens silently (no redirect loop)
```

### 6.3 Query parameter limits

| Endpoint | Max `page_size` | Notes |
|----------|:--------------:|-------|
| `/transactions` | 200 | Frontend paginates in loops for export |
| `/bank-accounts/{id}/transactions` | 200 | Same |
| `/cards` | no pagination | Returns all cards for user |

---

## 7. Financial Calculation Engine

### 7.1 Net Worth Formula

```
Net Worth = Total Assets − Total Liabilities

Total Assets =
  bank_balance (non-excluded, non-transfer-leg accounts) +
  investment_current_value +
  asset_current_value

Total Liabilities =
  loan_outstanding_balance +
  credit_card_current_outstanding

Liquid Net Worth =
  (SAVINGS + CURRENT + SALARY + WALLET + UPI + CASH balances) +
  (non-locked, liquid investment types) −
  credit_card_outstanding
```

### 7.2 Financial Health Score (0–100)

```
Liquidity Score (25pts):   emergency_months ÷ 6 × 25
Debt Score (30pts):        30 − (debt_ratio × 60)   [debt_ratio = liabilities/assets]
Investment Score (25pts):  investment_ratio × 50     [invest_ratio = investments/assets]
Stability Score (20pts):   income stability + savings rate component
```

### 7.3 EMI Calculations

```python
# Month-aligned due dates (no 30-day drift across month boundaries)
from dateutil.relativedelta import relativedelta
base = start_date.replace(day=min(start_date.day, 28))
for i in range(1, tenure_months + 1):
    due_date = base + relativedelta(months=i)

# Correct amount_remaining (avoids rounding drift from emi × months)
amount_remaining = max(0, total_amount - (monthly_emi * paid_months))
# NOT: monthly_emi × remaining_months (accumulates rounding error)
```

### 7.4 EMI Burden Ratio

```
EMI Burden = (total_monthly_emi + cc_min_due) ÷ monthly_income × 100
Green: < 35%  |  Yellow: 35–50%  |  Red: > 50%
```

### 7.5 XIRR Calculation

Newton-Raphson iteration on the cash flow series:
```
f(r) = Σ CF_i / (1 + r)^(t_i) = 0
```
where CF_i are cash flows and t_i are times in years from first investment.

### 7.6 Recurring Deduplication

Three-layer deduplication for recurring payments:
```
1. Structured sources take priority:
   structured_names = investments + liabilities + insurance + lending (all lowercase)
   bank-detected subscriptions/utilities are excluded if name matches any structured name

2. Subscriptions take priority over utilities:
   utility_items = [i for i in utility_items if name not in subscription_names]

3. Upcoming payments list dedup:
   seen = set of (name.lower(), round(amount, 0), date_str)
   skip if already seen
```

---

## 8. PDF Ingestion Pipeline

```
PDF Upload
    │
    ▼
┌─────────────────────┐
│  Text Extraction     │  pdfplumber → PyMuPDF (fallback)
│  pikepdf decrypt     │  for password-protected PDFs
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Bank Detector       │  ← HDFC/ICICI/SBI/Axis/Kotak/IDFC/AU/Amex/SC
│  (header patterns)  │     → GenericParser fallback
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Transaction Parser  │
│  (regex rules)       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  AI Categorizer      │  ← Maps merchant → category (18 categories, 60+ rules)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Duplicate Detector  │  ← (card, date, amount, desc) hash
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Wallet Reconciler   │  ← reconcile_for_user() — 4 passes
└──────────┬──────────┘
           │
           ▼
    DB Insert + Event
```

> **Note:** Screenshot / image-based parsing (Cred OCR via Tesseract + Pillow) has been removed. Only PDF uploads are supported. Image import will be re-added when a dedicated OCR module is available.

---

## 9. AI CFO Architecture

### 9.1 RAG Pipeline

```
User Question
     │
     ▼
Financial Context Builder
  ├── net_worth.current()
  ├── loans.intelligence()
  ├── investments.intelligence()
  ├── banking.cashflow()
  └── income.intelligence()
     │
     ▼
System Prompt Assembly
  "You are a personal CFO for an Indian user.
   Here is their financial snapshot: {context}"
     │
     ▼
┌────────────┐
│ Ollama API │  ← Try first (OLLAMA_BASE_URL)
│ llama3     │
└─────┬──────┘
      │ Connection failed
      ▼
Rule-Based Fallback
  ├── Keyword pattern matching
  ├── Pre-computed insight templates
  └── Structured financial Q&A
```

### 9.2 Ollama Models

```python
OLLAMA_MODELS = {
    "default":    "llama3",
    "fast":       "qwen2.5:3b",
    "reasoning":  "deepseek-r1:7b",
    "embeddings": "nomic-embed-text",
}
```

---

## 10. Notification Engine

| Event | Timing | Severity |
|-------|--------|----------|
| EMI due | 3 days before | HIGH |
| Credit card due | 5 days before | HIGH |
| Insurance renewal | 30 days before | MEDIUM |
| SIP debit | 2 days before | LOW |
| Low balance | Below min balance | HIGH |
| Goal milestone | On 25/50/75/100% | INFO |
| Net worth change | Weekly | INFO |

Delivery: In-app (Insight table → `/insights` API) · Email (SMTP via Celery) · WhatsApp (optional, Twilio)

---

## 11. Security Architecture

```
Application Security
  • JWT (HS256, configurable expiry) for API auth
  • Refresh token rotation — each refresh invalidates the previous token
  • Per-device sessions with last-seen tracking
  • bcrypt password hashing (rounds=12)
  • CORS whitelist (nginx origin only)
  • All DB queries parameterized (SQLAlchemy ORM)
  • Row-level user isolation — every query filtered by user_id
  • 401 interceptor guard — no redirect loop on /login or /signup pages

Data Security
  • Sensitive fields (account numbers) stored as last-4 only
  • AES-256-GCM encryption on sensitive structured fields
  • PDF passwords processed in memory, not stored
  • Document uploads: size limits enforced (MAX_UPLOAD_SIZE_MB)

Infrastructure Security
  • All services on internal Docker network
  • Only nginx exposed on host port 4000
  • PostgreSQL/Redis not directly reachable from outside
  • Secrets via .env (never in source, never in image layers)
  • No insecure fallback defaults — stack won't start without proper .env
```

---

## 12. Docker Infrastructure

```
services:
  nginx        :4000 (host) → proxies /api/* to backend, /* to frontend
  frontend     :3030 (internal) — Next.js standalone build
  backend      :8090 (internal) — FastAPI + uvicorn
  postgres     :5555 (host) → :5432 (internal) — PostgreSQL 17
  redis        :6666 (host) → :6379 (internal) — Redis 7
  worker       (internal) — Celery worker (OCR + notifications)
```

**Startup order (health-checked):**
```
postgres ──(healthy)──┐
                      ├──► backend ──(healthy)──► frontend ──(healthy)──► nginx
redis    ──(healthy)──┘         └──► worker
```

**Important:** Backend Python code is `COPY`'d into the Docker image at build time. Code changes require:
```bash
docker compose build backend && docker compose up -d backend
```

---

## 13. Frontend Architecture

### 13.1 State Management

| Store | Library | What it holds |
|-------|---------|---------------|
| Auth state | Zustand + persist | `access_token`, `refresh_token`, `user`, `logout()` |
| UI state | Zustand | Sidebar open/closed, mobile drawer, active tab |
| Server state | TanStack Query | All API data — cached, deduplicated, prefetched on hover |

### 13.2 API Client (`lib/api.ts`)

```typescript
// Axios instance with base URL = '' (relative, routed by nginx)
// Request interceptor: injects Authorization: Bearer <access_token>
// Response interceptor (401 handling):
//   1. Try POST /auth/refresh to rotate tokens
//   2. If refresh fails:
//      - If NOT on /login or /signup → redirect to /login
//      - If on /login or /signup → clear tokens silently (no redirect loop)
```

### 13.3 Key design patterns

- **Debounced search**: TransactionsView uses 300ms debounce before firing API query — avoids per-keystroke requests
- **Paginated export**: SettingsView fetches transactions in loops of 200 (backend max) until all records collected
- **Responsive filters**: TransactionsView filter row stacks on mobile, inline on desktop
- **Currency formatting**: `formatCurrencyCompact()` already prepends `₹` — never add hardcoded `₹${...}` prefix
- **Hover prefetch**: All sidebar links call TanStack Query `prefetchQuery` on hover to warm cache before navigation

---

## 14. Phased Roadmap

### Phase 1 ✅ (Complete)
- Basic models: Cards, Transactions, EMIs, Friends, Statements
- PDF parser + OCR pipeline, 18-category merchant classifier
- Basic dashboard + all views

### Phase 2 ✅ (Complete)
- Financial OS: Banking, Investments, Loans, Assets, Net Worth
- Intelligence engines for all 5 modules
- AI insights (rule-based)

### Phase 3 ✅ (Complete)
- Income, Insurance, Goals management
- Auth + per-device sessions + financial sharing
- Investment ledger + LTCG/STCG tax engine
- Wallet/UPI reconciliation engine
- Visualize module (Universe, Cash Flow, Allocation, Timeline)
- Card EMI month-aligned date fixes
- Recurring dedup across structured + bank-detected sources
- Excel export with full pagination

### Phase 4 (Next)
- Tax Management (ITR, TDS, capital gains reporting)
- pgvector + RAG for AI CFO (semantic search over transactions)
- CAS/Zerodha/Groww import connectors
- WhatsApp notification integration
- Real-time price feeds (NSE/BSE/crypto APIs)

### Phase 5 (Future)
- Mobile app (React Native)
- Bank statement auto-sync (Account Aggregator framework)
- Multi-user family mode with consolidated net worth view
- Chartered Accountant portal

---

*This document is the living architecture reference for My CFO. Update whenever new modules or significant patterns are added.*
