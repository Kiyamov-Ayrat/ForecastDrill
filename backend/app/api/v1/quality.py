from datetime import datetime
from fastapi import APIRouter, Depends, Query
from app.core.deps import get_quality_service, require_roles, well_access
from app.domain.enums import Complication, Role
from app.models.entities import User, Well
from app.schemas.quality import EventLabel, QualityEvent, QualityStream

router = APIRouter(prefix="/wells/{well_id}/quality", tags=["Качество данных и разметка"])
ROLES = (Role.ml_engineer, Role.supervisor)


@router.get("/stream", response_model=QualityStream)                      # UC-7
async def stream(window_from: datetime = Query(..., alias="from"), window_to: datetime = Query(..., alias="to"),
                 channels: str | None = None, max_points: int = Query(600, ge=50, le=2000),
                 well: Well = Depends(well_access), _: User = Depends(require_roles(*ROLES)),
                 svc=Depends(get_quality_service)):
    codes = [c.strip() for c in channels.split(",") if c.strip()] if channels else None
    return await svc.stream(well.id, window_from, window_to, codes, max_points)


@router.get("/events", response_model=list[QualityEvent])                  # UC-7
async def events(window_from: datetime = Query(..., alias="from"), window_to: datetime = Query(..., alias="to"),
                 label: EventLabel | None = None, complication: Complication | None = Query(None, alias="type"),
                 well: Well = Depends(well_access), _: User = Depends(require_roles(*ROLES)),
                 svc=Depends(get_quality_service)):
    return await svc.events(well.id, window_from, window_to, label, complication)