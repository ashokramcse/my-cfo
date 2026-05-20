from fastapi import APIRouter
from app.api import auth, cards, transactions, emis, friends, statements, reports, insights

router = APIRouter()
router.include_router(auth.router, prefix="/auth", tags=["Auth"])
router.include_router(cards.router, prefix="/cards", tags=["Cards"])
router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
router.include_router(emis.router, prefix="/emis", tags=["EMIs"])
router.include_router(friends.router, prefix="/friends", tags=["Friends"])
router.include_router(statements.router, prefix="/statements", tags=["Statements"])
router.include_router(reports.router, prefix="/reports", tags=["Reports"])
router.include_router(insights.router, prefix="/insights", tags=["Insights"])
