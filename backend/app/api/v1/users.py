# app/api/v1/users.py
from uuid import UUID
from fastapi import APIRouter, Depends, status
from app.core.deps import get_auth_service, require_roles
from app.core.exceptions import Conflict
from app.domain.enums import Role
from app.models.entities import User
from app.schemas.auth import UserCreateIn, UserOut, UserUpdateIn

router = APIRouter(prefix="/users", tags=["Пользователи (администрирование)"])
ADMIN = (Role.admin,)


@router.get("", response_model=list[UserOut])                          # UC-13
async def list_users(_: User = Depends(require_roles(*ADMIN)),
                     svc=Depends(get_auth_service)):
    return await svc.list_users()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)   # UC-13
async def create_user(body: UserCreateIn, admin: User = Depends(require_roles(*ADMIN)),
                      svc=Depends(get_auth_service)):
    return await svc.create_user(admin, body)


@router.patch("/{user_id}", response_model=UserOut)                    # UC-13
async def update_user(user_id: UUID, body: UserUpdateIn,
                      admin: User = Depends(require_roles(*ADMIN)),
                      svc=Depends(get_auth_service)):
    if user_id == admin.id and body.is_active is False:
        raise Conflict("Нельзя отключить собственную учётную запись")
    return await svc.update_user(admin, user_id, body)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)   # UC-13
async def delete_user(user_id: UUID, admin: User = Depends(require_roles(*ADMIN)),
                      svc=Depends(get_auth_service)):
    await svc.delete_user(admin, user_id)
