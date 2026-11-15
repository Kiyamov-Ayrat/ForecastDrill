from datetime import datetime
from pydantic import BaseModel


class TelemetryPoint(BaseModel):
    ts: datetime
    value: float


class TelemetrySeries(BaseModel):
    code: str
    name: str
    unit: str
    nominal: float
    points: list[TelemetryPoint]