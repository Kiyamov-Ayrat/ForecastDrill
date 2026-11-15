import math
from uuid import UUID
from app.domain.channels import CHANNEL_BY_CODE, SIGNATURES
from app.ml.base import PredictionResult, RiskPredictor
from app.ml.features import TelemetryWindow

FLOOR, CEIL = 0.02, 0.97        # границы вероятности
STEEP, MID = 12.0, 0.45         # крутизна и центр сигмоиды
LEAD_S = 20.0                   # на сколько секунд вперёд «заглядываем» по тренду


class TelemetryRiskPredictor(RiskPredictor):
    """Демонстрационная модель: оценивает тяжесть каждого осложнения по отклонениям
    каналов от нормы и по скорости их роста. Заменяется LightGBM без изменения сервисов."""

    window_seconds = 60
    SPAN = 10               # отсчётов в «текущем» окне
    MIN_SAMPLES = 25        # минимум данных для прогноза

    async def predict(self, well_id: UUID, window: TelemetryWindow | None = None) -> list[PredictionResult]:
        if window is None or window.length < self.MIN_SAMPLES:
            return []
        results = []
        for complication, signature in SIGNATURES.items():
            now_s, contrib = self._severity(window, signature, 0)
            prev_s, _ = self._severity(window, signature, self.SPAN)
            slope = (now_s - prev_s) / self.SPAN
            eff = now_s + max(0.0, slope) * LEAD_S            # упреждающая поправка по тренду
            p = FLOOR + (CEIL - FLOOR) / (1.0 + math.exp(-STEEP * (eff - MID)))
            results.append(PredictionResult(complication, p, contrib))
        return results

    def _severity(self, w: TelemetryWindow, signature: dict[str, float], offset: int):
        num = den = 0.0
        parts: dict[str, float] = {}
        for code, k in signature.items():
            vals = w.series.get(code)
            if not vals or len(vals) < self.SPAN + offset:
                continue
            seg = vals[len(vals) - self.SPAN - offset: len(vals) - offset]
            spec = CHANNEL_BY_CODE[code]
            dev = (sum(seg) / len(seg) - spec.nominal) / spec.scale       # отклонение в «значимых единицах»
            num += k * dev
            den += k * k
            parts[spec.name] = max(0.0, k * dev)
        if den == 0.0:
            return 0.0, {}
        total = sum(parts.values())
        contrib = {n: v / total for n, v in parts.items()} if total > 0 else {n: 1.0 / len(parts) for n in parts}
        return max(0.0, num / den), contrib                              # проекция на сигнатуру ≈ тяжесть