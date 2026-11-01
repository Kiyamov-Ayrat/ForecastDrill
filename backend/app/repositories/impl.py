from typing import Sequence
from uuid import UUID
from sqlalchemy import select
from app.domain.enums import AlertStatus, Complication, ModelStatus, WellStatus
from app.domain.levels import DEFAULT_THRESHOLDS
from app.models.entities import (Alert, AlertFeedback, AuditLog, ModelVersion, Prediction,
                                 Threshold, User, Well)
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_login(self, login: str) -> User | None:
        return await self.session.scalar(select(User).where(User.login == login))


class WellRepository(BaseRepository[Well]):
    model = Well

    async def all(self) -> Sequence[Well]:
        return (await self.session.scalars(select(Well).order_by(Well.name))).all()

    async def drilling_ids(self) -> Sequence[UUID]:
        stmt = select(Well.id).where(Well.status == WellStatus.drilling)
        return (await self.session.scalars(stmt)).all()


class ThresholdRepository(BaseRepository[Threshold]):
    model = Threshold

    async def as_map(self, well_id: UUID) -> dict[Complication, tuple[float, float]]:
        rows = (await self.session.scalars(
            select(Threshold).where(Threshold.well_id == well_id))).all()
        result = {c: DEFAULT_THRESHOLDS for c in Complication}
        result.update({r.type: (r.yellow, r.red) for r in rows})
        return result

    async def upsert_many(self, items: Sequence[Threshold]) -> None:
        for item in items:
            await self.session.merge(item)
        await self.session.commit()


class PredictionRepository(BaseRepository[Prediction]):
    model = Prediction

    async def active_version(self, c: Complication) -> ModelVersion | None:
        stmt = select(ModelVersion).where(ModelVersion.complication_type == c,
                                          ModelVersion.status == ModelStatus.active).limit(1)
        return await self.session.scalar(stmt)

    async def latest_per_type(self, well_id: UUID) -> dict[Complication, Prediction]:
        stmt = (select(Prediction).where(Prediction.well_id == well_id)
                .order_by(Prediction.ts.desc()).limit(30))
        latest: dict[Complication, Prediction] = {}
        for p in (await self.session.scalars(stmt)).unique().all():
            latest.setdefault(p.version.complication_type, p)
        return latest

    async def history(self, well_id: UUID, since) -> Sequence[Prediction]:
        stmt = (select(Prediction).where(Prediction.well_id == well_id, Prediction.ts >= since)
                .order_by(Prediction.ts))
        return (await self.session.scalars(stmt)).unique().all()


class AlertRepository(BaseRepository[Alert]):
    model = Alert

    def _base(self):
        return select(Alert).join(Alert.prediction).join(Prediction.version)

    async def find(self, well_ids, c, status, limit) -> Sequence[Alert]:
        stmt = self._base()
        if well_ids is not None:
            stmt = stmt.where(Prediction.well_id.in_(well_ids))
        if c is not None:
            stmt = stmt.where(ModelVersion.complication_type == c)
        if status is not None:
            stmt = stmt.where(Alert.status == status)
        stmt = stmt.order_by(Alert.created_at.desc()).limit(limit)
        return (await self.session.scalars(stmt)).unique().all()

    async def open_for(self, well_id: UUID, c: Complication) -> Sequence[Alert]:
        stmt = self._base().where(Prediction.well_id == well_id,
                                  ModelVersion.complication_type == c,
                                  Alert.closed_at.is_(None))
        return (await self.session.scalars(stmt)).unique().all()

    async def close(self, alerts, ts) -> None:
        if not alerts:
            return
        for a in alerts:
            a.closed_at = ts
            if a.status is AlertStatus.active:
                a.status = AlertStatus.closed
        await self.session.commit()

    async def add_feedback(self, alert: Alert, fb: AlertFeedback) -> AlertFeedback:
        alert.status = AlertStatus(fb.verdict.value)       # статус и отметка сохраняются вместе
        self.session.add(fb)
        await self.session.commit()
        await self.session.refresh(fb)
        return fb


class AuditRepository(BaseRepository[AuditLog]):
    model = AuditLog