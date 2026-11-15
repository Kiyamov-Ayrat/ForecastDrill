# app/api/v1/wells.py
from fastapi import APIRouter, Depends, Query
from app.core.deps import get_current_user, get_risk_service, get_well_service, require_roles, well_access, \
    get_telemetry_service
from app.core.exceptions import AppError
from app.domain.channels import CHANNEL_BY_CODE
from app.domain.enums import Role
from app.models.entities import User, Well
from app.schemas.risk import RiskPoint, RiskSnapshot
from app.schemas.telemetry import TelemetrySeries
from app.schemas.well import WellSummary

router = APIRouter(prefix="/wells", tags=["Скважины и риск"])
RISK_ROLES = (Role.operator, Role.supervisor)


@router.get("", response_model=list[WellSummary])                         # UC-5
async def list_wells(attention: bool = False, user: User = Depends(get_current_user),
                     svc=Depends(get_well_service)):
    return await svc.summaries(user, attention_only=attention)


@router.get("/{well_id}/risk", response_model=RiskSnapshot)               # UC-2
async def get_risk(well: Well = Depends(well_access),
                   _: User = Depends(require_roles(*RISK_ROLES)), svc=Depends(get_risk_service)):
    return await svc.snapshot(well.id)


@router.get("/{well_id}/risk/history", response_model=list[RiskPoint])    # UC-2
async def risk_history(minutes: int = Query(30, ge=1, le=1440), well: Well = Depends(well_access),
                       _: User = Depends(require_roles(*RISK_ROLES)), svc=Depends(get_risk_service)):
    return await svc.history(well.id, minutes)

@router.get("/{well_id}/telemetry", response_model=list[TelemetrySeries])
async def get_telemetry(seconds: int = Query(180, ge=10, le=3600), channels: str | None = None,
                        well: Well = Depends(well_access),
                        _: User = Depends(require_roles(Role.operator, Role.supervisor, Role.ml_engineer)),
                        svc=Depends(get_telemetry_service)):
    codes = [c.strip() for c in channels.split(",")] if channels else None
    if codes and any(c not in CHANNEL_BY_CODE for c in codes):
        raise AppError("Неизвестный канал телеметрии")
    return await svc.series(well.id, seconds, codes)