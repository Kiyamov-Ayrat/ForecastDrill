from uuid import UUID
import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.core import container
from app.core.database import get_session
from app.core.exceptions import Forbidden, NotFound, Unauthorized
from app.core.security import decode_token
from app.domain.access import can_access_well
from app.domain.enums import Role
from app.ml import get_predictor
from app.ml.base import RiskPredictor
from app.models.entities import User, Well
from app.repositories.impl import UserRepository, WellRepository

bearer = HTTPBearer(auto_error=False)


def get_auth_service(s: AsyncSession = Depends(get_session)):
    return container.build_auth_service(s)


def get_risk_service(s: AsyncSession = Depends(get_session),
                     p: RiskPredictor = Depends(get_predictor)):
    return container.build_risk_service(s, p)


def get_well_service(s: AsyncSession = Depends(get_session),
                     p: RiskPredictor = Depends(get_predictor)):
    return container.build_well_service(s, p)


def get_alert_service(s: AsyncSession = Depends(get_session)):
    return container.build_alert_service(s)


def get_threshold_service(s: AsyncSession = Depends(get_session)):
    return container.build_threshold_service(s)


async def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer),
                           s: AsyncSession = Depends(get_session)) -> User:
    if creds is None:
        raise Unauthorized("Требуется авторизация")
    try:
        user_id = UUID(decode_token(creds.credentials)["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise Unauthorized("Маркер доступа недействителен или истёк")
    user = await UserRepository(s).get(user_id)
    if user is None or not user.is_active:
        raise Unauthorized("Пользователь не найден или отключён")
    return user


def require_roles(*roles: Role):
    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise Forbidden("Недостаточно прав для выполнения операции")
        return user
    return checker


async def well_access(well_id: UUID, user: User = Depends(get_current_user),
                      s: AsyncSession = Depends(get_session)) -> Well:
    well = await WellRepository(s).get(well_id)
    if well is None:
        raise NotFound("Скважина не найдена")
    if not can_access_well(user, well.id):
        raise Forbidden("Нет доступа к скважине")
    return well