# app/schemas/auth.py
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
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