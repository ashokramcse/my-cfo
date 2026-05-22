from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "ccbill",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.workers.tasks.parse_statement_task": {"queue": "pdf_parsing"},
        "app.workers.tasks.generate_insights_task": {"queue": "insights"},
        "app.workers.tasks.*": {"queue": "default"},
    },
    beat_schedule={
        "daily-insights": {
            "task": "app.workers.tasks.run_daily_insights",
            "schedule": 86400.0,
        },
        "update-friend-totals": {
            "task": "app.workers.tasks.update_all_friend_totals",
            "schedule": 3600.0,
        },
        "daily-net-worth-snapshot": {
            "task": "app.workers.tasks.take_daily_net_worth_snapshots",
            "schedule": crontab(hour=0, minute=15),  # 12:15 AM IST daily
        },
        "check-loan-overdues": {
            "task": "app.workers.tasks.check_loan_overdue_notifications",
            "schedule": crontab(hour=9, minute=0),   # 9 AM IST daily
        },
    },
)
