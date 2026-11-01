# app/seed.py
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import hash_password
from app.domain.enums import Complication, ModelStatus, Role
from app.models.entities import Channel, ModelVersion, User, Well

WELLS = [("214-Р", "Куст 7"), ("218-Р", "Куст 7"), ("305-Н", "Куст 3"),
         ("112-С", "Куст 1"), ("407-Н", "Куст 4"), ("509-Р", "Куст 9")]
CHANNELS = [("Нагрузка на крюке", "кН"), ("Момент на роторе", "кН·м"), ("Давление на стояке", "МПа"),
            ("Расход на входе", "л/с"), ("Расход на выходе", "л/с"),
            ("Уровень в ёмкости 1", "м³"), ("Плотность раствора", "г/см³")]


async def seed(s: AsyncSession) -> None:
    if await s.scalar(select(func.count()).select_from(User)):
        return
    wells = [Well(name=n, field=f) for n, f in WELLS]
    s.add_all(wells)
    s.add_all([Channel(name=n, unit=u) for n, u in CHANNELS])
    s.add_all([ModelVersion(complication_type=c, version="sim-1.0", status=ModelStatus.active,
                            metrics={"precision": 0.82, "recall": 0.76,
                                     "false_alarms_per_day": 1.3, "lead_time_min": 18})
               for c in Complication])
    await s.flush()
    demo = [("operator1", "Operator#2026", Role.operator, wells[:1], True),
            ("super1", "Super#2026", Role.supervisor, wells[:3], True),
            ("ml1", "MlEng#2026", Role.ml_engineer, [], True),
            ("director1", "Director#2026", Role.director, [], False),
            ("admin1", "Admin#2026", Role.admin, [], True)]
    for login, pw, role, ws, active in demo:
        s.add(User(login=login, password_hash=hash_password(pw), role=role, wells=ws, is_active=active))
    await s.commit()