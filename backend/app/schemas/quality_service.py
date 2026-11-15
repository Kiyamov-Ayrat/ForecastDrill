import math
from datetime import datetime, timedelta
from uuid import UUID
from app.core.exceptions import AppError
from app.core.utils import aware
from app.domain.channels import CHANNEL_BY_CODE
from app.domain.enums import Complication
from app.models.entities import Alert
from app.repositories.interfaces import IAlertRepository, IUserRepository
from app.schemas.quality import QualityEvent, QualityStream
from app.services.telemetry_service import TelemetryService

MAX_STREAM_RANGE = timedelta(hours=24)


def label_of(a: Alert) -> str:
    if a.feedbacks:
        return a.feedbacks[-1].verdict.value                 # confirmed | false_alarm
    return "pending" if a.closed_at is None else "unmarked"


class QualityService:
    """Разметка и поток телеметрии для ML-инженера."""

    def __init__(self, telemetry: TelemetryService, alerts: IAlertRepository, users: IUserRepository):
        self.telemetry, self.alerts, self.users = telemetry, alerts, users

    async def events(self, well_id: UUID, start: datetime, end: datetime, label: str | None = None,
                     complication: Complication | None = None, limit: int = 200) -> list[QualityEvent]:
        start, end = aware(start), aware(end)
        if end <= start:
            raise AppError("Начало периода позже конца")
        alerts = await self.alerts.find_overlapping(well_id, start, end)
        logins = await self.users.logins({fb.user_id for a in alerts for fb in a.feedbacks})
        out = []
        for a in alerts:
            fb = a.feedbacks[-1] if a.feedbacks else None
            event = QualityEvent(
                id=a.id, well_id=well_id, type=a.prediction.version.complication_type, level=a.level,
                started_at=a.created_at, ended_at=a.closed_at, peak_index=a.peak_index, status=a.status,
                label=label_of(a), marked_by=logins.get(fb.user_id) if fb else None,
                marked_at=fb.created_at if fb else None, comment=fb.comment if fb else None,
                review_note=a.review_note)
            if (label is None or event.label == label) and (complication is None or event.type == complication):
                out.append(event)
        return out[-limit:]

    async def stream(self, well_id: UUID, start: datetime, end: datetime,
                     codes: list[str] | None, max_points: int) -> QualityStream:
        start, end = aware(start), aware(end)
        if end <= start:
            raise AppError("Начало периода позже конца")
        if end - start > MAX_STREAM_RANGE:
            raise AppError("Период не более 24 часов")
        if codes and any(c not in CHANNEL_BY_CODE for c in codes):
            raise AppError("Неизвестный канал телеметрии")
        step = max(1, math.ceil((end - start).total_seconds() / max_points))
        series = await self.telemetry.bucketed(well_id, start, end, codes, step)
        first, last = await self.telemetry.time_range(well_id)
        return QualityStream(well_id=well_id, window_from=start, window_to=end, step_seconds=step,
                             available_from=first, available_to=last, series=series,
                             events=await self.events(well_id, start, end))