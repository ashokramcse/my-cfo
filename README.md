<div align="center">

<h1>
  <img src="https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/26a1.svg" width="40" height="40" alt="zap" />
  &nbsp;My CFO
</h1>

<p><strong>Self-Hosted Personal Financial OS</strong></p>

<p>
  A complete, privacy-first financial operating system — track your net worth, investments,<br/>
  loans, banking, credit cards, income, insurance, and goals, all on your own infrastructure.<br/>
  Built for Indian users with first-class support for MF NAVs, SGBs, LTCG/STCG tax,<br/>
  floating-rate loans, wallet/UPI reconciliation, and multi-entity (personal + business) finance.
</p>

<br/>

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## Table of Contents

- [Why My CFO?](#why-my-cfo)
- [Quick Start](#quick-start)
- [Port Reference](#port-reference)
- [Module Reference](#module-reference)
- [Architecture](#architecture)
- [Investment Ledger & Tax Engine](#investment-ledger--tax-engine)
- [Wallet & UPI Reconciliation](#wallet--upi-reconciliation)
- [Multi-Entity Finance](#multi-entity-finance)
- [Supported Banks](#supported-banks)
- [Tech Stack](#tech-stack)
- [Configuration](#configuration)
- [Commands Reference](#commands-reference)
- [Security](#security)
- [Local Development](#local-development)
- [Migration History](#migration-history)

---

## Why My CFO?

Most personal finance apps are cloud-first — your salary slips, investment statements, and loan details live on someone else's server. My CFO flips this: **everything runs on your machine**, behind your own authentication, with no telemetry.

| Feature | My CFO | CRED / Walnut / ET Money |
|---|:---:|:---:|
| Data stays on your server | ✅ | ❌ |
| Investment transaction ledger | ✅ | partial |
| LTCG / STCG tax computation | ✅ | ❌ |
| SGB maturity tax-free tracking | ✅ | ❌ |
| Wallet / UPI double-count reconciliation | ✅ | ❌ |
| Dual-pocket (personal + business) | ✅ | ❌ |
| Multi-user sharing with permissions | ✅ | ❌ |
| Open source & self-hostable | ✅ | ❌ |

---

## Quick Start

```bash
# 1. Clone
git clone git@github.com:ashokramcse/my-cfo.git
cd my-cfo

# 2. Create your environment file
cp .env.example .env
```

Edit `.env` — every required variable must be set (there are no insecure fallback defaults):

```dotenv
POSTGRES_DB=mycfo
POSTGRES_USER=mycfo
POSTGRES_PASSWORD=$(openssl rand -base64 20)

REDIS_PASSWORD=$(openssl rand -base64 16)

SECRET_KEY=$(openssl rand -hex 32)      # JWT signing key
ENCRYPTION_KEY=$(openssl rand -hex 16)  # AES encryption key (exactly 32 hex chars = 16 bytes)
```

```bash
# 3. Build and start (first time — builds all Docker images)
docker compose up --build -d

# 4. Apply database migrations
docker compose exec backend alembic upgrade head

# 5. Open the app
open http://localhost:4000
```

Create your account at `/signup`, then sign in. Your data never leaves `localhost`.

> **Note:** After changing backend Python code, you must rebuild the container — code is baked into the image, not volume-mounted:
> ```bash
> docker compose build backend && docker compose up -d backend
> ```

---

## Port Reference

| Service | Host Port | Container Port | Description |
|---------|:---------:|:--------------:|-------------|
| **nginx** | **4000** | 80 | ← **Open this. Single entry point.** |
| `frontend` | — | 3030 | Next.js 15 (proxied by nginx) |
| `backend` | — | 8090 | FastAPI (proxied by nginx) |
| `postgres` | 5555 | 5432 | PostgreSQL (for TablePlus / DBeaver) |
| `redis` | 6666 | 6379 | Redis (for RedisInsight) |
| `worker` | — | — | Celery background queue |

> You only need `http://localhost:4000`. Ports 5555 and 6666 are for connecting local DB/cache inspection tools directly.

---

## Module Reference

My CFO is organized into themed modules, accessible from the left sidebar.

### 🏠 Command Center

| View | Description |
|------|-------------|
| **Dashboard** | KPI summary: net worth, liquid assets, debt ratio, health score, EMI forecast chart, AI insights feed |

### 📊 Financial OS

| View | Description |
|------|-------------|
| **Net Worth** | Real-time net worth = assets − liabilities. Historical trend chart. Breakdown by category (banking, investments, assets, loans, cards). |
| **Banking** | All bank accounts with balances, account type, and interest rate. Balance history. Supports SAVINGS, CURRENT, SALARY, WALLET, UPI, FD, RD, CASH. |
| **Investments** | Full portfolio — stocks, mutual funds, ETFs, gold, SGB, PPF, EPF, NPS, bonds, crypto. Per-investment PnL, XIRR, CAGR. |
| **Loans & Debt** | Home, personal, vehicle, education, gold, business, BNPL, informal loans. Amortization schedule. Floating-rate reset tracking. |
| **Assets** | Real estate, vehicles, jewelry, electronics, artwork, receivables (Director's loans). Depreciation tracking. |

### 💰 Money Flow

| View | Description |
|------|-------------|
| **Income** | Salary, business income, rental, interest — all income sources with monthly analytics. |
| **Recurring** | Subscriptions, SIPs, insurance premiums — auto-detected from transaction patterns, deduplicated across structured + bank sources. |
| **Insurance** | Life, health, vehicle, property, term policies with premium tracking and expiry alerts. |
| **Goals** | Financial goals (emergency fund, house down-payment, retirement) with progress tracking. |

### 💳 Credit & Cards

| View | Description |
|------|-------------|
| **Cards** | Credit cards with utilization gauge, limit, outstanding, reward points. |
| **Transactions** | All card transactions with category tagging, merchant classification, debounced search with clear button, category and card filters. |
| **Card EMIs** | EMIs created from card transactions — tenure, interest rate, monthly installment, 6-month forecast. Month-aligned due dates. |
| **Lending** | Money lent to friends — risk scoring, repayment tracking, overdue flagging. |

### 🔭 Reports & Data

| View | Description |
|------|-------------|
| **Visualize** | 4-tab financial visualization suite (see below) |
| **Statements** | Upload and parse bank/card PDF statements (HDFC, ICICI, SBI, Axis + 8 more) |
| **Reports** | Spending trends, category breakdown, cash flow analysis |
| **Settings** | Profile, sessions, notifications, password change, and full Excel export of all financial data |

#### Visualize — 4 Tabs

| Tab | What it shows |
|-----|---------------|
| **Universe** | D3 force-directed graph: Net Worth → Category Hubs → Individual items (3-level radial layout) |
| **Cash Flow** | Sankey diagram: income sources → spending categories |
| **Allocation** | Sunburst chart: portfolio allocation by asset class → investment type |
| **Timeline** | Net worth history line chart with total assets / liabilities stacked area |

---

## Architecture

```
Browser → http://localhost:4000
              │
              ▼
     ┌──────────────────┐
     │  nginx :4000     │   Reverse proxy
     │  /api/* → :8090  │
     │  /*     → :3030  │
     └────────┬─────────┘
              │
       ┌──────┴───────┐
       ▼              ▼
  backend:8090    frontend:3030
  FastAPI +       Next.js 15 +
  Python 3.13     Node.js 22
       │
       ├──► postgres:5432  (host: 5555)
       ├──► redis:6379     (host: 6666)
       └──► worker (Celery)
```

### Startup order (health-checked)

```
postgres ──(healthy)──┐
                      ├──► backend ──(healthy)──► frontend ──(healthy)──► nginx ✅
redis    ──(healthy)──┘         └──► worker
```

Every service waits for its dependencies to pass health checks. `docker compose up --build` always brings everything up correctly.

### API layout

All backend routes live under `/api/v1/`:

```
/auth/*                               Login, register, refresh, logout, sessions, profile
/net-worth/*                          Current snapshot, history, intelligence report
/bank-accounts/*                      CRUD + balance history
/bank-accounts/reconcile              POST — run wallet/UPI reconciliation for current user
/investments/*                        CRUD + summary + intelligence
/investments/{id}/transactions        Investment ledger (BUY/SELL/BONUS/SPLIT…)
/investments/transactions/tax-summary LTCG/STCG annual tax report
/loans/*                              CRUD + summary + amortization schedule
/assets/*                             CRUD (includes RECEIVABLE type for Director's loans)
/cards/*                              CRUD + utilization
/transactions/*                       Card transactions + analytics
/emis/*                               Card EMI tracking + 6-month forecast
/income/*                             Income sources + intelligence
/recurring/*                          Recurring payment summary + upcoming (deduplicated)
/insurance/*                          Insurance policy intelligence
/goals/*                              Goal tracking + intelligence
/reports/*                            Dashboard + spending analytics
/statements/*                         Upload + parse PDF statements
/sharing/*                            Share permissions, invitations, relationships
/insights/*                           AI-generated financial alerts
```

---

## Investment Ledger & Tax Engine

Every trade is recorded in an auditable ledger and Indian tax rules are applied automatically.

### Transaction types

| Type | Description |
|------|-------------|
| `BUY` | Purchase (lump sum or SIP instalment) |
| `SELL` | Redemption or sale — triggers FIFO cost basis |
| `BONUS` | Bonus shares / bonus units (zero cost, parent lot avg preserved) |
| `SPLIT` | Stock split (units scale, cost pool unchanged, avg price recalculates) |
| `DIVIDEND` | Dividend credit |
| `COUPON` | SGB / bond coupon interest |
| `SWITCH_IN / SWITCH_OUT` | Mutual fund switch |
| `MATURITY` | Bond / SGB maturity redemption |

### Indian tax matrix

| Asset class | LTCG threshold | LTCG rate | STCG rate |
|---|---|---|---|
| Equity / Equity MF / ETF / REITs | 12 months | **12.5%** (₹1.25L exempt/yr) | **20%** |
| Debt MF (post Apr 2023) | — | Slab rate | Slab rate |
| Gold / Silver / SGB (pre-maturity) | 24 months | **12.5%** | Slab (30%) |
| SGB at 8-year maturity | — | **Tax-free** | — |
| PPF | — | **Fully exempt** | — |
| EPF (>5 years) | — | **Exempt** | — |
| Crypto / VDA | — | **30% flat** | **30% flat** |
| Bonds / NPS | 12 months | **12.5%** | Slab |

Tax summary endpoint: `GET /api/v1/investments/transactions/tax-summary?financial_year=2025-26`

---

## Wallet & UPI Reconciliation

When users import transactions from both their bank account **and** UPI/wallet apps (PhonePe, GPay, Paytm), the same money appears twice. The reconciliation engine fixes three double-counting classes:

| Problem | Symptom | Fix |
|---------|---------|-----|
| **UPI duplicate** | ₹500 UPI payment in bank + PhonePe export = ₹1,000 shown | Wallet side marked `is_excluded`, `is_duplicate` |
| **Wallet load** | Bank DEBIT ₹5k "Transfer to Paytm" + Wallet CREDIT ₹5k | Both legs `is_transfer_leg=True`, excluded from cashflow |
| **CC → Wallet** | CC charge ₹5k "Paytm" + Wallet CREDIT ₹5k | Wallet CREDIT marked `CC_WALLET_LOAD`, excluded |

**Reconciliation passes:** UTR exact match → fuzzy (amount ± ₹1, date ± 3 days) → wallet fee tagging → CC→wallet detection.

Runs automatically on every import and manual add. Manual trigger: `POST /api/v1/bank-accounts/reconcile`.

---

## Multi-Entity Finance

Supported entity types: `PERSONAL` · `SOLE_PROP` · `PRIVATE_LTD` · `LLP` · `HUF` · `PARTNERSHIP` · `TRUST`

Every user starts with a default `PERSONAL` entity. Bank accounts, investments, loans, and assets can each be tagged to the correct entity. Use `AssetType = RECEIVABLE` to track Director's loans to your own company as a net-worth positive asset.

---

## Supported Banks (PDF Parsing)

| Bank | PDF | Cred Screenshot |
|------|:---:|:---:|
| HDFC | ✅ | ✅ |
| ICICI | ✅ | ✅ |
| SBI | ✅ | ✅ |
| Axis | ✅ | ✅ |
| Amex | ✅ | — |
| IDFC First | ✅ | — |
| Kotak | ✅ | — |
| Standard Chartered | ✅ | — |
| OneCard | ✅ | — |
| AU Small Finance | ✅ | — |
| Federal Bank | ✅ | — |
| **Generic OCR fallback** | ✅ | — |

---

## Tech Stack

### Infrastructure

| Tool | Version | Role |
|------|:-------:|------|
| Docker Compose | v2 | Container orchestration |
| nginx | 1.27 | Reverse proxy + routing |
| PostgreSQL | 17 | Primary database |
| Redis | 7 | Cache + Celery broker |

### Backend

| Package | Version | Role |
|---------|:-------:|------|
| Python | 3.13 | Runtime |
| FastAPI | 0.115 | Async HTTP framework |
| SQLAlchemy | 2.0 | Async ORM |
| asyncpg | 0.30 | PostgreSQL async driver |
| psycopg2 | 2.9 | PostgreSQL sync driver (Alembic) |
| Alembic | 1.14 | Schema migrations |
| Celery | 5.4 | Background task queue |
| python-dateutil | 2.9 | `relativedelta` for month-aligned EMI dates |
| pdfplumber | 0.11 | PDF text extraction (primary) |
| PyMuPDF | 1.24 | PDF text extraction (secondary) |
| pytesseract | 0.3 | OCR fallback |
| pikepdf | 9.4 | Password-protected PDF decryption |
| Pillow | 11.0 | Image preprocessing |
| pydantic | 2.10 | Request/response validation |
| pydantic-settings | 2.6 | `.env` configuration |
| python-jose | 3.3 | JWT signing / verification |
| cryptography | 43 | AES-256-GCM field encryption |
| passlib + bcrypt | 1.7 / 4.0 | Password hashing |
| pandas / numpy | 2.2 / 2.1 | Statement parsing analytics |

### Frontend

| Package | Version | Role |
|---------|:-------:|------|
| Node.js | 22 | Runtime (LTS) |
| Next.js | 15.1 | React framework (App Router) |
| React | 19 | UI library |
| TypeScript | 5.7 | Static typing |
| Tailwind CSS | 3.4 | Utility-first styling |
| Framer Motion | 11 | Page / component animations |
| **ECharts** | 5.5 | Sankey, sunburst, timeline, bar charts |
| **D3.js** | 7.9 | Force-directed graph (Universe tab) |
| TanStack Query | 5 | Server state + prefetching |
| Zustand | 5 | Auth + UI client state |
| Axios | 1.7 | HTTP client with JWT interceptors |
| react-hook-form | 7 | Form handling |
| Zod | 3.24 | Schema validation |
| xlsx | 0.18 | Excel export (Settings → Export Excel) |
| Radix UI | various | Accessible headless components |
| Lucide React | 0.469 | Icons |

---

## Configuration

All configuration is via `.env`. Copy `.env.example` to start. **There are no insecure default fallbacks.**

```bash
cp .env.example .env
```

### Required variables

| Variable | How to generate | Description |
|----------|----------------|-------------|
| `POSTGRES_PASSWORD` | `openssl rand -base64 20` | Database password |
| `REDIS_PASSWORD` | `openssl rand -base64 16` | Redis auth password |
| `SECRET_KEY` | `openssl rand -hex 32` | JWT signing key |
| `ENCRYPTION_KEY` | `openssl rand -hex 16` | AES-256 field encryption key (32 hex chars) |

### Optional variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_DB` | `mycfo` | Database name |
| `POSTGRES_USER` | `mycfo` | Database user |
| `ENVIRONMENT` | `production` | `development` disables some security checks |
| `DEBUG` | `false` | Enable FastAPI debug mode |
| `UPLOAD_DIR` | `/app/uploads` | Statement PDF upload path inside container |
| `MAX_UPLOAD_SIZE_MB` | `50` | Max PDF upload size |
| `OLLAMA_BASE_URL` | — | Enable local LLM insights (e.g. `http://ollama:11434`) |
| `SMTP_HOST` | — | SMTP server for email notifications (optional) |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |

---

## Commands Reference

```bash
# ── Stack lifecycle ──────────────────────────────────────────────
docker compose up --build -d        # First-time: build images + start all services
docker compose up -d                # Start (no rebuild)
docker compose down                 # Stop containers (data preserved)
docker compose restart backend      # Restart a single service

# ── Rebuild after backend code changes ───────────────────────────
# Backend code is baked into the Docker image — must rebuild after any Python change
docker compose build backend && docker compose up -d backend

# ── Logs ────────────────────────────────────────────────────────
docker compose logs -f              # All services
docker compose logs -f backend      # Backend only
docker compose logs -f frontend     # Frontend only

# ── Status ──────────────────────────────────────────────────────
docker compose ps                   # Service status + health

# ── Database ────────────────────────────────────────────────────
docker compose exec backend alembic upgrade head              # Apply all migrations
docker compose exec backend alembic current                   # Show current version
docker compose exec backend alembic history                   # Show migration history
docker compose exec backend alembic revision --autogenerate -m "description"  # New migration

# Connect with a DB tool: host=localhost  port=5555  user=mycfo  db=mycfo

# ── Shells ──────────────────────────────────────────────────────
docker compose exec backend bash    # Backend (Python 3.13)
docker compose exec frontend sh     # Frontend (Node.js 22)
docker compose exec worker bash     # Celery worker

# ── Nuclear reset ⚠️  (destroys ALL data and rebuilds) ──────────
docker compose down -v
docker compose up --build -d
docker compose exec backend alembic upgrade head
```

---

## Security

- **No insecure fallback defaults** — stack refuses to start without proper `.env`
- **JWT access tokens** with refresh token rotation and per-device session management
- **bcrypt** password hashing (cost factor 12)
- **AES-256-GCM** encryption on sensitive fields
- **Row-level user isolation** — every query scoped to `user_id`
- **401 interceptor guard** — no redirect loop when already on `/login` or `/signup`
- **Share permissions** — granular module-level read/write access for shared users

---

## Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
# Set DATABASE_URL and REDIS_URL to localhost in .env
uvicorn app.main:app --reload --port 8090

# Celery worker (separate terminal)
celery -A app.workers.celery_app worker --loglevel=info

# Frontend (separate terminal)
cd frontend
npm install --legacy-peer-deps
NEXT_PUBLIC_API_URL=http://localhost:8090 npm run dev
```

### Migrations (dev)

```bash
docker compose exec backend alembic revision --autogenerate -m "add_field_xyz"
docker compose exec backend alembic upgrade head
docker compose exec backend alembic downgrade -1   # roll back one step
```

---

## Migration History

| Version | Description |
|---------|-------------|
| `0001` | Initial schema — cards, transactions, EMIs, friends, statements |
| `0002` | Fix active_emi_count type |
| `0003` | Financial OS — bank accounts, investments, loans, assets, net worth |
| `0004` | Bank transactions + balance snapshot |
| `0005` | Income, Insurance, Goals, AI Conversations |
| `0006` | Floating rate fields on loans, bank_account_id on statements |
| `0007` | Recurring payments |
| `0008` | Auth + sharing — UserSession, UserRelationship, SharePermission, ShareInvitation |
| `0009` | Investment ledger, entity isolation, bank transaction enrichment |
| `0010` | Card EMI fixes — month-aligned dates (relativedelta), amount_remaining from total |
| `0011` | Bank transaction enrichment — status, gross_amount, tds_amount, linked FKs |
| `0012` | Wallet/UPI reconciliation — linked_tx_id, is_transfer_leg, UTR index, new categories |

---

<div align="center">

**Self-hosted · Zero data leaks · Built for Indian power users**

<sub>Your financial data belongs to you — not to a startup's cloud.</sub>

</div>
