from fastapi import APIRouter
from app.api.v1 import alerts, auth, simulation, thresholds, wells
from app.core.config import settings

api_router = APIRouter()
for module in (auth, wells, alerts, thresholds):
    api_router.include_router(module.router)
if settings.simulation_api_enabled:
    api_router.include_router(simulation.router)