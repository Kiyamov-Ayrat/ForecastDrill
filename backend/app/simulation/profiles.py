from dataclasses import dataclass, field
from app.domain.enums import Complication, SimulationMode

DEFAULT_WEIGHTS = {Complication.loss: 0.4, Complication.kick: 0.3, Complication.sticking: 0.3}
MANUAL_DURATIONS = (90.0, 45.0, 60.0)       # нарастание, пик, спад (с) при ручном запуске


@dataclass(frozen=True)
class Profile:
    title: str
    description: str
    auto: bool
    mean_gap_s: float = 0.0
    precursor_s: float = 90.0
    event_s: float = 45.0
    recovery_s: float = 60.0
    weights: dict = field(default_factory=lambda: dict(DEFAULT_WEIGHTS))


PROFILES = {
    SimulationMode.none: Profile("Без осложнений", "Норма: только шум датчиков, осложнений нет", False),
    SimulationMode.rare: Profile("Редкие осложнения",
                                 "В среднем одно осложнение на скважину раз в ~10 минут", True, 600, 90, 45, 60),
    SimulationMode.frequent: Profile("Частые осложнения",
                                     "В среднем одно осложнение на скважину каждую минуту-две", True, 60, 45, 25, 35),
    SimulationMode.manual: Profile("Ручной запуск",
                                   "Осложнения только по команде (панель или POST /simulation/trigger)", False),
}