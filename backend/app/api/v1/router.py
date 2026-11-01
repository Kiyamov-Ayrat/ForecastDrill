# app/api/v1/router.py
from fastapi import APIRouter
from app.api.v1 import alerts, auth, thresholds, wells

api_router = APIRouter()
for module in (auth, wells, alerts, thresholds):
    api_router.include_router(module.router)