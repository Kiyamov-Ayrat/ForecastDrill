from sqlalchemy.ext.asyncio import AsyncSession
from app.ml.base import RiskPredictor
from app.repositories.impl import (AlertRepository, AuditRepository, PredictionRepository,
                                   ThresholdRepository, UserRepository, WellRepository)
from app.services.alert_service import AlertService
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService
from app.services.risk_service import RiskService
from app.services.threshold_service import ThresholdService
from app.services.well_service import WellService


def build_audit(s: AsyncSession) -> AuditService:
    return AuditService(AuditRepository(s))


def build_auth_service(s: AsyncSession) -> AuthService:
    return AuthService(UserRepository(s), build_audit(s), WellRepository(s))


def build_risk_service(s: AsyncSession, predictor: RiskPredictor) -> RiskService:
    return RiskService(PredictionRepository(s), ThresholdRepository(s), AlertRepository(s), predictor)


def build_well_service(s: AsyncSession, predictor: RiskPredictor) -> WellService:
    return WellService(WellRepository(s), build_risk_service(s, predictor))


def build_alert_service(s: AsyncSession) -> AlertService:
    return AlertService(AlertRepository(s), build_audit(s))


def build_threshold_service(s: AsyncSession) -> ThresholdService:
    return ThresholdService(ThresholdRepository(s), build_audit(s))