# app/services/auth_service.py
from datetime import timedelta
from typing import Sequence
from uuid import UUID
from app.core.config import settings
from app.core.exceptions import Conflict, Forbidden, NotFound, TooManyRequests, Unauthorized
from app.core.security import create_access_token, hash_password, verify_password
from app.core.utils import aware, utcnow
from app.models.entities import User, Well
from app.repositories.interfaces import IUserRepository, IWellRepository
from app.schemas.auth import UserCreateIn, UserUpdateIn
from app.services.audit_service import AuditService


class AuthService:
    def __init__(self, users: IUserRepository, audit: AuditService,
                 wells: IWellRepository | None = None):
        self.users, self.audit, self.wells = users, audit, wells

    async def login(self, login: str, password: str) -> tuple[str, User]:
        user = await self.users.get_by_login(login)
        if user is None:
            raise Unauthorized("Неверный логин или пароль")
        now = utcnow()
        if user.locked_until and aware(user.locked_until) > now:
            raise TooManyRequests("Вход заблокирован. Повторите позже")
        if not verify_password(password, user.password_hash):
            user.failed_attempts += 1
            if user.failed_attempts >= settings.max_login_attempts:
                user.locked_until = now + timedelta(minutes=settings.lock_minutes)
                user.failed_attempts = 0
            await self.users.save(user)
            raise Unauthorized("Неверный логин или пароль")
        if not user.is_active:
            raise Forbidden("Учётная запись отключена администратором")
        user.failed_attempts, user.locked_until = 0, None
        await self.users.save(user)
        await self.audit.log(user.id, "login")
        return create_access_token(str(user.id), user.role.value), user

    # ===== UC-13: администрирование пользователей (создание / изменение / удаление) =====

    async def list_users(self) -> Sequence[User]:
        if self.wells is None:
            raise NotImplementedError("Репозиторий скважин не подключён")
        return await self.users.all()

    async def _resolve_wells(self, well_ids: Sequence[UUID]) -> list[Well]:
        all_wells = list(await self.wells.all())
        by_id = {w.id: w for w in all_wells}
        missing = [str(i) for i in well_ids if i not in by_id]
        if missing:
            raise NotFound("Скважины не найдены: " + ", ".join(missing))
        return [by_id[i] for i in set(well_ids)]

    async def create_user(self, admin: User, body: UserCreateIn) -> User:
        if await self.users.get_by_login(body.login):
            raise Conflict("Логин уже занят")
        user = User(login=body.login, password_hash=hash_password(body.password),
                    role=body.role, is_active=body.is_active)
        if body.well_ids:
            user.wells = await self._resolve_wells(body.well_ids)
        await self.users.save(user)
        await self.audit.log(admin.id, f"user:create:{user.id}:{user.login}")
        return user

    async def update_user(self, admin: User, user_id: UUID, body: UserUpdateIn) -> User:
        user = await self.users.get(user_id)
        if user is None:
            raise NotFound("Пользователь не найден")
        changed: list[str] = []
        if body.login is not None and body.login != user.login:
            if await self.users.get_by_login(body.login):
                raise Conflict("Логин уже занят")
            user.login, changed = body.login, changed + ["login"]
        if body.role is not None and body.role is not user.role:
            user.role, changed = body.role, changed + ["role"]
        if body.is_active is not None and body.is_active != user.is_active:
            user.is_active, changed = body.is_active, changed + ["active"]
            if user.is_active:                       # включение записи снимает блокировку входа
                user.failed_attempts, user.locked_until = 0, None
        if body.password:
            user.password_hash = hash_password(body.password)
            user.failed_attempts, user.locked_until = 0, None   # заодно снимаем блокировку
            changed.append("password")
        if body.well_ids is not None:
            user.wells = await self._resolve_wells(body.well_ids)
            changed.append("wells")
        if not changed:
            return user
        await self.users.save(user)
        await self.audit.log(admin.id, f"user:update:{user.id}:" + ",".join(changed))
        return user

    async def delete_user(self, admin: User, user_id: UUID) -> None:
        user = await self.users.get(user_id)
        if user is None:
            raise NotFound("Пользователь не найден")
        if user.id == admin.id:
            raise Conflict("Нельзя удалить собственную учётную запись")
        login = user.login
        await self.users.delete(user)
        await self.audit.log(admin.id, f"user:delete:{user_id}:{login}")