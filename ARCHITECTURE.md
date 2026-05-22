# FinOS — Personal Financial Operating System: Architecture

> **The Definitive Self-Hosted AI-Powered Personal Financial Operating System for Indian Users**

---

## 1. Vision & Philosophy

FinOS is not a budgeting app or an expense tracker. It is a **Financial Life Management Platform** — a single source of truth for every rupee a person earns, spends, owns, owes, or plans for.

**Core tenets:**
- **Complete**: Models the real financial life of an Indian — salary, SIPs, EMIs, gold, FD, insurance, taxes
- **Local-first**: All data self-hosted in PostgreSQL; no third-party cloud dependency
- **AI-native**: Every module feeds a local AI CFO (Ollama) that answers natural-language questions about your finances
- **Interlinked**: Every module is aware of every other — a loan payment affects banking, which affects net worth, which updates the AI context
- **Auditable**: Double-entry accounting foundation for every financial event

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  Next.js 15 (App Router) · TypeScript · Tailwind · Recharts     │
│  Zustand (state) · TanStack Query v5 (server state)             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│                      API GATEWAY (nginx)                         │
│  /api/v1/** → FastAPI backend   /static → Next.js assets        │
└──────────────┬─────────────────────────────┬────────────────────┘
               │                             │
┌──────────────▼──────────┐   ┌─────────────▼──────────────────┐
│   FastAPI Backend        │   │   Worker Layer (Celery + Redis) │
│   Async SQLAlchemy       │   │   - PDF/OCR parsing jobs        │
│   Pydantic v2            │   │   - AI embedding generation     │
│   JWT Auth               │   │   - Notification dispatch       │
│   Alembic migrations     │   │   - Snapshot scheduler          │
└──────────────┬──────────┘   └────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────┐
│                     DATA LAYER                                   │
│  PostgreSQL 15 (primary data store, JSONB for flexible fields)  │
│  Redis (cache, task queues, session store, pub/sub)             │
│  pgvector (vector embeddings for AI CFO RAG)                    │
└──────────────┬──────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────┐
│                     AI LAYER                                     │
│  Ollama (local LLM inference)                                   │
│  Models: llama3, qwen2.5, mistral, deepseek-r1                  │
│  Embeddings: nomic-embed-text or mxbai-embed-large              │
│  RAG: pgvector similarity search over financial embeddings      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Module Architecture

### 3.1 Core Financial Modules

| Module | Backend API | DB Tables | Intelligence Endpoint |
|--------|-------------|-----------|----------------------|
| Net Worth | `/net-worth` | net_worth_snapshots | `/intelligence` |
| Banking | `/bank-accounts` | bank_accounts, bank_transactions | `/analytics/cashflow` |
| Income | `/income` | income_sources, income_entries | `/analytics/intelligence` |
| Credit Cards | `/cards` | credit_cards, transactions, statements | `/utilization` |
| EMIs | `/emis` | emis, emi_payments | `/analytics/forecast` |
| Loans | `/loans` | loans | `/analytics/intelligence` |
| Investments | `/investments` | investments | `/analytics/intelligence` |
| Assets | `/assets` | assets | `/analytics/intelligence` |
| Insurance | `/insurance` | insurances | `/analytics/intelligence` |
| Goals | `/goals` | goals | `/analytics/intelligence` |
| Tax | `/tax` | tax_records | `/analytics/summary` |
| Friends | `/friends` | friends | `/analytics/intelligence-dashboard` |
| AI CFO | `/ai-cfo` | ai_conversations | `/chat`, `/history` |

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
```

Every module's intelligence endpoint invalidates `net-worth-intelligence` in the React Query cache, ensuring real-time net worth accuracy.

---

## 4. Database Schema (Complete ER Overview)

### 4.1 Core Identity

```sql
users
  id UUID PK
  email VARCHAR UNIQUE
  username VARCHAR
  full_name VARCHAR
  currency VARCHAR(3)   -- "INR"
  timezone VARCHAR       -- "Asia/Kolkata"
  created_at TIMESTAMPTZ
```

### 4.2 Banking Layer

```sql
bank_accounts
  id UUID PK | user_id FK | nickname | bank_name
  account_type ENUM(SAVINGS,CURRENT,SALARY,WALLET,UPI,CASH,FD,RD)
  account_number_last4 | ifsc_code
  current_balance NUMERIC(15,2) | minimum_balance | interest_rate
  maturity_date | maturity_amount
  is_primary | is_active | account_color
  balance_updated_at

bank_transactions
  id UUID PK | user_id FK | account_id FK
  transaction_date | value_date | description | amount
  tx_type ENUM(CREDIT,DEBIT,TRANSFER) | category
  merchant_name | reference_no | balance_after
  linked_account_id FK | is_duplicate | is_hidden_charge
  is_recurring | is_excluded | import_source | raw_data JSONB
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

transactions (credit card)
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
  id UUID PK | card_id FK | friend_id FK
  product_name | merchant_name | purchase_date
  purchase_amount | total_amount | monthly_emi
  tenure_months | interest_rate | is_no_cost_emi
  processing_fee | total_interest | paid_months | remaining_months
  start_date | end_date | next_due_date
  owner_type ENUM | user_share_percent | status ENUM
  amount_collected | reminder_enabled | reminder_day

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
  id UUID PK | user_id FK
  investment_type ENUM(STOCKS,MUTUAL_FUND,ETF,CRYPTO,GOLD,SILVER,
                       SGB,PPF,EPF,NPS,BONDS,REITS,OTHER)
  name | symbol | folio_number
  units NUMERIC | avg_buy_price | current_price | current_value
  invested_amount
  is_sip | sip_amount | sip_date | sip_status ENUM
  sip_start_date | sip_end_date
  weight_grams | purity        -- Gold specific
  broker | platform
  lock_in_until | is_locked
  unrealized_pnl | realized_pnl | xirr | cagr
  purchase_date | extra_data JSONB
```

### 4.6 Asset Layer

```sql
assets
  id UUID PK | user_id FK
  asset_type ENUM(REAL_ESTATE,VEHICLE,JEWELRY,ELECTRONICS,
                  FURNITURE,ARTWORK,OTHER)
  name | description
  purchase_price | current_value | purchase_date
  depreciation_rate | depreciation_method
  location | area_sqft                  -- Real estate
  registration_number | make_model | year_of_manufacture  -- Vehicle
  is_insured | insurance_expiry | insurance_value
  is_mortgaged | mortgage_outstanding
  extra_data JSONB
```

### 4.7 Income Layer (New)

```sql
income_sources
  id UUID PK | user_id FK
  name | income_type ENUM(SALARY,FREELANCE,BUSINESS,CONSULTING,
                          RENTAL,INTEREST,DIVIDEND,SIDE_HUSTLE,
                          PENSION,REMITTANCE,OTHER)
  monthly_amount NUMERIC       -- fixed/expected amount
  is_variable BOOL             -- salary=false, freelance=true
  variable_min | variable_max  -- range for variable income
  is_active | employer
  tax_deducted_pct             -- TDS %
  start_date | notes

income_entries
  id UUID PK | user_id FK | source_id FK
  entry_date | amount | notes | created_at
```

### 4.8 Insurance Layer (New)

```sql
insurances
  id UUID PK | user_id FK
  insurance_type ENUM(HEALTH,TERM,LIFE,VEHICLE,TRAVEL,PROPERTY,OTHER)
  policy_name | insurer | policy_number
  premium_amount | premium_frequency ENUM(MONTHLY,QUARTERLY,HALF_YEARLY,YEARLY)
  sum_assured | cover_amount
  start_date | end_date | renewal_date
  beneficiary | is_active | notes
  extra_data JSONB
```

### 4.9 Goals Layer (New)

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

### 4.10 AI CFO Layer (New)

```sql
ai_conversations
  id UUID PK | user_id FK
  session_id UUID              -- group messages into sessions
  role ENUM(user,assistant,system)
  content TEXT
  context_snapshot JSONB       -- financial data snapshot at time of message
  model_used VARCHAR
  created_at TIMESTAMPTZ

-- Vector store for RAG
financial_embeddings
  id UUID PK | user_id FK
  content_type VARCHAR         -- 'transaction', 'insight', 'summary'
  content TEXT
  embedding vector(768)        -- pgvector
  metadata JSONB
  created_at TIMESTAMPTZ
```

### 4.11 Net Worth Snapshots

```sql
net_worth_snapshots
  id UUID PK | user_id FK
  snapshot_date TIMESTAMPTZ
  net_worth | total_assets | total_liabilities
  bank_balance | investment_value | asset_value
  loan_outstanding | cc_outstanding
  extra_data JSONB              -- liquid_net_worth, health_score, debt_ratio
```

---

## 5. API Architecture

### 5.1 REST API Structure

```
/api/v1/
├── auth/           login, refresh, me
├── bank-accounts/  CRUD + /analytics/cashflow + /{id}/transactions
├── income/         CRUD sources + entries + /analytics/intelligence
├── cards/          CRUD + /utilization
├── transactions/   CRUD + /analytics/*
├── emis/           CRUD + /record-payment + /analytics/forecast
├── friends/        CRUD + /analytics/intelligence-dashboard
├── statements/     upload, status, CRUD
├── loans/          CRUD + /analytics/intelligence
├── investments/    CRUD + /analytics/intelligence
├── assets/         CRUD + /analytics/intelligence
├── insurance/      CRUD + /analytics/intelligence
├── goals/          CRUD + /analytics/intelligence + /{id}/contribute
├── tax/            CRUD + /analytics/summary
├── net-worth/      current + intelligence + snapshot + history
├── ai-cfo/         chat + history + clear
├── reports/        dashboard + spending
└── insights/       list + mark-read + dismiss + generate
```

### 5.2 Authentication Flow

```
1. POST /auth/login → { access_token, token_type }
2. All requests: Authorization: Bearer <token>
3. JWT payload: { sub: user_id, exp: ... }
4. Token validation via get_current_user dependency
```

---

## 6. AI CFO Architecture

### 6.1 RAG Pipeline

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
│ Ollama API │  ← Try first (http://localhost:11434)
│ llama3     │
└─────┬──────┘
      │ Connection failed
      ▼
Rule-Based Fallback
  ├── Keyword pattern matching
  ├── Pre-computed insight templates
  └── Structured financial Q&A
     │
     ▼
Response + Store in ai_conversations
```

### 6.2 Ollama Integration

```python
OLLAMA_MODELS = {
    "default":    "llama3",
    "fast":       "qwen2.5:3b",
    "reasoning":  "deepseek-r1:7b",
    "embeddings": "nomic-embed-text",
}

# Environment: OLLAMA_HOST=http://localhost:11434
```

### 6.3 AI Financial Context Schema

```json
{
  "user": { "name": "...", "currency": "INR" },
  "net_worth": { "total": 0, "liquid": 0, "health_score": 0 },
  "banking": { "total_balance": 0, "burn_rate": 0, "runway_months": 0 },
  "income": { "monthly_net": 0, "sources": [] },
  "debt": { "total_outstanding": 0, "monthly_emi": 0 },
  "investments": { "total_value": 0, "pnl_pct": 0 },
  "insurance": { "covered": true, "gaps": [] },
  "goals": { "active_count": 0, "on_track": 0 }
}
```

---

## 7. OCR + Ingestion Pipeline

```
Document Upload (PDF/CSV/Excel/Image)
         │
         ▼
┌─────────────────────┐
│  Document Classifier │  ← What type is this?
│  (bank stmt / CC /   │
│   loan / CAS / tax)  │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │              │
    ▼              ▼
PDF Parser      Image OCR
(pdfplumber)   (Tesseract / PaddleOCR)
    │              │
    └──────┬───────┘
           │
           ▼
┌─────────────────────┐
│  Bank Detector       │  ← HDFC/ICICI/SBI/Axis/Kotak/IDFC/AU
│  (header patterns)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Transaction Parser  │
│  (regex + LLM)       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  AI Categorizer      │  ← Maps merchant → category
│  (rule-based + LLM) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Duplicate Detector  │  ← (account, date, amount, desc) hash
└──────────┬──────────┘
           │
           ▼
    DB Insert + Event
```

---

## 8. Notification Engine

### 8.1 Trigger Conditions

| Event | Timing | Severity |
|-------|--------|----------|
| EMI due | 3 days before | HIGH |
| Credit card due | 5 days before | HIGH |
| Insurance renewal | 30 days before | MEDIUM |
| SIP debit | 2 days before | LOW |
| Low balance | Below min balance | HIGH |
| Goal milestone | On 25/50/75/100% | INFO |
| Net worth change | Weekly | INFO |

### 8.2 Delivery Architecture

```
Celery Beat Scheduler (daily)
        │
        ▼
Notification Generator
  ├── Check all conditions
  ├── Create Insight records
  └── Dispatch via channels:
       ├── In-app (Insight table → /insights API)
       ├── Email (SMTP via Celery task)
       └── WhatsApp (Twilio/Meta API — optional)
```

---

## 9. Double-Entry Ledger Design

Every financial event maps to a ledger entry:

```
DEBIT account  |  CREDIT account  |  Amount  |  Event
───────────────────────────────────────────────────────
EMI (asset)    |  Bank account    |  ₹10,000 |  EMI payment
Investment     |  Bank account    |  ₹5,000  |  SIP debit
Expense        |  Credit card     |  ₹2,000  |  CC purchase
Salary         |  Bank account    |  ₹80,000 |  Income credit
Loan principal |  Bank account    |  ₹25,000 |  Loan disbursement
```

Each transaction row stores:
- `debit_account_id`, `debit_account_type`
- `credit_account_id`, `credit_account_type`
- `amount`, `currency`, `fx_rate`
- `event_type`, `event_ref_id`
- `tax_category`, `user_id`, `created_at`

---

## 10. Security Architecture

```
┌─────────────────────────────────────────────────────┐
│ Application Security                                 │
│  • JWT (HS256, 30-day expiry) for API auth           │
│  • bcrypt password hashing (rounds=12)               │
│  • CORS whitelist (nginx origin only)                │
│  • Rate limiting (100 req/min per IP via Redis)      │
│  • All DB queries use parameterized statements       │
│  • User isolation: every query filtered by user_id  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Data Security                                        │
│  • Sensitive fields (account numbers) stored as      │
│    last-4 only — never full number                  │
│  • Document uploads: virus scan + size limits        │
│  • PDF passwords: processed in memory, not stored   │
│  • Audit log: all mutations logged with timestamp   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Infrastructure Security                              │
│  • All services on internal Docker network           │
│  • Only nginx exposed on 80/443                     │
│  • PostgreSQL/Redis not reachable from host         │
│  • Secrets via .env (never in source)               │
└─────────────────────────────────────────────────────┘
```

---

## 11. Docker Infrastructure

```yaml
services:
  nginx:        # reverse proxy + static files
  frontend:     # Next.js (standalone build)
  backend:      # FastAPI + uvicorn
  db:           # PostgreSQL 15 + pgvector
  redis:        # Redis 7
  celery:       # Celery worker (OCR + notifications)
  celery-beat:  # Celery scheduler (daily notifications)
  ollama:       # Local LLM inference (GPU optional)
```

Port exposure (host):
- `80` → nginx (HTTP)
- `443` → nginx (HTTPS with self-signed cert)

All other services: internal network only.

---

## 12. Financial Calculation Engine

### 12.1 Net Worth Formula

```
Net Worth = Total Assets − Total Liabilities

Total Assets = 
  bank_balance +
  investment_current_value +
  asset_current_value

Total Liabilities =
  loan_outstanding_balance +
  credit_card_current_outstanding

Liquid Net Worth =
  (SAVINGS + CURRENT + SALARY + WALLET + UPI + CASH accounts) +
  (non-locked, liquid investment types) −
  credit_card_outstanding
```

### 12.2 Financial Health Score (0–100)

```
Liquidity Score (25pts):   emergency_months ÷ 6 × 25
Debt Score (30pts):        30 − (debt_ratio × 60)   [debt_ratio = liabilities/assets]
Investment Score (25pts):  investment_ratio × 50     [invest_ratio = investments/assets]
Stability Score (20pts):   income stability + savings rate component
```

### 12.3 EMI Burden Ratio

```
EMI Burden = (total_monthly_emi + cc_min_due) ÷ monthly_income × 100

Green:  < 35%
Yellow: 35–50%
Red:    > 50%
```

### 12.4 XIRR Calculation

XIRR is computed via Newton-Raphson iteration on the cash flow series:
```
f(r) = Σ CF_i / (1 + r)^(t_i) = 0
```
where CF_i are cash flows and t_i are times in years from first investment.

### 12.5 Diversification Score

```
score = min(100, num_asset_classes × 12 + (100 - max_concentration_pct) × 0.55)
```

---

## 13. Phased Roadmap

### Phase 1 ✅ (Complete)
- Basic models: Cards, Transactions, EMIs, Friends, Statements
- PDF parser + OCR pipeline
- Basic dashboard + all views

### Phase 2 ✅ (Complete)
- Financial OS: Banking, Investments, Loans, Assets, Net Worth
- Intelligence engines for all 5 modules
- AI insights (rule-based)
- Interlinked navigation

### Phase 3 ✅ (Current)
- Income Management
- Insurance Management
- Goal Tracking System
- AI CFO (Ollama + rule-based fallback)
- Financial Command Center Dashboard
- Full sidebar restructure

### Phase 4 (Next)
- Tax Management (ITR, TDS, capital gains)
- Double-entry ledger layer
- pgvector + RAG for AI CFO
- WhatsApp notification integration
- CAS/Zerodha/Groww import connectors
- Financial sharing & collaboration engine

### Phase 5 (Future)
- Mobile app (React Native)
- Bank statement auto-sync (AA framework)
- Real-time price feeds (NSE/BSE/crypto)
- Multi-user family mode
- Chartered Accountant portal

---

## 14. Tech Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 15, TypeScript | SSR + type safety |
| UI | Tailwind CSS, Framer Motion | Rapid styling + animations |
| Charts | Recharts | Lightweight, composable |
| State | Zustand + TanStack Query | Local + server state |
| Backend | FastAPI, Python 3.12 | Async, typed, fast |
| ORM | SQLAlchemy 2.x async | Async DB operations |
| DB | PostgreSQL 15 + pgvector | JSONB + vector search |
| Cache | Redis 7 | Session + task queues |
| Workers | Celery + Celery Beat | Background jobs |
| AI | Ollama (llama3, qwen2.5) | Local LLM, no API cost |
| OCR | pdfplumber + Tesseract | PDF + image extraction |
| Auth | JWT (python-jose) | Stateless auth |
| Infra | Docker Compose | Single-host self-hosted |

---

*This document is the living architecture reference for FinOS. Update as new modules are added.*
