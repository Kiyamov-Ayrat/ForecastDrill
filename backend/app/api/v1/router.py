from fastapi import APIRouter
from app.core.config import settings
from app.api.v1 import alerts, auth, quality, simulation, thresholds, users, wells

api_router = APIRouter()
for module in (auth, users, wells, alerts, thresholds, quality):
    api_router.include_router(module.router)
if settings.simulation_api_enabled:
    api_router.include_router(simulation.router)