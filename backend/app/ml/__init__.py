# app/ml/__init__.py
from functools import lru_cache
from app.ml.base import RiskPredictor
from app.ml.simulated import SimulatedPredictor


@lru_cache
def get_predictor() -> RiskPredictor:      # единый экземпляр на всё приложение
    return SimulatedPredictor()