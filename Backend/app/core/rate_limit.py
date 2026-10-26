"""Per-IP rate limits for the endpoints worth abusing: login, register, codes and chat.

Counts live in process memory, so they reset on restart and are not shared
between workers. Swap in a Redis storage_uri if this ever runs multi-worker.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from Backend.app.core.client_ip import client_ip
from Backend.app.core.config import settings

limiter = Limiter(
    key_func=client_ip,
    enabled=settings.http.rate_limit_enabled,
    headers_enabled=True,
)


def install_rate_limiting(app: FastAPI) -> None:
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def _too_many(_: Request, __: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            {"detail": "Too many requests. Please wait a minute and try again."}, status_code=429
        )
