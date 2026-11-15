from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID
from app.domain.enums import Complication
from app.ml.features import TelemetryWindow


@dataclass(frozen=True)
class PredictionResult:
    complication: Complication
    probability: float                  # 0..1
    contributions: dict[str, float]     # вклад признаков, сумма = 1


class RiskPredictor(ABC):
    window_seconds: int = 0             # сколько секунд телеметрии нужно модели (0 – не нужна)

    @abstractmethod
    async def predict(self, well_id: UUID, window: TelemetryWindow | None = None) -> list[PredictionResult]: ...