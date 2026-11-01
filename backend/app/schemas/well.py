# app/schemas/well.py
from uuid import UUID
from pydantic import BaseModel
from app.domain.enums import Level, WellStatus


class WellSummary(BaseModel):
    id: UUID
    name: str
    field: str
    status: WellStatus
    risk_index: int
    level: Level
    data_status: str