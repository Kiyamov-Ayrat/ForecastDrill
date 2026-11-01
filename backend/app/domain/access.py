from __future__ import annotations
from typing import TYPE_CHECKING
from uuid import UUID
from app.domain.enums import Role

if TYPE_CHECKING:
    from app.models.entities import User

PRIVILEGED = {Role.admin, Role.ml_engineer, Role.director}   # видят все скважины


def can_access_well(user: "User", well_id: UUID) -> bool:
    return user.role in PRIVILEGED or any(w.id == well_id for w in user.wells)