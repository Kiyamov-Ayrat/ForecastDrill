"""Управление пользователями из командной строки.

  docker compose exec backend python -m app.cli wells
  docker compose exec backend python -m app.cli list
  docker compose exec backend python -m app.cli create --login ivanov --password 'Str0ng#Pass1' --role supervisor --wells 214-Р,218-Р
  docker compose exec backend python -m app.cli set-password --login ivanov --password 'New#Pass1234'
  docker compose exec backend python -m app.cli set-active --login ivanov --active false
  docker compose exec backend python -m app.cli assign-wells --login ivanov --wells 214-Р
Роли: operator, supervisor, ml_engineer, director, admin
"""
import argparse
import asyncio
import re
import sys

from sqlalchemy import select

from app.core.database import SessionFactory, init_db
from app.core.security import hash_password
from app.domain.enums import Role
from app.models.entities import User, Well


def check_login(login: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_.-]{3,32}", login):
        sys.exit("Логин: 3–32 символа (латиница, цифры, _ . -)")


def check_password(password: str) -> None:
    if len(password) < 8:
        sys.exit("Пароль не короче 8 символов")


async def find_wells(s, names: str | None) -> list[Well]:
    if not names:
        return []
    wanted = [n.strip() for n in names.split(",") if n.strip()]
    found = (await s.scalars(select(Well).where(Well.name.in_(wanted)))).all()
    missing = set(wanted) - {w.name for w in found}
    if missing:
        sys.exit(f"Скважины не найдены: {', '.join(sorted(missing))}. Список: python -m app.cli wells")
    return list(found)


async def get_user(s, login: str) -> User:
    user = await s.scalar(select(User).where(User.login == login))
    if user is None:
        sys.exit("Пользователь не найден")
    return user


async def run(a) -> None:
    await init_db()
    async with SessionFactory() as s:
        if a.cmd == "wells":
            for w in (await s.scalars(select(Well).order_by(Well.name))).all():
                print(w.name, w.field, w.id)
        elif a.cmd == "list":
            for u in (await s.scalars(select(User).order_by(User.login))).all():
                state = "активен" if u.is_active else "отключён"
                print(f"{u.login:16}{u.role.value:13}{state:10}{', '.join(w.name for w in u.wells)}")
        elif a.cmd == "create":
            check_login(a.login); check_password(a.password)
            if await s.scalar(select(User).where(User.login == a.login)):
                sys.exit("Логин уже занят")
            s.add(User(login=a.login, password_hash=hash_password(a.password),
                       role=Role(a.role), wells=await find_wells(s, a.wells)))
            await s.commit(); print("Пользователь создан")
        elif a.cmd == "set-password":
            check_password(a.password)
            user = await get_user(s, a.login)
            user.password_hash = hash_password(a.password)
            user.failed_attempts, user.locked_until = 0, None   # заодно снимаем блокировку
            await s.commit(); print("Пароль изменён")
        elif a.cmd == "set-active":
            user = await get_user(s, a.login)
            user.is_active = a.active.lower() == "true"
            await s.commit(); print("Готово")
        elif a.cmd == "assign-wells":
            user = await get_user(s, a.login)
            user.wells = await find_wells(s, a.wells)
            await s.commit(); print("Скважины назначены")


def parse():
    p = argparse.ArgumentParser(description="Управление пользователями")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("wells"); sub.add_parser("list")
    c = sub.add_parser("create")
    c.add_argument("--login", required=True); c.add_argument("--password", required=True)
    c.add_argument("--role", required=True, choices=[r.value for r in Role]); c.add_argument("--wells")
    sp = sub.add_parser("set-password")
    sp.add_argument("--login", required=True); sp.add_argument("--password", required=True)
    sa = sub.add_parser("set-active")
    sa.add_argument("--login", required=True); sa.add_argument("--active", required=True, choices=["true", "false"])
    aw = sub.add_parser("assign-wells")
    aw.add_argument("--login", required=True); aw.add_argument("--wells", required=True)
    return p.parse_args()


if __name__ == "__main__":
    asyncio.run(run(parse()))