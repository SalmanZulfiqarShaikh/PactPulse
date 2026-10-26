"""Application errors.

Services raise these instead of FastAPI's HTTPException, so business logic does
not depend on the web layer. One handler turns them into the usual
``{"detail": "..."}`` response.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

UNEXPECTED_ERROR = "Something went wrong on our side. Please try again in a moment."


class AppError(Exception):
    status_code = 400
    # When set, users see this instead of ``detail``, which then only goes to
    # the server log. For errors whose detail is meant for the developer.
    public_detail: str | None = None

    def __init__(self, detail: str, *, headers: dict[str, str] | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        self.headers = headers


class BadRequestError(AppError):
    status_code = 400


class UnauthorizedError(AppError):
    status_code = 401

    def __init__(self, detail: str = "Please sign in to continue.") -> None:
        super().__init__(detail, headers={"WWW-Authenticate": "Bearer"})


class ForbiddenError(AppError):
    status_code = 403


class NotFoundError(AppError):
    status_code = 404


class ConflictError(AppError):
    status_code = 409


class PayloadTooLargeError(AppError):
    status_code = 413


class TooManyRequestsError(AppError):
    status_code = 429


class ServiceUnavailableError(AppError):
    status_code = 503


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle(request: Request, exc: AppError) -> JSONResponse:
        detail = exc.detail
        if exc.public_detail:
            logger.warning("%s %s: %s", request.method, request.url.path, exc.detail)
            detail = exc.public_detail
        return JSONResponse({"detail": detail}, status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception) -> JSONResponse:
        # Logged with the traceback; the user gets a plain sentence, as JSON,
        # instead of a bare "Internal Server Error".
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse({"detail": UNEXPECTED_ERROR}, status_code=500)
