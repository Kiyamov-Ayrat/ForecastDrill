from sqlalchemy.ext.asyncio import AsyncSession
from app.ml.base import RiskPredictor
from app.repositories.impl import (AlertRepository, AuditRepository, PredictionRepository,
                                   ThresholdRepository, UserRepository, WellRepository, TelemetryRepository)
from app.schemas.quality_service import QualityService
from app.services.alert_service import AlertService
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService
from app.services.risk_service import RiskService
from app.services.telemetry_service import TelemetryService
from app.services.threshold_service import ThresholdService
from app.services.well_service import WellService


def build_audit(s: AsyncSession) -> AuditService:
    return AuditService(AuditRepository(s))


def build_auth_service(s: AsyncSession) -> AuthService:
    return AuthService(UserRepository(s), build_audit(s), WellRepository(s))


def build_risk_service(s: AsyncSession, predictor: RiskPredictor) -> RiskService:
    return RiskService(PredictionRepository(s), ThresholdRepository(s), AlertRepository(s),
                       predictor, build_telemetry_service(s))

def build_well_service(s: AsyncSession, predictor: RiskPredictor) -> WellService:
    return WellService(WellRepository(s), build_risk_service(s, predictor))


def build_alert_service(s: AsyncSession) -> AlertService:
    return AlertService(AlertRepository(s), build_audit(s))


def build_threshold_service(s: AsyncSession) -> ThresholdService:
    return ThresholdService(ThresholdRepository(s), build_audit(s))

def build_telemetry_service(s: AsyncSession) -> TelemetryService:
    return TelemetryService(TelemetryRepository(s))

def build_quality_service(s: AsyncSession) -> QualityService:
    return QualityService(build_telemetry_service(s), AlertRepository(s), UserRepository(s))