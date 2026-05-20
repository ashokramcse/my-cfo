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
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Port Reference](#port-reference)
- [Features](#features)
- [Architecture](#architecture)
- [Supported Banks](#supported-banks)
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
# 3. Start the full stack (builds all images + starts all 6 services)
docker compose down && docker compose up --build

# 4. Run database migrations (first time only)
docker compose exec backend alembic upgrade head

# 5. Open in browser
open http://localhost:4000
```

---

## Port Reference

| Service | Host Port | Container Port | Description |
|---------|:---------:|:--------------:|-------------|
| **nginx** | **4000** | 80 | ← **Single entry point. Open http://localhost:4000** |
| `frontend` | — | 3030 | Next.js 15 / Node.js 22 (internal, proxied by nginx) |
| `backend` | — | 8090 | FastAPI / Python 3.13 (internal, proxied by nginx) |
| `postgres` | 5555 | 5432 | PostgreSQL 17 (exposed for local DB tools) |
| `redis` | 6666 | 6379 | Redis 7 (exposed for local cache tools) |
| `worker` | — | — | Celery background queue (no port needed) |

> **Only `http://localhost:4000` is needed to use the app.** The other exposed ports (5555, 6666) are for connecting local tools like TablePlus or RedisInsight directly to the database/cache.

---

## Features

### 💳 Card Management
- Track unlimited credit cards across all major Indian banks
- Live utilization gauge, available credit, and reward points balance
- Per-card spending breakdown and monthly trend charts

### 📄 Statement Intelligence
- **PDF parsing** — pdfplumber → PyMuPDF → Tesseract OCR fallback chain
- **Cred screenshot parsing** — bill summaries and spending breakdowns
- Password-protected PDF support
- Auto-detect bank from file content — 18-category merchant classification

### 📅 EMI Tracker
- Track personal and friend EMIs with tenure, interest rate, and no-cost flag
- 12-month EMI liability forecast chart

### 👥 Friend EMI Intelligence
- Map EMIs purchased for friends — risk scoring, overdue flagging, collection tracking

### 📊 Analytics & Reports
- Monthly spending by category, 12-month EMI forecast, month-over-month analysis

### 🤖 AI Insights
- Rule-based financial alerts (utilization risk, EMI burden, due dates)
- Optional Ollama LLM integration for local natural-language commentary

### 📱 Mobile Responsive
- Fully responsive — phones, tablets, desktops
- Slide-out sidebar drawer on mobile with hamburger toggle
- Scrollable tables and adaptive grid layouts

### 🔐 Security
- AES-256-GCM encryption on all sensitive fields
- JWT access + refresh token auth
- Per-user row-level data isolation

---

## Architecture

```
Browser → http://localhost:4000
              │
              ▼
     ┌──────────────────┐
     │  nginx :4000     │   Reverse proxy (single entry point)
     │  /api/* → :8090  │
     │  /*     → :3030  │
     └────────┬─────────┘
              │
       ┌──────┴───────┐
       ▼              ▼
  backend:8090    frontend:3030
  (FastAPI +      (Next.js 15 +
  Python 3.13)     Node.js 22)
       │
       ├──► postgres:5432  (host: 5555)  PostgreSQL 17
       ├──► redis:6379     (host: 6666)  Redis 7
       └──► worker                       Celery queue
```

### Health-checked startup chain

```
postgres ──(healthy)──┐
                      ├──► backend ──(healthy)──► frontend ──(healthy)──► nginx ✅
redis    ──(healthy)──┘         └──► worker
```

Every service waits for its dependencies to pass health checks before starting. Running `docker compose up --build` always brings everything up in the correct order.

---

## Supported Banks

| Bank | PDF Parsing | Cred Screenshot |
|------|:-----------:|:---------------:|
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
| **Generic fallback** | ✅ | — |

---

## Tech Stack

### Infrastructure

| Tool | Version | Role |
|------|:-------:|------|
| Docker Compose | v2 | Container orchestration |
| nginx | **1.27** | Reverse proxy |
| PostgreSQL | **17** | Primary database |
| Redis | **7** | Cache + Celery broker |

### Backend

| Package | Version | Role |
|---------|:-------:|------|
| Python | **3.13** | Runtime |
| FastAPI | 0.115 | HTTP framework |
| SQLAlchemy | 2.0 | Async ORM |
| asyncpg | 0.30 | PostgreSQL async driver |
| Alembic | 1.14 | Schema migrations |
| Celery | 5.4 | Background task queue |
| pdfplumber | 0.11 | PDF text extraction (primary) |
| PyMuPDF | 1.24 | PDF text extraction (secondary) |
| pytesseract | 0.3 | OCR (final fallback) |
| pikepdf | 9.4 | Password-protected PDF decryption |
| Pillow | 11.0 | Image preprocessing |
| pydantic | 2.10 | Request/response validation |
| cryptography | 43 | AES-256-GCM field encryption |

### Frontend

| Package | Version | Role |
|---------|:-------:|------|
| Node.js | **22** | Runtime (LTS) |
| Next.js | 15.1 | React framework (App Router) |
| React | 19 | UI library |
| TypeScript | 5.7 | Static typing |
| Tailwind CSS | 3.4 | Utility-first styling |
| Framer Motion | 11 | Animations |
| Recharts | 2.14 | Charts |
| TanStack Query | 5 | Server state management |
| Zustand | 5 | Client state |
| react-hook-form | 7 | Form handling |

---

## Configuration

All configuration is via `.env`. Copy `.env.example` to get started.

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `SECRET_KEY` | ✅ | — | JWT signing key (`openssl rand -hex 64`) |
| `ENCRYPTION_KEY` | ✅ | — | AES-256 key (`openssl rand -hex 32`) |
| `POSTGRES_PASSWORD` | ✅ | — | Database password |
| `POSTGRES_DB` | — | `ccbill` | Database name |
| `REDIS_PASSWORD` | — | `CHANGE_ME_redis_password` | Redis auth password |
| `UPLOAD_DIR` | — | `/app/uploads` | File storage path inside container |
| `OLLAMA_BASE_URL` | — | — | Enable local LLM insights (optional) |

---

## Commands Reference

```bash
# ── Full stack ──────────────────────────────────────────────────
docker compose down && docker compose up --build   # Clean rebuild + start all 6 services
docker compose up -d                               # Start detached (no rebuild)
docker compose down                                # Stop and remove containers
docker compose logs -f                             # Tail all logs
docker compose logs -f backend                     # Backend logs only
docker compose ps                                  # Show all service status

# ── Database ────────────────────────────────────────────────────
docker compose exec backend alembic upgrade head               # Apply migrations
docker compose exec backend alembic revision --autogenerate -m "name"  # New migration
docker compose exec postgres psql -U ccbill                    # PostgreSQL shell
# Or connect with any DB tool: localhost:5555 / user: ccbill

# ── Redis ───────────────────────────────────────────────────────
# Connect with RedisInsight or redis-cli: localhost:6666

# ── Debug shells ────────────────────────────────────────────────
docker compose exec backend bash      # Backend shell (Python 3.13)
docker compose exec frontend sh       # Frontend shell (Node.js 22)
docker compose exec worker bash       # Celery worker shell

# ── Nuclear reset (⚠️  destroys ALL data) ───────────────────────
docker compose down -v && docker compose up --build
docker compose exec backend alembic upgrade head
```

---

## Local Development

Run without Docker for faster iteration:

```bash
# Backend (requires PostgreSQL on :5432 and Redis on :6379 locally)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8090

# Celery worker (separate terminal)
celery -A app.workers.celery_app worker --loglevel=info

# Frontend
cd frontend
npm install --legacy-peer-deps
npm run dev   # runs on http://localhost:3000 by default
```

Update `DATABASE_URL` and `REDIS_URL` in `.env` to use `localhost` instead of Docker service names.

---

<div align="center">

**Self-hosted · Zero data leaks · Built for power users**

<sub>Made with ♥ for those who want their financial data to stay private</sub>

</div>
