# app/services/auth_service.py
from datetime import timedelta
from app.core.config import settings
from app.core.exceptions import Forbidden, TooManyRequests, Unauthorized
from app.core.security import create_access_token, verify_password
from app.core.utils import aware, utcnow
from app.models.entities import User
from app.repositories.interfaces import IUserRepository
from app.services.audit_service import AuditService


class AuthService:
    def __init__(self, users: IUserRepository, audit: AuditService):
        self.users = users
        self.audit = audit

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