from functools import lru_cache
from app.core.config import settings
from app.domain.enums import SimulationMode
from app.simulation.controller import SimulationController


@lru_cache
def get_controller() -> SimulationController:
    try:
        mode = SimulationMode(settings.simulation_mode)
    except ValueError:
        raise SystemExit(f"SIMULATION_MODE должен быть one of: {[m.value for m in SimulationMode]}")
    return SimulationController(mode, settings.simulation_seed)