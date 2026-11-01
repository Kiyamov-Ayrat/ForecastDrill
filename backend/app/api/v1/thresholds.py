# app/api/v1/thresholds.py
from fastapi import APIRouter, Depends
from app.core.deps import get_threshold_service, require_roles, well_access
from app.domain.enums import Role
from app.models.entities import User, Well
from app.schemas.threshold import ThresholdItem, ThresholdsIn

router = APIRouter(prefix="/wells/{well_id}/thresholds", tags=["Пороги тревог"])
ROLES = (Role.supervisor, Role.ml_engineer)


@router.get("", response_model=list[ThresholdItem])                       # UC-6
async def get_thresholds(well: Well = Depends(well_access),
                         _: User = Depends(require_roles(*ROLES)), svc=Depends(get_threshold_service)):
    return await svc.get(well.id)


@router.put("", response_model=list[ThresholdItem])                       # UC-6
async def put_thresholds(body: ThresholdsIn, well: Well = Depends(well_access),
                         user: User = Depends(require_roles(*ROLES)), svc=Depends(get_threshold_service)):
    return await svc.update(user, well.id, body.items)