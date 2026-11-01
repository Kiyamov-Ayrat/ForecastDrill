# app/api/v1/alerts.py
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from app.core.deps import get_alert_service, require_roles
from app.domain.enums import AlertStatus, Complication, Role
from app.models.entities import User
from app.schemas.alert import AlertOut, FeedbackIn, FeedbackOut

router = APIRouter(prefix="/alerts", tags=["Предупреждения"])
ROLES = (Role.operator, Role.supervisor)


@router.get("", response_model=list[AlertOut])                            # UC-3
async def list_alerts(well_id: UUID | None = None,
                      complication: Complication | None = Query(None, alias="type"),
                      status: AlertStatus | None = None, limit: int = Query(100, ge=1, le=500),
                      user: User = Depends(require_roles(*ROLES)), svc=Depends(get_alert_service)):
    return await svc.find(user, well_id, complication, status, limit)


@router.post("/{alert_id}/feedback", response_model=FeedbackOut, status_code=201)   # UC-4
async def feedback(alert_id: UUID, body: FeedbackIn,
                   user: User = Depends(require_roles(*ROLES)), svc=Depends(get_alert_service)):
    fb = await svc.give_feedback(user, alert_id, body.verdict, body.comment)
    return FeedbackOut(id=fb.id, alert_id=fb.alert_id, author_id=fb.user_id, verdict=fb.verdict,
                       comment=fb.comment, created_at=fb.created_at)