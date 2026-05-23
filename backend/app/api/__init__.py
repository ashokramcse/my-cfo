from fastapi import APIRouter
from app.api import auth, cards, transactions, emis, friends, statements, reports, insights
from app.api import bank_accounts, investments, loans, assets, net_worth
from app.api import income, insurance, goals, ai_cfo, notifications, sharing

router = APIRouter()
router.include_router(auth.router,          prefix="/auth",          tags=["Auth"])
router.include_router(cards.router,         prefix="/cards",         tags=["Cards"])
router.include_router(transactions.router,  prefix="/transactions",  tags=["Transactions"])
router.include_router(emis.router,          prefix="/emis",          tags=["EMIs"])
router.include_router(friends.router,       prefix="/friends",       tags=["Friends"])
router.include_router(statements.router,    prefix="/statements",    tags=["Statements"])
router.include_router(reports.router,       prefix="/reports",       tags=["Reports"])
router.include_router(insights.router,      prefix="/insights",      tags=["Insights"])
router.include_router(bank_accounts.router, prefix="/bank-accounts", tags=["Banking"])
router.include_router(investments.router,   prefix="/investments",   tags=["Investments"])
router.include_router(loans.router,         prefix="/loans",         tags=["Loans"])
router.include_router(assets.router,        prefix="/assets",        tags=["Assets"])
router.include_router(net_worth.router,     prefix="/net-worth",     tags=["Net Worth"])
router.include_router(income.router,        prefix="/income",        tags=["Income"])
router.include_router(insurance.router,     prefix="/insurance",     tags=["Insurance"])
router.include_router(goals.router,         prefix="/goals",         tags=["Goals"])
router.include_router(ai_cfo.router,        prefix="/ai-cfo",        tags=["AI CFO"])
router.include_router(notifications.router, prefix="/notifications",  tags=["Notifications"])
router.include_router(sharing.router,       prefix="/sharing",         tags=["Sharing"])
