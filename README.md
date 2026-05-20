<div align="center">

<h1>
  <img src="https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f4b3.svg" width="40" height="40" alt="card" />
  &nbsp;CC-Bill
</h1>

<p><strong>Personal Credit Card &amp; EMI Financial Intelligence Platform</strong></p>

<p>
  A self-hosted, full-stack financial operating system for managing credit cards,<br/>
  EMIs, shared expenses, and multi-bank statement analytics — all on your own infrastructure.
</p>

<br/>

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Features](#features)
- [Architecture](#architecture)
- [Supported Banks](#supported-banks)
- [Database Schema](#database-schema)
- [Security](#security)
- [AI Features](#ai-features)
- [Friend EMI Workflow](#friend-emi-workflow)
- [Tech Stack](#tech-stack)
- [Configuration](#configuration)
- [Commands Reference](#commands-reference)
- [Local Development](#local-development)

---

## Overview

CC-Bill is a **self-hosted** alternative to apps like CRED, Walnut, and MoneyView — built for users who want complete data ownership. Upload PDF statements or Cred screenshots, track every rupee across multiple cards, manage EMIs including those purchased for friends, and get intelligent financial alerts — all running on your own server.

> **Why self-hosted?** Your financial data stays on your machine. No telemetry, no third-party access, no cloud lock-in.

---

## Quick Start

```bash
# 1. Clone the repository
git clone git@github.com:ashokramcse/cc-bill.git
cd cc-bill

# 2. Create your environment file
cp .env.example .env
```

Open `.env` and set at minimum:

```dotenv
SECRET_KEY=<random-64-char-hex>      # openssl rand -hex 64
ENCRYPTION_KEY=<random-32-char-hex>  # openssl rand -hex 32
POSTGRES_PASSWORD=<strong-password>
```

```bash
# 3. Start the full stack
docker compose up -d

# 4. Run database migrations
docker compose exec backend alembic upgrade head

# 5. Open in browser
open http://localhost
```

Register at `/login`, add your first card, and start uploading statements.

---

## Features

### 💳 Card Management
- Track unlimited credit cards across all major Indian banks
- Live utilization gauge, available credit, and reward points balance
- Per-card spending breakdown and monthly trend charts
- Custom card colours and nicknames

### 📄 Statement Intelligence
- **PDF parsing** — pdfplumber → PyMuPDF → Tesseract OCR fallback chain
- **Cred screenshot parsing** — bill summaries (total due, min due, due date) and spending summaries (category totals + transaction list)
- Password-protected PDF support via pikepdf decryption
- Auto-detect bank from file content — no manual selection needed
- 18-category merchant classification with 60+ compiled regex rules
- Transaction deduplication across re-uploads

### 📅 EMI Tracker
- Track personal and friend EMIs with tenure, interest rate, and no-cost flag
- Monthly EMI liability calendar and pre-closure simulation
- Outstanding balance and total interest paid at a glance

### 👥 Friend EMI Intelligence
- Map EMIs purchased for friends — who owns what, how much is pending
- Risk scoring (LOW / MEDIUM / HIGH) based on outstanding amounts
- One-click WhatsApp reminder generation
- Collection calendar with overdue flagging

### 📊 Analytics & Reports
- Monthly spending by category (area chart + pie chart)
- 12-month EMI liability forecast
- Subscription detection and recurring charge alerts
- Comparative month-over-month analysis

### 🤖 AI Insights
- Rule-based engine: utilization risk, EMI burden, food overspend, upcoming dues
- Optional Ollama LLM integration for natural-language financial commentary

### 🔐 Security First
- AES-256-GCM encryption on all sensitive fields
- JWT access + refresh token auth with secure rotation
- PDF passwords used only at decryption time — never persisted
- Per-user row-level data isolation
- Full audit trail on all write operations

---

## Architecture

```
cc-bill/
│
├── backend/                         FastAPI application (Python 3.12)
│   ├── app/
│   │   ├── api/                     REST endpoints
│   │   │   ├── auth.py              Register, login, token refresh
│   │   │   ├── cards.py             Card CRUD + stats
│   │   │   ├── transactions.py      Transaction list + filters
│   │   │   ├── emis.py              EMI CRUD + payment tracking
│   │   │   ├── friends.py           Friend contacts + risk scores
│   │   │   ├── statements.py        File upload (PDF + images)
│   │   │   ├── reports.py           Dashboard + spending reports
│   │   │   └── insights.py          Financial alerts
│   │   ├── models/                  SQLAlchemy ORM models
│   │   ├── schemas/                 Pydantic v2 request/response schemas
│   │   ├── parsers/                 Bank-specific statement parsers
│   │   │   ├── hdfc.py
│   │   │   ├── icici.py
│   │   │   ├── sbi.py
│   │   │   ├── axis.py
│   │   │   ├── cred.py              Cred screenshot parser
│   │   │   └── generic.py           Fallback for unknown banks
│   │   ├── services/
│   │   │   ├── pdf_parser.py        Text extraction pipeline
│   │   │   ├── image_parser.py      PIL preprocessing + OCR pipeline
│   │   │   ├── categorizer.py       18-category merchant classifier
│   │   │   └── insights.py          Financial insight generation
│   │   └── workers/
│   │       ├── celery_app.py
│   │       └── tasks.py             Background parsing + insight tasks
│   └── alembic/                     Database migrations
│
├── frontend/                        Next.js 15 + TypeScript
│   └── src/
│       ├── app/                     App Router pages
│       │   ├── dashboard/           Overview + stats
│       │   ├── cards/               Card management
│       │   ├── transactions/        Transaction list + filters
│       │   ├── emis/                EMI tracker
│       │   ├── friends/             Friend EMI management
│       │   ├── statements/          File upload + parse history
│       │   ├── reports/             Charts + analytics
│       │   └── settings/            Account + preferences
│       ├── components/              Shared UI components
│       ├── store/                   Zustand state management
│       └── lib/                     API client, utilities, types
│
├── nginx/                           Reverse proxy config
├── scripts/                         Database init SQL
├── docker-compose.yml               Full-stack orchestration
└── .env.example                     Environment template
```

### Service Topology

```
Browser
  │
  ▼
┌──────────────────────────────────────┐
│  nginx :80                           │  Reverse proxy
│  /api/* → backend:8000               │
│  /*     → frontend:3000              │
└───────────┬──────────────────────────┘
            │
      ┌─────┴──────┐
      ▼            ▼
  backend:8000  frontend:3000
  (FastAPI)     (Next.js)
      │
      ├──► postgres:5432   Primary database
      ├──► redis:6379       Cache + task broker
      └──► worker           Celery (PDF/image parsing, insights)
```

| Service | Port | Description |
|---------|:----:|-------------|
| `nginx` | **80** | Reverse proxy — single entry point |
| `frontend` | 3000 | Next.js SSR application |
| `backend` | 8000 | FastAPI REST API |
| `worker` | — | Celery task queue |
| `postgres` | 5432 | PostgreSQL 16 — primary data store |
| `redis` | 6379 | Cache + Celery broker |

---

## Supported Banks

| Bank | PDF Parsing | Cred Screenshot | Notes |
|------|:-----------:|:---------------:|-------|
| HDFC | ✅ | ✅ | Reward points, statement date |
| ICICI | ✅ | ✅ | |
| SBI | ✅ | ✅ | |
| Axis | ✅ | ✅ | |
| Amex | ✅ | — | |
| IDFC First | ✅ | — | |
| Kotak | ✅ | — | |
| Standard Chartered | ✅ | — | |
| OneCard | ✅ | — | |
| AU Small Finance | ✅ | — | |
| Federal Bank | ✅ | — | |
| **Generic fallback** | ✅ | — | Auto-applied for any other bank |

**Cred screenshot types supported:**
- **Bill summary** — total outstanding, min due, due date, credit limit, available limit
- **Spending summary** — category totals + individual transaction list with merchant, amount, and date

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Account credentials and profile |
| `credit_cards` | Card metadata, limits, statement and due dates |
| `statements` | Uploaded files, parse status, extracted financials |
| `transactions` | Individual line items with category and merchant |
| `emis` | Active and closed EMI records |
| `emi_payments` | Per-installment payment tracking |
| `friends` | Contacts for shared EMI tracking |

### Supporting Tables

| Table | Purpose |
|-------|---------|
| `insights` | Generated financial alerts per user |
| `categories` | Merchant category master |
| `merchant_rules` | User-defined categorization overrides |
| `audit_logs` | Immutable write operation history |

**Entity relationships:**

```
users ──< credit_cards ──< statements ──< transactions
                      └──< emis ──< emi_payments
users ──< friends ──< emis
users ──< insights
```

---

## Security

| Concern | Implementation |
|---------|----------------|
| Field encryption | AES-256-GCM per-field via Python `cryptography` library |
| Authentication | JWT access tokens (15 min) + refresh tokens (7 days) |
| Password storage | bcrypt cost-12 — plaintext never stored |
| PDF passwords | Held in memory during decryption only, never written to DB |
| Data isolation | Every query is scoped to `user_id` at the ORM layer |
| Audit trail | Create / update / delete operations logged with timestamp and IP |
| Rate limiting | Nginx-level rate limiting on `/api/auth` endpoints |

---

## AI Features

### Rule-Based Insights (always on)

| Trigger | Insight Type | Severity |
|---------|-------------|----------|
| Card utilization > 80% | `UTILIZATION_RISK` | Critical / Warning |
| EMI burden > 40% of avg monthly spend | `EMI_RISK` | Warning |
| Food spend up > 30% month-over-month | `OVERSPEND` | Warning |
| Due date within 5 days | `DUE_DATE` | Info |

### Ollama LLM Integration (optional)

Enable free, local LLM commentary on your spending patterns:

```bash
# 1. Uncomment the ollama service in docker-compose.yml

# 2. Add to .env
OLLAMA_BASE_URL=http://ollama:11434

# 3. Pull a model
docker compose exec ollama ollama pull llama3.2
```

Ollama runs entirely on your machine — no data leaves your server.

---

## Friend EMI Workflow

```
1. Add Friend Contact
   └── Name, phone number, WhatsApp number

2. Create EMI
   └── Set Owner Type = "FRIEND" → select the contact

3. Track collection
   ├── Total pending amount
   ├── Overdue installments
   └── Risk level (see below)

4. Send reminder
   └── One-click WhatsApp message pre-filled with outstanding details
```

**Risk levels:**

| Pending Amount | Risk Level |
|---------------|:----------:|
| > ₹50,000 | 🔴 HIGH |
| ₹10,000 – ₹50,000 | 🟡 MEDIUM |
| < ₹10,000 | 🟢 LOW |

---

## Tech Stack

### Backend

| Package | Version | Role |
|---------|:-------:|------|
| FastAPI | 0.115 | HTTP framework |
| SQLAlchemy | 2.0 | Async ORM |
| asyncpg | 0.30 | PostgreSQL async driver |
| Alembic | 1.14 | Schema migrations |
| Celery | 5.4 | Background task queue |
| pdfplumber | 0.11 | PDF text extraction (primary) |
| PyMuPDF | 1.24 | PDF text extraction (secondary) |
| pytesseract | 0.3 | OCR fallback + image parsing |
| pikepdf | 9.4 | Password-protected PDF decryption |
| Pillow | 11.0 | Image preprocessing for OCR |
| python-jose | 3.3 | JWT signing and verification |
| cryptography | 43 | AES-256-GCM field encryption |
| passlib + bcrypt | 1.7 / 4.0 | Password hashing |
| pydantic | 2.10 | Request/response validation |

### Frontend

| Package | Version | Role |
|---------|:-------:|------|
| Next.js | 15.1 | React framework (App Router) |
| TypeScript | 5.7 | Static typing |
| Tailwind CSS | 3.4 | Utility-first styling |
| Framer Motion | 11 | Page and component animations |
| Recharts | 2.14 | Area, pie, and bar charts |
| TanStack Query | 5 | Server state + cache management |
| Zustand | 5 | Client-side state |
| react-hook-form | 7 | Form state and validation |
| Zod | 3 | Schema-based form validation |
| react-dropzone | 14 | Drag-and-drop file upload |
| Radix UI | — | Accessible UI primitives |
| Lucide React | — | Icon set |

---

## Configuration

All configuration is via `.env`. Copy `.env.example` to get started.

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `SECRET_KEY` | ✅ | — | JWT signing key (`openssl rand -hex 64`) |
| `ENCRYPTION_KEY` | ✅ | — | AES-256 key (`openssl rand -hex 32`) |
| `POSTGRES_PASSWORD` | ✅ | — | Database password |
| `POSTGRES_DB` | — | `ccbill` | Database name |
| `REDIS_URL` | — | `redis://redis:6379/0` | Redis connection URL |
| `UPLOAD_DIR` | — | `/uploads` | File storage path |
| `MAX_UPLOAD_SIZE_MB` | — | `20` | Maximum upload size |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | — | `15` | JWT access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | — | `7` | JWT refresh token TTL |
| `OLLAMA_BASE_URL` | — | — | Enable LLM insights (optional) |

---

## Commands Reference

```bash
# Stack management
make up                # Start all services in detached mode
make down              # Stop all services
make restart           # Restart all services
make logs              # Tail logs from all services
make logs-backend      # Tail backend logs only

# Database
make migrate           # Apply pending Alembic migrations
make migrate-create    # Create a new migration (prompts for name)
make backup            # Dump PostgreSQL to ./backups/

# Development shells
make shell-backend     # Bash into the backend container
make shell-db          # psql session inside PostgreSQL
make shell-worker      # Bash into the Celery worker container

# Maintenance
make clean             # Remove stopped containers and dangling images
make reset-db          # ⚠️  Drop and recreate the database (destructive)
```

---

## Local Development

Run without Docker for faster iteration:

```bash
# Backend
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env          # edit to point at localhost services
uvicorn app.main:app --reload --port 8000

# Celery worker (separate terminal)
celery -A app.workers.celery_app worker --loglevel=info

# Frontend
cd frontend
npm install --legacy-peer-deps
npm run dev
```

You will need PostgreSQL and Redis running locally. Update `DATABASE_URL` and `REDIS_URL` in `.env` to use `localhost` instead of the Docker service names.

---

<div align="center">

**Self-hosted · Zero data leaks · Built for power users**

<sub>Made with ♥ for those who want their financial data to stay private</sub>

</div>
