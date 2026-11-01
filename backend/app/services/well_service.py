# app/services/well_service.py
from app.domain.access import can_access_well
from app.domain.enums import Level
from app.models.entities import User
from app.repositories.interfaces import IWellRepository
from app.schemas.well import WellSummary
from app.services.risk_service import RiskService


class WellService:
    def __init__(self, wells: IWellRepository, risk: RiskService):
        self.wells, self.risk = wells, risk

    async def summaries(self, user: User, attention_only: bool = False) -> list[WellSummary]:
        out = []
        for w in await self.wells.all():
            if not can_access_well(user, w.id):
                continue
            s = await self.risk.snapshot(w.id)                 # расчёт не дублируем (DRY)
            if attention_only and s.level is Level.green and s.data_status == "ok":
                continue
            out.append(WellSummary(id=w.id, name=w.name, field=w.field, status=w.status,
                                   risk_index=s.index, level=s.level, data_status=s.data_status))
        return out