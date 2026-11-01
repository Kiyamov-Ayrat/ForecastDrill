# app/services/alert_service.py
from uuid import UUID
from app.core.exceptions import Conflict, Forbidden, NotFound
from app.domain.access import PRIVILEGED, can_access_well
from app.domain.enums import AlertStatus, Complication, Verdict
from app.models.entities import AlertFeedback, User
from app.repositories.interfaces import IAlertRepository
from app.schemas.alert import AlertOut
from app.services.audit_service import AuditService


class AlertService:
    def __init__(self, alerts: IAlertRepository, audit: AuditService):
        self.alerts, self.audit = alerts, audit

    async def find(self, user: User, well_id: UUID | None, c: Complication | None,
                   status: AlertStatus | None, limit: int) -> list[AlertOut]:
        if well_id is not None:
            if not can_access_well(user, well_id):
                raise Forbidden("Нет доступа к скважине")
            well_ids = [well_id]
        elif user.role in PRIVILEGED:
            well_ids = None
        else:
            well_ids = [w.id for w in user.wells]
        return [AlertOut.from_entity(a) for a in await self.alerts.find(well_ids, c, status, limit)]

    async def give_feedback(self, user: User, alert_id: UUID, verdict: Verdict,
                            comment: str | None) -> AlertFeedback:
        alert = await self.alerts.get(alert_id)
        if alert is None:
            raise NotFound("Предупреждение не найдено")
        if not can_access_well(user, alert.prediction.well_id):
            raise Forbidden("Нет доступа к скважине")
        if alert.feedbacks:
            raise Conflict("Отметка по этому предупреждению уже сохранена")
        fb = await self.alerts.add_feedback(
            alert, AlertFeedback(alert_id=alert.id, user_id=user.id, verdict=verdict, comment=comment))
        await self.audit.log(user.id, f"alert:feedback:{alert.id}:{verdict.value}")
        return fb