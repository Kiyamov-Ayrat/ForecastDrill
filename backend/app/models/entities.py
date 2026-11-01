import uuid
from datetime import datetime
from sqlalchemy import (JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer,
                        String, Table, Text, Uuid)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.core.utils import utcnow
from app.domain.enums import (AlertStatus, Complication, Level, ModelStatus, QualityFlag,
                              Role, Verdict, WellStatus)


def _enum(e):
    return SAEnum(e, native_enum=False, length=20)   # без нативных enum PostgreSQL (KISS)


user_wells = Table(
    "user_wells", Base.metadata,
    Column("user_id", Uuid, ForeignKey("users.id"), primary_key=True),
    Column("well_id", Uuid, ForeignKey("wells.id"), primary_key=True))


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    login: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(_enum(Role))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    wells: Mapped[list["Well"]] = relationship(secondary=user_wells, lazy="selectin")

    @property
    def well_ids(self) -> list[uuid.UUID]:
        return [w.id for w in self.wells]


class Well(Base):
    __tablename__ = "wells"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    field: Mapped[str] = mapped_column(String(64))
    status: Mapped[WellStatus] = mapped_column(_enum(WellStatus), default=WellStatus.drilling)


class WellPassport(Base):
    __tablename__ = "well_passports"
    well_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("wells.id"), primary_key=True)
    casing_design: Mapped[dict | None] = mapped_column(JSON)
    planned_trajectory: Mapped[dict | None] = mapped_column(JSON)
    formations: Mapped[dict | None] = mapped_column(JSON)
    mud_program: Mapped[dict | None] = mapped_column(JSON)


class Threshold(Base):
    __tablename__ = "thresholds"
    well_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("wells.id"), primary_key=True)
    type: Mapped[Complication] = mapped_column(_enum(Complication), primary_key=True)
    yellow: Mapped[float] = mapped_column(Float, default=40)
    red: Mapped[float] = mapped_column(Float, default=70)


class Channel(Base):
    __tablename__ = "channels"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    unit: Mapped[str] = mapped_column(String(16))


class TelemetryRecord(Base):   # составной ключ включает ts: так требует hypertable
    __tablename__ = "telemetry_records"
    well_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("wells.id"), primary_key=True)
    channel_id: Mapped[int] = mapped_column(ForeignKey("channels.id"), primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    value: Mapped[float] = mapped_column(Float)
    quality_flag: Mapped[QualityFlag] = mapped_column(_enum(QualityFlag), default=QualityFlag.ok)


class ModelVersion(Base):
    __tablename__ = "model_versions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    complication_type: Mapped[Complication] = mapped_column(_enum(Complication))
    version: Mapped[str] = mapped_column(String(32))
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[ModelStatus] = mapped_column(_enum(ModelStatus), default=ModelStatus.trained)


class Prediction(Base):
    __tablename__ = "predictions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    well_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("wells.id"), index=True)
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("model_versions.id"))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    probability: Mapped[float] = mapped_column(Float)
    risk_index: Mapped[int] = mapped_column(Integer)
    explanation: Mapped[dict] = mapped_column(JSON, default=dict)
    version: Mapped[ModelVersion] = relationship(lazy="joined")


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    prediction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("predictions.id"))
    level: Mapped[Level] = mapped_column(_enum(Level))
    status: Mapped[AlertStatus] = mapped_column(_enum(AlertStatus), default=AlertStatus.active)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_note: Mapped[str | None] = mapped_column(Text)
    prediction: Mapped[Prediction] = relationship(lazy="joined")
    feedbacks: Mapped[list["AlertFeedback"]] = relationship(
        lazy="selectin", order_by="AlertFeedback.created_at")


class AlertFeedback(Base):
    __tablename__ = "alert_feedbacks"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    alert_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("alerts.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    verdict: Mapped[Verdict] = mapped_column(_enum(Verdict))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(128))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DataSource(Base):          # UC-10
    __tablename__ = "data_sources"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    well_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("wells.id"))
    protocol: Mapped[str] = mapped_column(String(16))
    host: Mapped[str] = mapped_column(String(253))
    port: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16), default="unchecked")
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ReportFile(Base):          # UC-9
    __tablename__ = "report_files"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text)
    storage_path: Mapped[str] = mapped_column(String(500))
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class QualityComment(Base):      # UC-7
    __tablename__ = "quality_comments"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    well_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("wells.id"))
    channel_id: Mapped[int] = mapped_column(ForeignKey("channels.id"))
    record_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)