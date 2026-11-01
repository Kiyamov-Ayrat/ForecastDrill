# app/services/audit_service.py
from uuid import UUID
from app.models.entities import AuditLog
from app.repositories.interfaces import IAuditRepository


class AuditService:
    def __init__(self, repo: IAuditRepository):
        self.repo = repo

    async def log(self, user_id: UUID, action: str) -> None:
        await self.repo.save(AuditLog(user_id=user_id, action=action))