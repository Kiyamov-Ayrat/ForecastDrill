# app/api/v1/auth.py
from fastapi import APIRouter, Depends
from app.core.config import settings
from app.core.deps import get_auth_service, get_current_user
from app.models.entities import User
from app.schemas.auth import LoginIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["Авторизация"])


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, svc=Depends(get_auth_service)):
    token, user = await svc.login(body.login, body.password)
    return TokenOut(access_token=token, expires_in=settings.access_token_minutes * 60,
                    user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user