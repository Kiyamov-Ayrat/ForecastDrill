from dataclasses import dataclass
from app.domain.enums import Complication


@dataclass(frozen=True)
class ChannelSpec:
    code: str
    name: str
    unit: str
    nominal: float     # ожидаемое значение в норме (по режиму бурения и паспорту скважины)
    scale: float       # характерное «заметное» изменение; шум датчика = 0.25 × scale


# Названия совпадают с теми, что создаёт seed.py
CHANNELS = (
    ChannelSpec("hookload", "Нагрузка на крюке", "кН", 1500.0, 100.0),
    ChannelSpec("torque", "Момент на роторе", "кН·м", 12.0, 1.5),
    ChannelSpec("spp", "Давление на стояке", "МПа", 18.0, 1.0),
    ChannelSpec("flow_in", "Расход на входе", "л/с", 30.0, 2.0),
    ChannelSpec("flow_out", "Расход на выходе", "л/с", 30.0, 2.0),
    ChannelSpec("pit_level", "Уровень в ёмкости 1", "м³", 45.0, 1.5),
    ChannelSpec("density", "Плотность раствора", "г/см³", 1.25, 0.03),
)
CHANNEL_BY_CODE = {c.code: c for c in CHANNELS}

# Сигнатуры: смещение канала (в единицах scale) при максимальной тяжести осложнения.
# Демонстрационные значения, качественно отражают физику процесса.
SIGNATURES: dict[Complication, dict[str, float]] = {
    Complication.loss: {"flow_out": -3.0, "pit_level": -3.0, "spp": -1.0},
    Complication.kick: {"flow_out": 2.5, "pit_level": 3.0, "spp": -0.8, "density": -1.0},
    Complication.sticking: {"torque": 3.0, "hookload": 2.0, "spp": 1.2},
}