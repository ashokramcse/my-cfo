"""
AI CFO Engine
─────────────
Local-first AI CFO powered by Ollama (llama3/qwen2.5/mistral).
Falls back to rule-based responses if Ollama is unavailable.

Architecture:
  1. Build financial context snapshot from all DB modules
  2. Construct system prompt + conversation history
  3. POST to Ollama /api/chat
  4. On failure → rule-based pattern matching
  5. Store exchange in ai_conversations
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import Optional
from datetime import datetime
import uuid
import httpx
import os
import re

from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.ai_conversation import AIConversation
from app.models.bank_account import BankAccount
from app.models.investment import Investment
from app.models.loan import Loan
from app.models.asset import Asset
from app.models.income import IncomeSource
from app.models.insurance import Insurance
from app.models.goal import Goal
from app.models.emi import EMI
from pydantic import BaseModel

router = APIRouter()

OLLAMA_HOST  = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
SYSTEM_PROMPT_TEMPLATE = """You are FinOS AI — a personal CFO and financial advisor for an Indian user.
You have access to the user's complete financial snapshot below.
Answer questions concisely, accurately, and in plain language.
Always use Indian number formatting (₹ for currency, lakhs/crores).
Be specific and data-driven. If data is missing, say so and suggest what to add.

FINANCIAL SNAPSHOT (as of today):
{context}

Guidelines:
- Net worth = total assets − total liabilities
- Good EMI burden = < 35% of income; warning = 35–50%; critical = > 50%
- Emergency fund target = 6 months of expenses
- Diversification: spread across equity, debt, gold, and cash
"""


# ─── Pydantic schemas ─────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    model: Optional[str] = None  # Override model


# ─── Context builder ──────────────────────────────────────────────────────────

async def _build_context(db: AsyncSession, user: User) -> dict:
    """Pull a compact financial snapshot from all modules."""
    uid = user.id

    # Bank accounts
    ba_res = await db.execute(select(BankAccount).where(BankAccount.user_id == uid, BankAccount.is_active == True))
    accounts = ba_res.scalars().all()
    total_bank = sum(float(a.current_balance or 0) for a in accounts)

    # Investments
    inv_res = await db.execute(select(Investment).where(Investment.user_id == uid))
    investments = inv_res.scalars().all()
    total_invested = sum(float(i.invested_amount or 0) for i in investments)
    total_inv_val  = sum(float(i.current_value or 0) for i in investments)
    inv_pnl        = total_inv_val - total_invested
    sip_monthly    = sum(float(i.sip_amount or 0) for i in investments if i.is_sip and str(i.sip_status) == "ACTIVE")

    # Loans
    loan_res = await db.execute(select(Loan).where(Loan.user_id == uid, Loan.status == "ACTIVE"))
    loans    = loan_res.scalars().all()
    total_loan     = sum(float(l.outstanding_balance or 0) for l in loans)
    monthly_emi    = sum(float(l.emi_amount or 0) for l in loans)

    # Assets
    asset_res = await db.execute(select(Asset).where(Asset.user_id == uid))
    assets    = asset_res.scalars().all()
    total_asset_val = sum(float(a.current_value or 0) for a in assets)

    # Income sources
    inc_res = await db.execute(select(IncomeSource).where(IncomeSource.user_id == uid, IncomeSource.is_active == True))
    income_sources = inc_res.scalars().all()
    monthly_income = sum(float(s.monthly_amount or 0) for s in income_sources)
    monthly_net    = sum(
        float(s.monthly_amount or 0) * (1 - float(s.tax_deducted_pct or 0) / 100)
        for s in income_sources
    )

    # Insurance
    ins_res = await db.execute(select(Insurance).where(Insurance.user_id == uid, Insurance.is_active == True))
    insurances = ins_res.scalars().all()
    has_health = any(str(i.insurance_type) == "HEALTH" for i in insurances)
    has_term   = any(str(i.insurance_type) in ("TERM", "LIFE") for i in insurances)

    # EMIs
    emi_res = await db.execute(select(EMI).where(EMI.user_id == uid, EMI.status == "ACTIVE"))
    emis     = emi_res.scalars().all()
    cc_emi_monthly = sum(float(e.monthly_emi or 0) for e in emis)

    # Goals
    goal_res = await db.execute(select(Goal).where(Goal.user_id == uid, Goal.status == "ACTIVE"))
    goals    = goal_res.scalars().all()

    # Derived metrics
    total_liabilities = total_loan
    total_assets_all  = total_bank + total_inv_val + total_asset_val
    net_worth         = total_assets_all - total_liabilities
    total_emi_burden  = monthly_emi + cc_emi_monthly + sip_monthly
    emi_burden_pct    = round(total_emi_burden / monthly_net * 100, 1) if monthly_net > 0 else 0

    return {
        "net_worth":       round(net_worth, 2),
        "total_assets":    round(total_assets_all, 2),
        "total_liabilities": round(total_liabilities, 2),
        "banking": {
            "total_balance": round(total_bank, 2),
            "accounts": len(accounts),
        },
        "income": {
            "monthly_gross": round(monthly_income, 2),
            "monthly_net":   round(monthly_net, 2),
            "sources": len(income_sources),
            "source_names": [s.name for s in income_sources],
        },
        "investments": {
            "total_invested":   round(total_invested, 2),
            "current_value":    round(total_inv_val, 2),
            "unrealised_pnl":   round(inv_pnl, 2),
            "sip_monthly":      round(sip_monthly, 2),
            "count":            len(investments),
        },
        "loans": {
            "total_outstanding": round(total_loan, 2),
            "monthly_emi":       round(monthly_emi, 2),
            "count":             len(loans),
            "lenders": [l.lender_name for l in loans],
        },
        "assets": {
            "total_value": round(total_asset_val, 2),
            "count":       len(assets),
        },
        "insurance": {
            "has_health": has_health,
            "has_term":   has_term,
            "count":      len(insurances),
        },
        "goals": {
            "active": len(goals),
            "names": [g.name for g in goals],
        },
        "emi_burden": {
            "total_monthly": round(total_emi_burden, 2),
            "pct_of_income": emi_burden_pct,
            "status": "CRITICAL" if emi_burden_pct > 50 else "WARNING" if emi_burden_pct > 35 else "HEALTHY",
        },
    }


def _fmt_ctx(ctx: dict) -> str:
    """Format context dict as readable text for LLM system prompt."""
    def fmt(v): return f"₹{v:,.0f}"

    lines = [
        f"Net Worth: {fmt(ctx['net_worth'])}",
        f"Total Assets: {fmt(ctx['total_assets'])} | Total Liabilities: {fmt(ctx['total_liabilities'])}",
        "",
        f"💰 BANKING: Balance = {fmt(ctx['banking']['total_balance'])} across {ctx['banking']['accounts']} account(s)",
        "",
        f"💼 INCOME: Gross = {fmt(ctx['income']['monthly_gross'])}/mo, Net = {fmt(ctx['income']['monthly_net'])}/mo",
        f"   Sources: {', '.join(ctx['income']['source_names']) or 'none added'}",
        "",
        f"📈 INVESTMENTS: Invested = {fmt(ctx['investments']['total_invested'])}, "
        f"Current = {fmt(ctx['investments']['current_value'])}, "
        f"P&L = {fmt(ctx['investments']['unrealised_pnl'])}, "
        f"SIP = {fmt(ctx['investments']['sip_monthly'])}/mo",
        "",
        f"🏦 LOANS: Outstanding = {fmt(ctx['loans']['total_outstanding'])}, "
        f"EMI = {fmt(ctx['loans']['monthly_emi'])}/mo across {ctx['loans']['count']} loan(s)",
        f"   Lenders: {', '.join(ctx['loans']['lenders']) or 'none'}",
        "",
        f"🏠 PHYSICAL ASSETS: {fmt(ctx['assets']['total_value'])} across {ctx['assets']['count']} item(s)",
        "",
        f"🛡️ INSURANCE: Health={'✅' if ctx['insurance']['has_health'] else '❌'}, "
        f"Term/Life={'✅' if ctx['insurance']['has_term'] else '❌'}, "
        f"Total policies: {ctx['insurance']['count']}",
        "",
        f"🎯 GOALS: {ctx['goals']['active']} active goal(s): {', '.join(ctx['goals']['names']) or 'none'}",
        "",
        f"📊 EMI BURDEN: {fmt(ctx['emi_burden']['total_monthly'])}/mo = "
        f"{ctx['emi_burden']['pct_of_income']}% of income [{ctx['emi_burden']['status']}]",
    ]
    return "\n".join(lines)


# ─── Rule-based fallback ──────────────────────────────────────────────────────

def _rule_based_response(message: str, ctx: dict) -> str:
    msg = message.lower()

    def fmt(v): return f"₹{v:,.0f}"

    # Net worth
    if any(k in msg for k in ["net worth", "total wealth", "total assets"]):
        nw = ctx["net_worth"]
        return (f"Your current **net worth is {fmt(nw)}**.\n\n"
                f"• Total assets: {fmt(ctx['total_assets'])}\n"
                f"• Total liabilities: {fmt(ctx['total_liabilities'])}\n"
                f"• Bank balance: {fmt(ctx['banking']['total_balance'])}\n"
                f"• Investments: {fmt(ctx['investments']['current_value'])}\n"
                f"• Physical assets: {fmt(ctx['assets']['total_value'])}")

    # Debt / loans
    if any(k in msg for k in ["debt", "loan", "emi", "outstanding", "borrow"]):
        return (f"Your total loan outstanding is **{fmt(ctx['loans']['total_outstanding'])}** "
                f"across {ctx['loans']['count']} loan(s).\n\n"
                f"• Monthly EMI: {fmt(ctx['loans']['monthly_emi'])}\n"
                f"• EMI burden: {ctx['emi_burden']['pct_of_income']}% of income "
                f"({ctx['emi_burden']['status']})\n"
                f"• Lenders: {', '.join(ctx['loans']['lenders']) or 'none recorded'}\n\n"
                + ("⚠️ EMI burden > 50% is unsustainable. Consider prepayment." if ctx['emi_burden']['pct_of_income'] > 50 else
                   "✅ EMI burden is within healthy range." if ctx['emi_burden']['pct_of_income'] <= 35 else
                   "⚠️ EMI burden is elevated (35–50%). Keep discretionary spending low."))

    # Investments
    if any(k in msg for k in ["invest", "portfolio", "mutual fund", "stock", "sip"]):
        pnl = ctx["investments"]["unrealised_pnl"]
        pnl_str = f"+{fmt(pnl)}" if pnl >= 0 else fmt(pnl)
        return (f"Your investment portfolio is worth **{fmt(ctx['investments']['current_value'])}**.\n\n"
                f"• Invested: {fmt(ctx['investments']['total_invested'])}\n"
                f"• Unrealised P&L: {pnl_str}\n"
                f"• SIP: {fmt(ctx['investments']['sip_monthly'])}/month\n"
                f"• {ctx['investments']['count']} investment(s) tracked\n\n"
                "Go to **Investments** for full allocation breakdown and diversification score.")

    # Income
    if any(k in msg for k in ["income", "salary", "earn", "take home"]):
        return (f"Your monthly gross income is **{fmt(ctx['income']['monthly_gross'])}** "
                f"(net: {fmt(ctx['income']['monthly_net'])}).\n\n"
                f"• {ctx['income']['sources']} income source(s): {', '.join(ctx['income']['source_names']) or 'none added'}\n"
                f"• Annual gross: {fmt(ctx['income']['monthly_gross'] * 12)}\n\n"
                "Add income sources in the **Income** module for detailed tracking.")

    # Insurance
    if any(k in msg for k in ["insur", "cover", "policy", "premium", "claim"]):
        gaps = []
        if not ctx["insurance"]["has_health"]: gaps.append("health insurance")
        if not ctx["insurance"]["has_term"]:   gaps.append("term/life insurance")
        response = f"You have **{ctx['insurance']['count']} active insurance policy(ies)**.\n\n"
        if gaps:
            response += f"⚠️ **Coverage gaps detected**: {', '.join(gaps)}.\n"
            response += "These are critical for financial protection."
        else:
            response += "✅ You have both health and life/term coverage."
        return response

    # Liquidity / cash
    if any(k in msg for k in ["liquid", "cash", "bank", "balance", "withdraw"]):
        return (f"Your total liquid bank balance is **{fmt(ctx['banking']['total_balance'])}** "
                f"across {ctx['banking']['accounts']} account(s).\n\n"
                f"• Monthly income (net): {fmt(ctx['income']['monthly_net'])}\n"
                f"• Monthly EMI burden: {fmt(ctx['emi_burden']['total_monthly'])}\n\n"
                "Go to **Banking** for cashflow analysis and burn rate details.")

    # Goals
    if any(k in msg for k in ["goal", "target", "save", "corpus", "retire", "house", "car"]):
        return (f"You have **{ctx['goals']['active']} active goal(s)**: "
                f"{', '.join(ctx['goals']['names']) or 'none set'}.\n\n"
                "Go to **Goals** to see progress, ETAs, and contribution tracking.")

    # Health score
    if any(k in msg for k in ["health", "score", "financial health"]):
        emi_ok  = ctx['emi_burden']['pct_of_income'] <= 35
        has_inv = ctx['investments']['current_value'] > 0
        has_ins = ctx['insurance']['has_health'] and ctx['insurance']['has_term']
        score = (25 if emi_ok else 10) + (25 if has_inv else 0) + (25 if has_ins else 10) + 15
        return (f"Your estimated financial health score is **{score}/100**.\n\n"
                f"• Debt burden: {'✅ Healthy' if emi_ok else '⚠️ High'} ({ctx['emi_burden']['pct_of_income']}% of income)\n"
                f"• Investments: {'✅ Active' if has_inv else '❌ None tracked'}\n"
                f"• Insurance: {'✅ Covered' if has_ins else '⚠️ Gaps exist'}\n\n"
                "For the detailed health score, go to **Net Worth Engine**.")

    # Default
    return (f"I'm FinOS AI, your personal CFO. Here's your quick snapshot:\n\n"
            f"💰 Net Worth: **{fmt(ctx['net_worth'])}**\n"
            f"🏦 Cash: {fmt(ctx['banking']['total_balance'])}\n"
            f"📈 Investments: {fmt(ctx['investments']['current_value'])}\n"
            f"🏦 Debt: {fmt(ctx['loans']['total_outstanding'])}\n"
            f"📊 EMI Burden: {ctx['emi_burden']['pct_of_income']}% of income\n\n"
            "Ask me anything about your finances — debt, investments, income, goals, insurance, or net worth.")


# ─── Ollama call ──────────────────────────────────────────────────────────────

async def _call_ollama(messages: list, model: str) -> str:
    payload = {"model": model, "messages": messages, "stream": False}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{OLLAMA_HOST}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "")
    except Exception:
        return ""  # Triggers fallback


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_id = uuid.UUID(req.session_id) if req.session_id else uuid.uuid4()
    model      = req.model or OLLAMA_MODEL

    # Build financial context
    ctx = await _build_context(db, current_user)
    ctx_text = _fmt_ctx(ctx)

    # Retrieve last 10 messages of this session for history
    hist_result = await db.execute(
        select(AIConversation)
        .where(AIConversation.user_id == current_user.id,
               AIConversation.session_id == session_id)
        .order_by(AIConversation.created_at)
        .limit(20)
    )
    history = hist_result.scalars().all()

    # Build messages for Ollama
    messages = [{"role": "system", "content": SYSTEM_PROMPT_TEMPLATE.format(context=ctx_text)}]
    for h in history:
        if str(h.role) in ("user", "assistant"):
            messages.append({"role": str(h.role), "content": h.content})
    messages.append({"role": "user", "content": req.message})

    # Try Ollama first
    ai_response = await _call_ollama(messages, model)
    used_model  = model

    # Fallback to rule-based
    if not ai_response:
        ai_response = _rule_based_response(req.message, ctx)
        used_model  = "rule-based"

    # Persist user message
    db.add(AIConversation(
        user_id=current_user.id, session_id=session_id,
        role="user",      content=req.message,
        context_snapshot=ctx, model_used=used_model,
    ))
    # Persist assistant response
    db.add(AIConversation(
        user_id=current_user.id, session_id=session_id,
        role="assistant", content=ai_response,
        context_snapshot={}, model_used=used_model,
    ))
    await db.commit()

    return {
        "session_id": str(session_id),
        "response":   ai_response,
        "model":      used_model,
        "context":    ctx,
    }


@router.get("/history")
async def get_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 50,
):
    result = await db.execute(
        select(AIConversation)
        .where(AIConversation.user_id == current_user.id)
        .order_by(AIConversation.created_at.desc())
        .limit(limit)
    )
    msgs = result.scalars().all()
    # Group by session
    sessions: dict = {}
    for m in reversed(msgs):
        sid = str(m.session_id)
        if sid not in sessions:
            sessions[sid] = {"session_id": sid, "messages": [], "created_at": str(m.created_at)}
        sessions[sid]["messages"].append({
            "role": str(m.role), "content": m.content,
            "created_at": str(m.created_at), "model": m.model_used,
        })
    return list(sessions.values())


@router.delete("/history")
async def clear_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        delete(AIConversation).where(AIConversation.user_id == current_user.id)
    )
    await db.commit()
    return {"ok": True}
