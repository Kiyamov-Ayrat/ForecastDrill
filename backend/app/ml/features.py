from dataclasses import dataclass


@dataclass
class TelemetryWindow:
    """Последние секунды телеметрии: код канала → значения (от старых к новым)."""
    series: dict[str, list[float]]

    @property
    def length(self) -> int:
        return min((len(v) for v in self.series.values()), default=0)