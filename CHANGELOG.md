# Changelog

All notable changes to My CFO are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.6.0] — 2026-05-24

### Security — full secret purge
- Removed `.env` from entire git history using `git filter-repo --invert-paths`
- Rewrote all commits to replace hardcoded passwords in `docker-compose.yml`, `backend/app/config.py`, and `README.md` using `git filter-repo --replace-text`
- `docker-compose.yml`: removed all `:-old_password` fallback defaults — env vars are now required; stack won't start without a proper `.env`
- `backend/app/config.py`: replaced hardcoded DB/Redis URL defaults with `CHANGE_ME_*` placeholders; `validate_settings()` rejects them on startup
- `.env.example`: replaced all example credential values with clearly non-sensitive `CHANGE_ME_*` placeholders and `openssl` generation instructions
- `alembic.ini`: replaced hardcoded fallback URL with placeholder
- Added `.env`, `.env.local`, `.env.production`, `*.pem`, `*.key` to `.gitignore`

### Security — login page & API call fixes
- `globals.css`: scoped white-background input rule to dashboard only using `input:not(.auth-input)` — prevented login form inputs being invisible (white-on-dark) 
- `login/page.tsx` + `signup/page.tsx`: added `auth-input` class to all form inputs so they keep dark glassmorphism styling
- `Providers.tsx` DataPrefetcher: validates token with `/auth/me` before firing 14 bulk prefetch queries — stale tokens now produce 1 clean 401 instead of a cascade of 14

### Backend — P0 Investment Transaction Ledger
- New model `InvestmentTransaction` with `InvTxType` enum: `BUY`, `SELL`, `BONUS`, `SPLIT`, `DIVIDEND`, `COUPON`, `MATURITY`, `SWITCH_IN`, `SWITCH_OUT`
- FIFO cost basis computed automatically on every SELL from the BUY ledger
- Investment aggregates (`units`, `avg_buy_price`, `invested_amount`, `unrealized_pnl`, `realized_pnl`) re-derived from ledger after every event
- **Bonus shares**: zero-cost units, parent lot avg price preserved
- **Stock splits**: unit scaling, total cost pool unchanged, avg price auto-adjusts

### Backend — P0/P1 LTCG/STCG Tax Engine
- `compute_tax()` function applies full Indian tax matrix per asset class
- Correct holding thresholds: equity 12 months, gold/debt/SGB 24 months
- Rates: equity LTCG 12.5% (₹1.25L/yr exempt), STCG 20%; gold 12.5%/slab; crypto 30% flat; SGB maturity tax-free; PPF/EPF exempt paths
- `GET /investments/transactions/tax-summary?financial_year=2025-26` — full LTCG/STCG breakdown with exemption applied
- New endpoints: `POST/GET /{id}/transactions`, `DELETE /transactions/{tx_id}`

### Backend — P0/P1 BankTransaction enrichment
- `status` column: `PENDING` / `SETTLED` / `RECONCILED` — models MF T+3 settlement gap
- `gross_amount`, `tds_amount`, `tds_section` — ITR-ready income reporting (194A, 194N…)
- `linked_investment_tx_id`, `linked_loan_id`, `linked_card_id` — wealth transfer integrity

### Backend — P1 Investment SGB/bond fields
- `maturity_date`, `coupon_rate`, `last_coupon_date`, `next_coupon_date`, `price_source`
- SGB 8-year maturity tracked; tax-free exit path triggered automatically at maturity

### Backend — P2 FinancialEntity + dual-pocket isolation
- New `financial_entities` table: `PERSONAL` / `SOLE_PROP` / `PRIVATE_LTD` / `LLP` / `HUF` / `PARTNERSHIP` / `TRUST`
- `entity_id` column added to investments, bank_accounts, loans, assets
- Migration seeds a default PERSONAL entity for every existing user
- New `AssetType.RECEIVABLE` — Director's loan to own company tracked as net-worth positive asset
- `counterparty_name`, `counterparty_entity_id`, `due_date`, `interest_rate` on assets

### Migration
- `0009_investment_ledger_entity_isolation` — idempotent (`IF NOT EXISTS` throughout)

---

## [1.5.0] — 2026-05-23

### Frontend — Financial Universe (Visualize module)
- New **Visualize** section with 4 tabs, all filling full viewport height
- **Universe tab**: D3.js v7 force-directed graph — 3-level radial layout
  - L0: Net Worth node (center, fixed)
  - L1: 5 category hubs (Banking, Credit Cards, Loans, Investments, Assets) — fixed inner ring
  - L2: Individual items — spring-force toward their hub, outer ring
  - Glow rings on hub nodes; thick/thin/dashed link styles per level; hover tooltips
- **Cash Flow tab**: ECharts Sankey diagram — income sources → spending categories → investments
- **Allocation tab**: ECharts sunburst chart — asset class → investment type breakdown
- **Timeline tab**: ECharts line + stacked area — net worth history with assets/liabilities
  - x-axis date formatter: ISO → "Jun '25" locale format
- All 4 tabs use `absolute inset-0` inside `relative flex-1` so ECharts resolves `height: 100%` correctly
- All graph data built client-side from individual cached API queries (no dedicated graph endpoint)
- Shared TanStack Query cache keys with Settings Excel export — visiting either page warms cache for both

### Frontend — Settings Excel export
- Export all financial data to `.xlsx` using `xlsx` library
- Uses same TanStack Query keys as VisualizationView — data shared from cache

### Bug fixes
- ECharts Sankey crash (`t.links is undefined`): backend returns `edges`, frontend expected `links` — fixed by building Sankey entirely client-side with string node names
- D3 TypeScript error in mouseout handler: used `d3.select<SVGGElement, D3Node>(e.currentTarget)` with explicit datum type
- `notMerge={true}` on all `ReactECharts` instances to prevent stale option merging on tab switch

---

## [1.4.0] — 2026-05-23

### Backend — Authentication & Sharing
- Real JWT authentication replacing hardcoded `"owner"` stub
- `POST /auth/login` with email or username identifier
- `POST /auth/register` with email, username, password, country, currency
- Refresh token rotation — each `/auth/refresh` issues a new pair and invalidates the old
- `UserSession` model — per-device sessions with last-seen tracking
- `GET /auth/sessions` + `DELETE /auth/sessions/{id}` — view and revoke sessions
- `UserRelationship` model — typed relationships (spouse, parent, accountant…)
- `SharePermission` model — granular module-level read/write grants
- `ShareInvitation` model — invite-code flow with expiry
- `require_write()` dependency — sharing users blocked from POST/PATCH/DELETE on shared data

### Frontend — Auth
- Login page (`/login`) — dark glassmorphism UI, email or username, password show/hide
- Signup page (`/signup`) — 2-step wizard (credentials → preferences), password strength indicator
- `AuthGate` component — wraps `/dashboard`, validates token, redirects to `/login` if expired
- `useAuthStore` (Zustand + persist) — tokens synced to localStorage; `onRehydrateStorage` hook
- Sidebar: real user name + email from `/auth/me`; logout button with session revoke

### Frontend — Sharing view
- Invite management: send, accept, reject, revoke
- Permissions given / received cards
- Relationship type labels

---

## [1.3.0] — 2026-05-21

### Backend — Financial OS modules
- **Banking**: `BankAccount` model (current, savings, salary, FD, wallet, NRE, NRO), balance history
- **Investments**: `Investment` model with 13 types (STOCKS, MUTUAL_FUND, ETF, CRYPTO, GOLD, SILVER, SGB, PPF, EPF, NPS, BONDS, REITS, OTHER), SIP tracking, PnL, XIRR, CAGR
- **Loans**: `Loan` model (HOME, PERSONAL, VEHICLE, EDUCATION, GOLD, BUSINESS, BNPL, INFORMAL, OTHER), floating-rate reset, amortization schedule endpoint
- **Assets**: `Asset` model (REAL_ESTATE, VEHICLE, JEWELRY, ELECTRONICS, FURNITURE, ARTWORK, OTHER), depreciation (straight-line / declining balance)
- **Net Worth**: `NetWorthSnapshot` model, `_build_intelligence()` aggregation, health score, historical trend reconstruction from bank transactions
- **Income**: `IncomeSource` + `IncomeEntry` models, income intelligence endpoint
- **Insurance**: `Insurance` model with 6 policy types, premium tracking, expiry alerts
- **Goals**: `Goal` model with target/current tracking, priority, intelligence endpoint
- **Recurring**: recurring payment summary from transaction patterns
- **Bank Transactions**: `BankTransaction` model with 20 categories, transfer linking, duplicate flagging

### Frontend — Navigation restructure
- Sidebar reorganized into 5 groups: Command Center, Financial OS, Money Flow, Credit & Cards, Reports & Data
- Added views: Net Worth, Banking, Investments, Loans, Assets, Income, Recurring, Insurance, Goals, Sharing
- Hover prefetch on all sidebar nav items via TanStack Query `prefetchQuery`
- Mobile bottom navigation bar with 5 tabs (Home, Banking, Cards, Invest, more)
- Onboarding wizard for new users (completeness < 30%) — 3-step setup

### Frontend — Dashboard
- DTI (debt-to-income) widget with RED/AMBER/GREEN bar
- EMI burden gauge
- Net worth change chip (amount + %)

---

## [1.2.0] — 2026-05-20

### Infrastructure
- **Upgraded Node.js** from 20 → **22 LTS** (frontend + builder containers)
- **Upgraded Python** from 3.12 → **3.13** (backend + worker containers)
- **Upgraded PostgreSQL** from 16 → **17** (postgres:17-alpine)
- **Upgraded nginx** from 1.25 → **1.27** (nginx:1.27-alpine)
- **Reconfigured service ports** for cleaner local dev separation:
  - nginx (entry point): **4000**
  - frontend (internal): **3030**
  - backend (internal): **8090**
  - postgres (host-exposed): **5555**
  - redis (host-exposed): **6666**
- **Fixed `docker compose down && docker compose up --build`** so all 6 services always start in correct order
- Added `healthcheck` to `frontend` service using `node` HTTP check (wget not available in node:alpine)
- nginx now depends on `frontend: service_healthy` + `backend: service_healthy` — starts only when both are truly ready
- Tightened healthcheck intervals: postgres/redis every 5s, backend/frontend every 10s
- Added `start_period` to backend (20s) and frontend (60s) to allow boot time before health checks count
- Removed `NEXT_PUBLIC_API_URL` from docker-compose.yml build args — was overriding empty Dockerfile ARG default causing all API calls to fail in production
- Removed `NEXT_PUBLIC_API_URL` fallback `http://localhost:8000` from `frontend/Dockerfile` ARG — now defaults to empty string so nginx proxying works correctly

### Frontend — UI/UX Overhaul
- Complete design system rewrite (`globals.css`) with warm-tan palette
  - Page background: `#E6E0D8`, cards: `#FFFFFF` with visible shadows
  - All border colors darkened to `#C8C2BB` for clear visibility on white
  - Inputs, cards, tables, dividers use consistent stronger borders
- Replaced purple/violet icon boxes across EMI and statements pages with warm orange gradient
- Fixed statements dropzone: was using invisible `border-border` Tailwind class — replaced with explicit `2px dashed #CCC7C0` + orange icon
- Strengthened card and kpi-card box-shadows for better depth perception
- Added `.table-responsive` CSS class with `overflow-x-auto` and `min-width: 480px` for mobile table scroll

### Frontend — Mobile Responsiveness
- Added `useIsMobile()` hook (`src/hooks/useIsMobile.ts`) for runtime breakpoint detection at 1024px
- **Sidebar**: slide-out drawer overlay on mobile with dark backdrop and X close button; desktop collapse/expand unchanged
- **AppShell**: `marginLeft = 0` on mobile (sidebar overlays), framer-motion animation only on desktop
- **PageHeader**: hamburger `Menu` icon on mobile left that opens the sidebar drawer
- All pages: responsive padding `p-3 sm:p-5 xl:p-6`
- Dashboard/Reports charts: `lg:grid-cols-3` instead of `xl:` for earlier side-by-side breakpoint
- Transactions filter bar: `flex-col sm:flex-row` for mobile stacking
- EMI status filter tabs: `overflow-x-auto` for small screen scrolling
- Table wrappers added to statements and reports pages
- Added `mobileSidebarOpen` / `openMobileSidebar` / `closeMobileSidebar` to Zustand `useUIStore`

---

## [1.1.0] — 2026-05-19

### Frontend — Design System
- Full UI/UX redesign with warm-tan color palette replacing previous dark/neon theme
- New `StatCard` component with variant system (default, success, warning, danger, violet, info, orange)
- New `PageHeader` component as sticky top bar with orange gradient icon
- Redesigned `Sidebar` with dark background (`#16100C`) and orange-accented active states
- `AppShell` width animation using Framer Motion (64px collapsed, 232px expanded)
- `SpendingChart` and `EMIForecastChart` with warm color fills
- Warm shimmer skeleton loading states
- All pages restructured: sticky PageHeader outside padded content div

### Infrastructure
- `api.ts`: changed `|| 'http://localhost:8000'` to `?? ''` so empty env var uses relative URLs
- Fixed nginx proxy correctly routing `/api/*` to backend and `/*` to frontend

---

## [1.0.0] — 2026-05-15

### Initial Release

#### Backend (FastAPI + Python 3.12)
- Full REST API: cards, transactions, EMIs, friends, statements, reports, insights
- SQLAlchemy 2.0 async ORM with PostgreSQL 16
- Celery workers for background PDF parsing and insight generation
- PDF parsing pipeline: pdfplumber → PyMuPDF → Tesseract OCR
- Cred screenshot parser (PIL + Tesseract)
- 18-category merchant classifier with 60+ regex rules
- AES-256-GCM field encryption
- JWT authentication (access + refresh tokens)
- Alembic database migrations

#### Frontend (Next.js 15 + Node.js 20)
- App Router pages: Dashboard, Cards, Transactions, EMI Tracker, Friend EMIs, Statements, Reports, Settings
- TanStack Query v5 for server state management
- Recharts for area/pie/bar charts
- react-dropzone for PDF/image upload
- Framer Motion animations

#### Infrastructure
- Docker Compose with 6 services: postgres, redis, backend, worker, frontend, nginx
- nginx reverse proxy on port 80 (later changed to 4000)
- Health checks on postgres, redis, backend
- Celery task queue for async parsing
