# Changelog

All notable changes to CC-Bill are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
