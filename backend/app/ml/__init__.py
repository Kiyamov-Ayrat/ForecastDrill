from functools import lru_cache
from app.core.config import settings
from app.ml.base import RiskPredictor
from app.ml.simulated import SimulatedPredictor
from app.ml.telemetry_predictor import TelemetryRiskPredictor


@lru_cache
def get_predictor() -> RiskPredictor:
    return SimulatedPredictor() if settings.predictor == "random" else TelemetryRiskPredictor()