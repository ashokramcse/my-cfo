from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from datetime import datetime
import uuid


class InsightOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    insight_type: str
    severity: str
    title: str
    body: str
    action_label: Optional[str] = None
    action_url: Optional[str] = None
    is_read: bool
    is_dismissed: bool
    insight_data: Optional[Any] = None
    created_at: datetime
