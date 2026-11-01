# app/schemas/risk.py
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel
from app.domain.enums import Complication, Level


class RiskItem(BaseModel):
    type: Complication
    probability: int          # индекс 0..100
    level: Level


class Reason(BaseModel):
    feature: str
    contribution: int         # вклад в процентах


class RiskSnapshot(BaseModel):
    well_id: UUID
    ts: datetime | None
    index: int
    level: Level
    data_status: str          # ok | no_data
    items: list[RiskItem]
    reasons: list[Reason]
    recommendation: str | None


class RiskPoint(BaseModel):
    ts: datetime
    index: int