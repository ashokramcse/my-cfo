from celery import Celery
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
    },
)
