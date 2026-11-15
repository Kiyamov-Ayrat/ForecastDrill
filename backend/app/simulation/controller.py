import random
from dataclasses import dataclass, field
from uuid import UUID
from app.domain.channels import CHANNELS, SIGNATURES
from app.domain.enums import Complication, SimulationMode
from app.simulation.profiles import MANUAL_DURATIONS, PROFILES
from app.simulation.scenario import Episode


@dataclass
class WellSim:
    wander: dict[str, float] = field(default_factory=dict)    # медленный «дрейф» датчиков
    episode: Episode | None = None
    next_start: float | None = None


class SimulationController:
    """Генератор телеметрии: режим, расписание эпизодов, отсчёты каналов."""

    def __init__(self, mode: SimulationMode, seed: int | None = None):
        self.mode = mode
        self.rng = random.Random(seed)
        self.wells: dict[UUID, WellSim] = {}

    @property
    def profile(self):
        return PROFILES[self.mode]

    def _schedule(self, ws: WellSim, now: float, initial: bool = False) -> None:
        p = self.profile
        if not p.auto:
            ws.next_start = None
            return
        gap = self.rng.expovariate(1.0 / p.mean_gap_s) * (0.5 if initial else 1.0)
        ws.next_start = now + max(10.0, gap)

    def _well(self, well_id: UUID, now: float) -> WellSim:
        ws = self.wells.get(well_id)
        if ws is None:
            ws = self.wells[well_id] = WellSim()
            self._schedule(ws, now, initial=True)
        return ws

    def _advance(self, ws: WellSim, now: float) -> None:
        if ws.episode and ws.episode.finished(now):
            ws.episode = None
            self._schedule(ws, now)
        if ws.episode is None and ws.next_start is not None and now >= ws.next_start:
            p = self.profile
            c = self.rng.choices(list(p.weights), weights=list(p.weights.values()))[0]
            ws.episode = Episode(c, now, p.precursor_s, p.event_s, p.recovery_s)
            ws.next_start = None

    def sample(self, well_id: UUID, now: float) -> dict[str, float]:
        """Один отсчёт всех каналов скважины на момент now (секунды epoch)."""
        ws = self._well(well_id, now)
        self._advance(ws, now)
        severity = {c: 0.0 for c in Complication}
        if ws.episode:
            severity[ws.episode.type] = ws.episode.severity(now)
        out = {}
        for ch in CHANNELS:
            ws.wander[ch.code] = 0.98 * ws.wander.get(ch.code, 0.0) + self.rng.gauss(0, 0.03 * ch.scale)
            drift = sum(severity[c] * SIGNATURES[c].get(ch.code, 0.0) for c in Complication) * ch.scale
            out[ch.code] = ch.nominal + ws.wander[ch.code] + drift + self.rng.gauss(0, 0.25 * ch.scale)
        return out

    def set_mode(self, mode: SimulationMode, now: float) -> None:
        self.mode = mode
        for ws in self.wells.values():
            if mode is SimulationMode.none and ws.episode:
                ws.episode.abort(now)                   # текущий эпизод плавно затухает
            self._schedule(ws, now)

    def trigger(self, well_id: UUID, c: Complication, now: float) -> None:
        ws = self._well(well_id, now)
        p = self.profile
        pre, ev, rec = (p.precursor_s, p.event_s, p.recovery_s) if p.auto else MANUAL_DURATIONS
        ws.episode = Episode(c, now, pre, ev, rec)

    def stop(self, well_id: UUID | None, now: float) -> None:
        for wid, ws in self.wells.items():
            if (well_id is None or wid == well_id) and ws.episode:
                ws.episode.abort(now)

    def status(self, now: float) -> list[dict]:
        return [{"well_id": wid, "type": ws.episode.type, "phase": ws.episode.phase(now),
                 "severity": round(ws.episode.severity(now), 2)}
                for wid, ws in self.wells.items() if ws.episode]