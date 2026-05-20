from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from decimal import Decimal
from datetime import datetime


class CardSummary(BaseModel):
    card_id: str
    nickname: str
    bank_name: str
    outstanding: Decimal
    utilization_pct: Decimal
    next_due: Optional[datetime]
    min_due: Decimal


class EMISummary(BaseModel):
    active_count: int
    total_monthly: Decimal
    total_outstanding: Decimal
    self_emis: int
    friend_emis: int
    family_emis: int


class FriendReceivable(BaseModel):
    friend_id: str
    name: str
    total_pending: Decimal
    overdue_count: int
    next_due: Optional[datetime]


class CategorySpend(BaseModel):
    category: str
    amount: Decimal
    count: int
    percentage: Decimal


class MonthlyTrend(BaseModel):
    month: str
    spend: Decimal
    payments: Decimal
    emi: Decimal
    fees: Decimal


class DashboardStats(BaseModel):
    # Totals
    total_outstanding: Decimal
    total_credit_limit: Decimal
    total_available: Decimal
    utilization_pct: Decimal

    # This month
    monthly_spend: Decimal
    monthly_payments: Decimal
    monthly_emi_burden: Decimal

    # Upcoming
    upcoming_dues: List[CardSummary]
    next_due_date: Optional[datetime]
    next_due_amount: Decimal

    # EMI
    emi_summary: EMISummary

    # Friend receivables
    friend_receivables: List[FriendReceivable]
    total_receivables: Decimal

    # Financial health
    cashback_earned_month: Decimal
    interest_paid_month: Decimal
    reward_points_balance: int

    # Trends
    monthly_trends: List[MonthlyTrend]
    category_spending: List[CategorySpend]

    # Insights count
    unread_insights: int


class SpendingReport(BaseModel):
    period_from: datetime
    period_to: datetime
    total_spend: Decimal
    total_transactions: int
    category_breakdown: List[CategorySpend]
    monthly_trend: List[MonthlyTrend]
    top_merchants: List[Dict[str, Any]]
    card_breakdown: List[Dict[str, Any]]
    subscription_total: Decimal
    cashback_earned: Decimal
    reward_points: int


class EMIReport(BaseModel):
    total_active_emis: int
    total_outstanding: Decimal
    total_monthly_burden: Decimal
    interest_burden_total: Decimal
    no_cost_emi_count: int
    emis_by_card: List[Dict[str, Any]]
    emis_by_person: List[Dict[str, Any]]
    monthly_forecast: List[Dict[str, Any]]
    completion_forecast: List[Dict[str, Any]]
