from uuid import UUID
from pydantic import BaseModel
from app.domain.enums import Complication, SimulationMode


class ModeIn(BaseModel):
    mode: SimulationMode


class TriggerIn(BaseModel):
    well_id: UUID
    type: Complication


class StopIn(BaseModel):
    well_id: UUID | None = None


class ModeInfo(BaseModel):
    key: SimulationMode
    title: str
    description: str


class EpisodeInfo(BaseModel):
    well_id: UUID
    type: Complication
    phase: str          # precursor | event | recovery
    severity: float


class SimulationStatus(BaseModel):
    mode: SimulationMode
    modes: list[ModeInfo]
    episodes: list[EpisodeInfo]