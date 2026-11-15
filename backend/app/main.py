# app/main.py
import asyncio
from contextlib import asynccontextmanager, suppress
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import SessionFactory, engine, init_db
from app.core.exceptions import register_exception_handlers
from app.seed import seed
from app.core import container
from app.scheduler import simulation_loop, warm_up
from app.simulation import get_controller


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    if settings.seed_demo_data:
        async with SessionFactory() as session:
            await seed(session)
    async with SessionFactory() as session:
        await container.build_telemetry_service(session).ensure_channels()
    controller = get_controller()
    await warm_up(controller)
    task = asyncio.create_task(simulation_loop(controller))
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task
    await engine.dispose()

app = FastAPI(title="БурПрогноз API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                   allow_methods=["*"], allow_headers=["*"])
register_exception_handlers(app)
app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["Служебное"])
async def health():
    return {"status": "ok"}