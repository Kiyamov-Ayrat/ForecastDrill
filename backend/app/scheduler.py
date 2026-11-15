import asyncio
import logging
import time
from datetime import timedelta
from app.core import container
from app.core.config import settings
from app.core.database import SessionFactory
from app.core.utils import utcnow
from app.ml import get_predictor
from app.repositories.impl import WellRepository
from app.simulation.controller import SimulationController

log = logging.getLogger(__name__)


async def warm_up(controller: SimulationController, seconds: int = 60) -> None:
    """Создаёт историю за последние секунды, чтобы прогноз появился сразу после старта."""
    async with SessionFactory() as session:
        telemetry = container.build_telemetry_service(session)
        wells = await WellRepository(session).drilling_ids()
        end = utcnow()
        for i in range(seconds, 0, -1):
            ts = end - timedelta(seconds=i)
            await telemetry.ingest([(w, controller.sample(w, ts.timestamp())) for w in wells], ts)


async def simulation_loop(controller: SimulationController) -> None:
    """Каждую секунду: отсчёт телеметрии; каждые N тиков: прогноз по окну телеметрии."""
    tick = 0
    while True:
        started = time.monotonic()
        try:
            async with SessionFactory() as session:
                now = utcnow()
                telemetry = container.build_telemetry_service(session)
                wells = await WellRepository(session).drilling_ids()
                await telemetry.ingest([(w, controller.sample(w, now.timestamp())) for w in wells], now)
                if tick % settings.predict_every_ticks == 0:
                    risk = container.build_risk_service(session, get_predictor())
                    for well_id in wells:
                        await risk.recalculate(well_id)
                if tick % 300 == 0:
                    await telemetry.purge(settings.telemetry_retention_hours)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Ошибка цикла имитации и прогноза")
        tick += 1
        await asyncio.sleep(max(0.0, settings.tick_seconds - (time.monotonic() - started)))