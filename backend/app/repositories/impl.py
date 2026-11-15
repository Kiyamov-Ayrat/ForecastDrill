from typing import Sequence
from uuid import UUID
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from app.core.exceptions import Conflict
from app.domain.enums import AlertStatus, Complication, ModelStatus, WellStatus
from app.domain.levels import DEFAULT_THRESHOLDS
from app.models.entities import (Alert, AlertFeedback, AuditLog, ModelVersion, Prediction,
                                 QualityComment, ReportFile, Threshold, User, Well, TelemetryRecord, Channel)
from app.repositories.base import BaseRepository
from sqlalchemy import delete, extract, func, literal_column, or_, select, text
from app.domain.enums import QualityFlag

class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_login(self, login: str) -> User | None:
        return await self.session.scalar(select(User).where(User.login == login))

    async def all(self) -> Sequence[User]:
        return (await self.session.scalars(select(User).order_by(User.login))).all()

    async def delete(self, user: User) -> None:
        uid = user.id
        user.wells.clear()
        await self.session.flush()
        for model, column in (
            (AuditLog, AuditLog.user_id),
            (AlertFeedback, AlertFeedback.user_id),
            (ReportFile, ReportFile.uploaded_by),
            (QualityComment, QualityComment.author_id),
        ):
            await self.session.execute(delete(model).where(column == uid))
        await self.session.delete(user)
        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise Conflict("Нельзя удалить пользователя: на него есть ссылки в журналах")
    async def logins(self, ids) -> dict[UUID, str]:
        if not ids:
            return {}
        rows = (await self.session.execute(select(User.id, User.login).where(User.id.in_(list(ids))))).all()
        return {i: login for i, login in rows}


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

    async def find_overlapping(self, well_id: UUID, start, end) -> Sequence[Alert]:
        stmt = (self._base()
                .where(Prediction.well_id == well_id, Alert.created_at <= end,
                       or_(Alert.closed_at.is_(None), Alert.closed_at >= start))
                .order_by(Alert.created_at))
        return (await self.session.scalars(stmt)).unique().all()

class AuditRepository(BaseRepository[AuditLog]):
    model = AuditLog

class TelemetryRepository(BaseRepository[TelemetryRecord]):
    model = TelemetryRecord

    async def channel_map(self) -> dict[str, int]:
        return {c.name: c.id for c in (await self.session.scalars(select(Channel))).all()}

    async def ensure_channels(self, specs) -> None:
        existing = await self.channel_map()
        for s in specs:
            if s.name not in existing:
                self.session.add(Channel(name=s.name, unit=s.unit))
        await self.session.commit()

    async def add_many(self, rows) -> None:
        self.session.add_all(rows)
        await self.session.commit()

    async def window(self, well_id: UUID, since):
        stmt = (select(TelemetryRecord.channel_id, TelemetryRecord.ts,
                       TelemetryRecord.value, TelemetryRecord.quality_flag)
                .where(TelemetryRecord.well_id == well_id, TelemetryRecord.ts >= since)
                .order_by(TelemetryRecord.ts))
        return (await self.session.execute(stmt)).all()


    async def purge_before(self, ts) -> None:
        await self.session.execute(text("""
            DELETE FROM telemetry_records t
            WHERE t.ts < :cutoff
              AND NOT EXISTS (
                SELECT 1 FROM alerts a
                JOIN predictions p ON p.id = a.prediction_id
                JOIN alert_feedbacks f ON f.alert_id = a.id
                WHERE p.well_id = t.well_id
                  AND t.ts BETWEEN a.created_at - interval '10 minutes'
                               AND COALESCE(a.closed_at, a.created_at) + interval '10 minutes')"""),
            {"cutoff": ts})
        await self.session.execute(text("""
            DELETE FROM predictions p
            WHERE p.ts < :cutoff
              AND NOT EXISTS (SELECT 1 FROM alerts a WHERE a.prediction_id = p.id)"""),
            {"cutoff": ts})
        await self.session.commit()

    async def bucketed(self, well_id: UUID, start, end, step: int, channel_ids):
        sec = literal_column(str(int(step)))                     # шаг подставляется в SQL как число
        bucket = func.to_timestamp(func.floor(extract("epoch", TelemetryRecord.ts) / sec) * sec)
        stmt = (select(TelemetryRecord.channel_id, bucket.label("bucket"),
                       func.avg(TelemetryRecord.value).label("value"))
                .where(TelemetryRecord.well_id == well_id, TelemetryRecord.ts >= start,
                       TelemetryRecord.ts < end, TelemetryRecord.channel_id.in_(channel_ids),
                       TelemetryRecord.quality_flag == QualityFlag.ok)
                .group_by(TelemetryRecord.channel_id, bucket).order_by(bucket))
        return (await self.session.execute(stmt)).all()

    async def time_range(self, well_id: UUID):
        row = (await self.session.execute(
            select(func.min(TelemetryRecord.ts), func.max(TelemetryRecord.ts))
            .where(TelemetryRecord.well_id == well_id))).one()
        return row[0], row[1]