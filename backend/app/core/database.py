import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

log = logging.getLogger(__name__)
engine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_session():
    async with SessionFactory() as session:
        yield session


async def init_db() -> None:
    from app.models import entities  # noqa: F401  (регистрирует таблицы)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:  # TimescaleDB необязателен: без него телеметрия хранится в обычной таблице
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb"))
            await conn.execute(text(
                "SELECT create_hypertable('telemetry_records', 'ts', if_not_exists => TRUE)"))
    except Exception:
        log.warning("TimescaleDB недоступен, используется обычная таблица")