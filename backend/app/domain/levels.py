from app.domain.enums import Level

DEFAULT_THRESHOLDS: tuple[float, float] = (40.0, 70.0)   # (жёлтый, красный)
SEVERITY = {Level.green: 0, Level.yellow: 1, Level.red: 2}


def level_for(index: float, yellow: float, red: float) -> Level:
    if index >= red:
        return Level.red
    if index >= yellow:
        return Level.yellow
    return Level.green