# app/schemas/auth.py
import re
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.core.security import hash_password
from app.domain.enums import Role


class LoginIn(BaseModel):
    login: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    login: str
    role: Role
    is_active: bool
    well_ids: list[UUID]


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


LOGIN_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")


def _check_login(v: str) -> str:
    if not LOGIN_RE.match(v):
        raise ValueError("Логин: 3–32 символа (латиница, цифры, _ . -)")
    return v


def _check_password(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Пароль не короче 8 символов")
    return v


class UserCreateIn(BaseModel):                                   # UC-13: создание (админ)
    login: str
    password: str
    role: Role
    is_active: bool = True
    well_ids: list[UUID] = []

    _v_login = field_validator("login")(_check_login)
    _v_password = field_validator("password")(_check_password)

    def password_hash(self) -> str:
        return hash_password(self.password)


class UserUpdateIn(BaseModel):                                   # UC-13: изменение (админ)
    login: str | None = None
    password: str | None = None          # пусто — пароль не меняется
    role: Role | None = None
    is_active: bool | None = None
    well_ids: list[UUID] | None = None   # null — назначение скважин не меняется

    @field_validator("login")
    @classmethod
    def _v_login(cls, v):
        return v if v is None else _check_login(v)

    @field_validator("password")
    @classmethod
    def _v_password(cls, v):
        return v if v is None else _check_password(v)

    @model_validator(mode="after")
    def _at_least_one(self):
        if not self.model_dump(exclude_none=True):
            raise ValueError("Укажите хотя бы одно изменяемое поле")
        return self