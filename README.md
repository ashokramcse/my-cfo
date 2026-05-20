# CC-Bill — Personal Credit Card & EMI Financial Intelligence Platform

A self-hosted, enterprise-grade financial operating system for managing credit cards, EMIs, shared expenses, and financial analytics.

## ✨ Features

| Module | Description |
|--------|-------------|
| **Multi-Card Dashboard** | Track all credit cards with utilization, due dates, rewards |
| **PDF Statement Parser** | Auto-parse HDFC/ICICI/SBI/Axis/Amex + 6 more banks, OCR fallback |
| **EMI Tracker** | Personal & friend EMIs, no-cost detection, pre-closure simulation |
| **Friend EMI Intelligence** | Who owes what, WhatsApp reminders, risk scoring, collection calendar |
| **AI Insights** | Rule-based + optional Ollama LLM for smart financial alerts |
| **Spending Analytics** | Category breakdown, monthly trends, subscription detection |
| **Cash Flow Forecast** | 12-month EMI liability forecast, utilization projections |
| **Security** | AES-256-GCM encryption, JWT auth, audit logs, no password storage |

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone git@github.com:ashokramcse/cc-bill.git
cd cc-bill

# 2. Configure
cp .env.example .env
# Edit .env — change SECRET_KEY and ENCRYPTION_KEY

# 3. Launch
docker compose up -d

# 4. Open
open http://localhost:80
```

That's it. Register at `/login` and start adding cards.

---

## 🏗 Architecture

```
cc-bill/
├── backend/                    # FastAPI (Python 3.12)
│   ├── app/
│   │   ├── api/               # REST endpoints
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── parsers/           # Bank-specific PDF parsers
│   │   ├── services/          # PDF parser, categorizer, AI insights
│   │   └── workers/           # Celery background tasks
│   └── alembic/               # Database migrations
│
├── frontend/                   # Next.js 15 + TypeScript
│   └── src/
│       ├── app/               # Next.js App Router pages
│       ├── components/        # Reusable UI components
│       ├── store/             # Zustand state management
│       └── lib/               # API client, utilities
│
├── nginx/                      # Reverse proxy config
├── scripts/                    # DB init SQL
└── docker-compose.yml          # Full stack orchestration
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| `nginx` | 80 | Reverse proxy |
| `frontend` | 3000 | Next.js app |
| `backend` | 8000 | FastAPI API |
| `worker` | — | Celery task queue |
| `postgres` | 5432 | Primary database |
| `redis` | 6379 | Cache + task broker |

---

## 🗄 Database Schema

**Core tables:** `users`, `credit_cards`, `statements`, `transactions`, `emis`, `emi_payments`, `friends`

**Support tables:** `categories`, `merchant_rules`, `insights`, `audit_logs`

**Key relationships:**
- Transactions belong to cards and statements
- EMIs link to cards and optionally friends
- EMI payments track each installment
- Insights are generated per user by workers

---

## 📊 Tech Stack

**Backend:** FastAPI · SQLAlchemy (async) · PostgreSQL · Redis · Celery · pdfplumber · PyMuPDF · Tesseract OCR · pikepdf

**Frontend:** Next.js 15 · TypeScript · Tailwind CSS · Framer Motion · Recharts · Zustand · TanStack Query

---

## 🔐 Security

- AES-256-GCM encryption for sensitive fields
- JWT access + refresh token auth
- PDF passwords used only during decryption, never stored
- Per-user data isolation at DB level
- Rate limiting on API endpoints
- Full audit trail for all write operations

---

## 🏦 Supported Banks

HDFC · ICICI · SBI · Axis · Amex · IDFC · OneCard · AU · Kotak · Federal · Standard Chartered · Generic fallback

---

## 📋 Available Commands

```bash
make up           # Start all services
make down         # Stop all services
make logs         # Follow logs
make migrate      # Run DB migrations
make backup       # Backup PostgreSQL
make shell-backend  # Shell into backend
make shell-db       # PostgreSQL shell
```

---

## 🤖 AI Features (Optional)

Enable Ollama for LLM-powered insights:
1. Add Ollama service to `docker-compose.yml`
2. Set `OLLAMA_BASE_URL=http://ollama:11434` in `.env`
3. Pull a model: `docker exec ollama ollama pull llama3.2`

---

## 📱 Friend EMI Workflow

1. Add a contact under **Friend EMIs** → enter name, phone, WhatsApp
2. Create an EMI → set Owner Type = "FRIEND" and select the contact
3. Track collection progress, overdue amounts, and risk levels
4. Send WhatsApp reminders with one click

---

*Self-hosted · Zero data leaks · Built for power users*
