import enum


class Role(str, enum.Enum):
    operator = "operator"
    supervisor = "supervisor"
    ml_engineer = "ml_engineer"
    director = "director"
    admin = "admin"


class Complication(str, enum.Enum):
    sticking = "sticking"   # прихват
    kick = "kick"           # флюидопроявление
    loss = "loss"           # поглощение


class Level(str, enum.Enum):
    green = "green"
    yellow = "yellow"
    red = "red"


class AlertStatus(str, enum.Enum):
    active = "active"
    confirmed = "confirmed"
    false_alarm = "false_alarm"
    closed = "closed"


class Verdict(str, enum.Enum):
    confirmed = "confirmed"
    false_alarm = "false_alarm"


class WellStatus(str, enum.Enum):
    drilling = "drilling"
    finished = "finished"
    paused = "paused"


class QualityFlag(str, enum.Enum):
    ok = "ok"
    suspect = "suspect"
    bad = "bad"


class ModelStatus(str, enum.Enum):
    trained = "trained"
    active = "active"
    archived = "archived"
    rejected = "rejected"