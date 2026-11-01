# app/scheduler.py
import asyncio
import logging
from app.core import container
from app.core.config import settings
from app.core.database import SessionFactory
from app.ml import get_predictor
from app.repositories.impl import WellRepository

log = logging.getLogger(__name__)


async def risk_loop() -> None:
    """Каждые N секунд пересчитывает риск по всем скважинам в бурении."""
    while True:
        try:
            async with SessionFactory() as session:
                service = container.build_risk_service(session, get_predictor())
                for well_id in await WellRepository(session).drilling_ids():
                    await service.recalculate(well_id)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Ошибка пересчёта рисков")
        await asyncio.sleep(settings.risk_interval_seconds)