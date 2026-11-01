# app/services/threshold_service.py
from uuid import UUID
from app.models.entities import Threshold, User
from app.repositories.interfaces import IThresholdRepository
from app.schemas.threshold import ThresholdItem
from app.services.audit_service import AuditService


class ThresholdService:
    def __init__(self, repo: IThresholdRepository, audit: AuditService):
        self.repo, self.audit = repo, audit

    async def get(self, well_id: UUID) -> list[ThresholdItem]:
        return [ThresholdItem(type=c, yellow=y, red=r)
                for c, (y, r) in (await self.repo.as_map(well_id)).items()]

    async def update(self, user: User, well_id: UUID, items: list[ThresholdItem]) -> list[ThresholdItem]:
        await self.repo.upsert_many([Threshold(well_id=well_id, type=i.type, yellow=i.yellow, red=i.red)
                                     for i in items])
        await self.audit.log(user.id, f"thresholds:update:{well_id}")
        return await self.get(well_id)