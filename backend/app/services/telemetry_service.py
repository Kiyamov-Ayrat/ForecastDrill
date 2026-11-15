from datetime import datetime, timedelta
from uuid import UUID
from app.core.utils import utcnow
from app.domain.channels import CHANNELS
from app.domain.enums import QualityFlag
from app.ml.features import TelemetryWindow
from app.models.entities import TelemetryRecord
from app.repositories.interfaces import ITelemetryRepository
from app.schemas.telemetry import TelemetryPoint, TelemetrySeries


class TelemetryService:
    def __init__(self, repo: ITelemetryRepository):
        self.repo = repo

    async def ensure_channels(self) -> None:
        await self.repo.ensure_channels(CHANNELS)

    async def _ids(self) -> dict[str, int]:                  # код канала → id в БД
        names = await self.repo.channel_map()
        return {c.code: names[c.name] for c in CHANNELS if c.name in names}

    async def ingest(self, batch: list[tuple[UUID, dict[str, float]]], ts: datetime) -> None:
        ids = await self._ids()
        rows = [TelemetryRecord(well_id=w, channel_id=ids[code], ts=ts, value=v, quality_flag=QualityFlag.ok)
                for w, values in batch for code, v in values.items() if code in ids]
        if rows:
            await self.repo.add_many(rows)

    async def window(self, well_id: UUID, seconds: int) -> TelemetryWindow:
        by_id = {i: c for c, i in (await self._ids()).items()}
        rows = await self.repo.window(well_id, utcnow() - timedelta(seconds=seconds))
        series: dict[str, list[float]] = {}
        for ch_id, _ts, value, flag in rows:
            if flag is QualityFlag.ok and ch_id in by_id:      # недостоверные значения в прогноз не идут
                series.setdefault(by_id[ch_id], []).append(value)
        return TelemetryWindow(series)

    async def series(self, well_id: UUID, seconds: int, codes: list[str] | None) -> list[TelemetrySeries]:
        by_id = {i: c for c, i in (await self._ids()).items()}
        rows = await self.repo.window(well_id, utcnow() - timedelta(seconds=seconds))
        acc: dict[str, list[TelemetryPoint]] = {}
        for ch_id, ts, value, _flag in rows:
            code = by_id.get(ch_id)
            if code and (codes is None or code in codes):
                acc.setdefault(code, []).append(TelemetryPoint(ts=ts, value=round(value, 3)))
        return [TelemetrySeries(code=c.code, name=c.name, unit=c.unit, nominal=c.nominal,
                                points=acc.get(c.code, []))
                for c in CHANNELS if codes is None or c.code in codes]

    async def purge(self, hours: int) -> None:
        await self.repo.purge_before(utcnow() - timedelta(hours=hours))