from dataclasses import dataclass
from app.domain.enums import Complication


@dataclass
class Episode:
    type: Complication
    start: float                 # секунды (epoch)
    precursor: float
    event: float
    recovery: float
    aborted_at: float | None = None
    s_abort: float = 0.0

    def severity(self, t: float) -> float:
        """Тяжесть осложнения 0..1: нарастание → пик → спад."""
        if self.aborted_at is not None:
            return max(0.0, self.s_abort * (1.0 - (t - self.aborted_at) / self.recovery))
        x = t - self.start
        if x < 0:
            return 0.0
        if x < self.precursor:
            return x / self.precursor
        x -= self.precursor
        if x < self.event:
            return 1.0
        x -= self.event
        return max(0.0, 1.0 - x / self.recovery)

    def phase(self, t: float) -> str:
        if self.aborted_at is not None:
            return "recovery"
        x = t - self.start
        if x < self.precursor:
            return "precursor"
        return "event" if x < self.precursor + self.event else "recovery"

    def abort(self, t: float) -> None:
        """Плавное завершение: тяжесть спадает с текущего значения."""
        if self.aborted_at is None:
            self.s_abort = self.severity(t)
            self.aborted_at = t

    def finished(self, t: float) -> bool:
        if self.aborted_at is not None:
            return t - self.aborted_at >= self.recovery
        return t - self.start >= self.precursor + self.event + self.recovery