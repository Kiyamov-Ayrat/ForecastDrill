# app/services/risk_service.py
from datetime import timedelta
from uuid import UUID
from app.core.utils import utcnow
from app.domain.enums import AlertStatus, Complication, Level
from app.domain.levels import SEVERITY, level_for
from app.ml.base import RiskPredictor
from app.models.entities import Alert, Prediction
from app.repositories.interfaces import IAlertRepository, IPredictionRepository, IThresholdRepository
from app.schemas.risk import Reason, RiskItem, RiskPoint, RiskSnapshot

# демонстрационные тексты; в проекте заменяются регламентом заказчика
RECOMMENDATIONS = {
    Complication.sticking: "Проверить момент и нагрузку на крюке, прекратить наращивание нагрузки, сообщить супервайзеру",
    Complication.kick: "Проверить приращение объёма в ёмкостях и расход на выходе, сообщить супервайзеру",
    Complication.loss: "Проверить баланс объёмов, снизить подачу насосов, сообщить супервайзеру",
}


class RiskService:
    def __init__(self, predictions, thresholds, alerts, predictor, telemetry):
        self.predictions, self.thresholds = predictions, thresholds
        self.alerts, self.predictor = alerts, predictor
        self.telemetry = telemetry

    async def recalculate(self, well_id: UUID) -> None:                                      # один момент на все три прогноза
        window = None
        if self.predictor.window_seconds:
            window = await self.telemetry.window(well_id, self.predictor.window_seconds)
        results = await self.predictor.predict(well_id, window)
        if not results:  # данных для прогноза ещё нет
            return
        thr = await self.thresholds.as_map(well_id)
        ts = utcnow()
        for r in results:
            version = await self.predictions.active_version(r.complication)
            if version is None:
                continue
            index = round(r.probability * 100)
            pred = await self.predictions.save(Prediction(
                well_id=well_id, version_id=version.id, ts=ts, probability=r.probability,
                risk_index=index, explanation=r.contributions))
            level = level_for(index, *thr[r.complication])
            open_alerts = await self.alerts.open_for(well_id, r.complication)
            if level is Level.green:
                await self.alerts.close(open_alerts, ts)      # эпизод осложнения закончился
            elif not open_alerts:
                await self.alerts.save(Alert(prediction_id=pred.id, level=level,
                                             status=AlertStatus.active, created_at=ts))

    async def snapshot(self, well_id: UUID) -> RiskSnapshot:
        latest = await self.predictions.latest_per_type(well_id)
        if not latest:
            return RiskSnapshot(well_id=well_id, ts=None, index=0, level=Level.green,
                                data_status="no_data", items=[], reasons=[], recommendation=None)
        thr = await self.thresholds.as_map(well_id)
        items = [RiskItem(type=c, probability=p.risk_index,
                          level=level_for(p.risk_index, *thr[c])) for c, p in latest.items()]
        top = max(items, key=lambda i: (SEVERITY[i.level], i.probability))
        reasons = [Reason(feature=k, contribution=round(v * 100))
                   for k, v in latest[top.type].explanation.items()]
        return RiskSnapshot(
            well_id=well_id, ts=max(p.ts for p in latest.values()),
            index=max(i.probability for i in items),          # BR-6: наибольшая из трёх вероятностей
            level=top.level, data_status="ok", items=items, reasons=reasons,
            recommendation=RECOMMENDATIONS[top.type] if top.level is not Level.green else None)

    async def history(self, well_id: UUID, minutes: int) -> list[RiskPoint]:
        rows = await self.predictions.history(well_id, utcnow() - timedelta(minutes=minutes))
        by_ts: dict = {}
        for p in rows:
            by_ts[p.ts] = max(by_ts.get(p.ts, 0), p.risk_index)
        return [RiskPoint(ts=t, index=i) for t, i in sorted(by_ts.items())]