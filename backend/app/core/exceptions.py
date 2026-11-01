from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class Unauthorized(AppError): status_code, code = 401, "unauthorized"
class Forbidden(AppError): status_code, code = 403, "forbidden"
class NotFound(AppError): status_code, code = 404, "not_found"
class Conflict(AppError): status_code, code = 409, "conflict"
class TooManyRequests(AppError): status_code, code = 429, "too_many_requests"


def _body(code: str, message: str, details: list | None = None) -> dict:
    error = {"code": code, "message": message}
    if details:
        error["details"] = details
    return {"error": error}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def on_app_error(_: Request, exc: AppError):
        return JSONResponse(_body(exc.code, exc.message), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def on_validation_error(_: Request, exc: RequestValidationError):
        details = [{"field": ".".join(str(x) for x in e["loc"][1:]), "message": e["msg"]}
                   for e in exc.errors()]
        return JSONResponse(
            _body("validation_error", "Обязательные поля не указаны или недействительны", details),
            status_code=400)