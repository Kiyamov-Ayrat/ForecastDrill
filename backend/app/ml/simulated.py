# app/ml/simulated.py
import random
from uuid import UUID
from app.domain.enums import Complication
from app.ml.base import PredictionResult, RiskPredictor

CONTRIBUTIONS = {
    Complication.sticking: {"Момент на роторе": 0.40, "Нагрузка на крюке": 0.30,
                            "Давление на стояке": 0.20, "Скорость проходки": 0.10},
    Complication.kick: {"Приращение объёма в ёмкостях": 0.45, "Расход на выходе": 0.30,
                        "Давление на стояке": 0.15, "Плотность раствора": 0.10},
    Complication.loss: {"Разница расходов (выход − вход)": 0.42, "Уровень в ёмкостях": 0.31,
                        "Давление на стояке": 0.14, "Скорость проходки": 0.13},
}


class SimulatedPredictor(RiskPredictor):
    """Демонстрационный предиктор: случайное блуждание вероятности.
    Заменяется LightGbmPredictor без изменения сервисов (принцип OCP)."""

    def __init__(self) -> None:
        self._state: dict[tuple[UUID, Complication], float] = {}

    async def predict(self, well_id: UUID) -> list[PredictionResult]:
        results = []
        for c in Complication:
            p = self._state.get((well_id, c), random.uniform(0.05, 0.25))
            p = min(1.0, max(0.0, p + random.gauss(0.01 if c is Complication.loss else 0.0, 0.03)))
            self._state[(well_id, c)] = p
            results.append(PredictionResult(c, p, CONTRIBUTIONS[c]))
        return results