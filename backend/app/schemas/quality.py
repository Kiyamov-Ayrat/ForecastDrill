from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel
from app.domain.enums import AlertStatus, Complication, Level
from app.schemas.telemetry import TelemetrySeries

EventLabel = Literal["confirmed", "false_alarm", "pending", "unmarked"]


class QualityEvent(BaseModel):
    id: UUID
    well_id: UUID
    type: Complication
    level: Level
    started_at: datetime
    ended_at: datetime | None
    peak_index: int
    status: AlertStatus
    label: EventLabel
    marked_by: str | None
    marked_at: datetime | None
    comment: str | None
    review_note: str | None


class QualityStream(BaseModel):
    well_id: UUID
    window_from: datetime
    window_to: datetime
    step_seconds: int
    available_from: datetime | None
    available_to: datetime | None
    series: list[TelemetrySeries]
    events: list[QualityEvent]