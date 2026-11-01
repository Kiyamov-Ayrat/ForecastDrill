# app/ml/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID
from app.domain.enums import Complication


@dataclass(frozen=True)
class PredictionResult:
    complication: Complication
    probability: float                  # 0..1
    contributions: dict[str, float]     # вклад признаков, сумма = 1


class RiskPredictor(ABC):
    @abstractmethod
    async def predict(self, well_id: UUID) -> list[PredictionResult]: ...