# app/schemas/alert.py
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field
from app.domain.enums import AlertStatus, Complication, Level, Verdict


class AlertOut(BaseModel):
    id: UUID
    well_id: UUID
    type: Complication
    level: Level
    status: AlertStatus
    probability: int
    created_at: datetime
    verdict: Verdict | None = None

    @classmethod
    def from_entity(cls, a) -> "AlertOut":      # единое место преобразования (DRY)
        p = a.prediction
        return cls(id=a.id, well_id=p.well_id, type=p.version.complication_type,
                   level=a.level, status=a.status, probability=p.risk_index,
                   created_at=a.created_at,
                   verdict=a.feedbacks[-1].verdict if a.feedbacks else None)


class FeedbackIn(BaseModel):
    verdict: Verdict
    comment: str | None = Field(default=None, max_length=500)


class FeedbackOut(BaseModel):
    id: UUID
    alert_id: UUID
    author_id: UUID
    verdict: Verdict
    comment: str | None
    created_at: datetime