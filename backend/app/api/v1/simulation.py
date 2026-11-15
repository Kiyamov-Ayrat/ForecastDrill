from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.deps import get_audit_service, get_controller, require_roles
from app.core.exceptions import Forbidden, NotFound
from app.core.utils import utcnow
from app.domain.access import can_access_well
from app.domain.enums import Role
from app.models.entities import User
from app.repositories.impl import WellRepository
from app.schemas.simulation import ModeIn, SimulationStatus, StopIn, TriggerIn
from app.simulation.profiles import PROFILES

router = APIRouter(prefix="/simulation", tags=["Имитатор телеметрии"])
ROLES = (Role.admin, Role.ml_engineer, Role.supervisor)


def _status(ctrl) -> dict:
    return {"mode": ctrl.mode,
            "modes": [{"key": k, "title": p.title, "description": p.description} for k, p in PROFILES.items()],
            "episodes": ctrl.status(utcnow().timestamp())}


@router.get("", response_model=SimulationStatus)
async def get_status(_: User = Depends(require_roles(*ROLES)), ctrl=Depends(get_controller)):
    return _status(ctrl)


@router.put("", response_model=SimulationStatus)
async def set_mode(body: ModeIn, user: User = Depends(require_roles(*ROLES)),
                   ctrl=Depends(get_controller), audit=Depends(get_audit_service)):
    ctrl.set_mode(body.mode, utcnow().timestamp())
    await audit.log(user.id, f"simulation:mode:{body.mode.value}")
    return _status(ctrl)


@router.post("/trigger", response_model=SimulationStatus, status_code=202)
async def trigger(body: TriggerIn, user: User = Depends(require_roles(*ROLES)),
                  ctrl=Depends(get_controller), s: AsyncSession = Depends(get_session),
                  audit=Depends(get_audit_service)):
    if await WellRepository(s).get(body.well_id) is None:
        raise NotFound("Скважина не найдена")
    if not can_access_well(user, body.well_id):
        raise Forbidden("Нет доступа к скважине")
    ctrl.trigger(body.well_id, body.type, utcnow().timestamp())
    await audit.log(user.id, f"simulation:trigger:{body.type.value}:{body.well_id}")
    return _status(ctrl)


@router.post("/stop", response_model=SimulationStatus)
async def stop(body: StopIn, _: User = Depends(require_roles(*ROLES)), ctrl=Depends(get_controller)):
    ctrl.stop(body.well_id, utcnow().timestamp())
    return _status(ctrl)