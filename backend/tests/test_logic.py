import asyncio
from types import SimpleNamespace
from uuid import uuid4
import pytest
from pydantic import ValidationError
from app.core.exceptions import Conflict
from app.domain.enums import Complication, Level, Role, Verdict
from app.domain.levels import level_for
from app.schemas.threshold import ThresholdItem
from app.services.alert_service import AlertService


def test_levels():
    assert level_for(10, 40, 70) is Level.green
    assert level_for(45, 40, 70) is Level.yellow
    assert level_for(70, 40, 70) is Level.red


def test_threshold_order():
    with pytest.raises(ValidationError):
        ThresholdItem(type=Complication.loss, yellow=80, red=60)


class FakeAlerts:                         # подмена репозитория (DIP)
    def __init__(self, alert): self.alert = alert
    async def get(self, id_): return self.alert
    async def add_feedback(self, alert, fb):
        alert.feedbacks.append(fb)
        return fb


class FakeAudit:
    async def log(self, *args): pass


def test_double_feedback_is_rejected():
    well_id = uuid4()
    alert = SimpleNamespace(id=uuid4(), prediction=SimpleNamespace(well_id=well_id), feedbacks=[])
    user = SimpleNamespace(id=uuid4(), role=Role.supervisor, wells=[SimpleNamespace(id=well_id)])
    svc = AlertService(FakeAlerts(alert), FakeAudit())

    async def run():
        await svc.give_feedback(user, alert.id, Verdict.confirmed, None)
        with pytest.raises(Conflict):
            await svc.give_feedback(user, alert.id, Verdict.false_alarm, None)

    asyncio.run(run())