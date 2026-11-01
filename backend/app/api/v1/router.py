# app/api/v1/router.py
from fastapi import APIRouter
from app.api.v1 import alerts, auth, thresholds, users, wells

api_router = APIRouter()
for module in (auth, users, wells, alerts, thresholds):
    api_router.include_router(module.router)