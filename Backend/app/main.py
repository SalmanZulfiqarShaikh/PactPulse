import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from Backend.app.config import settings
from Backend.app.database import initialize_database
from Backend.app.rate_limit import limiter
from Backend.app.routes.analysis import router as analysis_router
from Backend.app.routes.auth import router as auth_router
from Backend.app.routes.contract import router as contract_router

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Make sure the upload directory exists and the indexes are in place before
    # the first request is served.
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    initialize_database()
    yield


app = FastAPI(
    title="Pact Pulse - Legal AI",
    description="An AI powered contract analysis application with per-user accounts.",
    version="2.0.0",
    lifespan=lifespan,
)

# Rate limiting state and middleware. The limiter instance is shared with the
# auth routes through Backend.app.rate_limit.
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return the same {detail: ...} shape as every other error."""
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Too many attempts. Please wait a minute and try again."},
    )


app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

# Explicit origins, never a wildcard: allow_credentials is required so the
# browser will store and return the refresh cookie, and a browser rejects a
# wildcard origin in that mode. The default is the Vite dev server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(contract_router)
app.include_router(analysis_router)


@app.get("/")
async def root():
    """Index of endpoints. The only route that requires no token."""
    return {
        "message": "Welcome to Pact Pulse - Legal AI.",
        "endpoints": {
            "POST /auth/register": "Create an account. Returns an access token.",
            "POST /auth/login": "Exchange email and password for an access token.",
            "POST /auth/refresh": "Get a new access token using the refresh cookie.",
            "POST /auth/logout": "Clear the refresh cookie.",
            "GET /auth/me": "Return the signed-in account.",
            "POST /contracts/upload": "Upload a contract and extract its text.",
            "GET /contracts": "List your contracts. Supports search, status, limit and skip.",
            "GET /contracts/{contract_id}": "Get one contract with its full text.",
            "GET /contracts/{contract_id}/summary": "Get metadata and a text preview.",
            "DELETE /contracts/{contract_id}": "Delete a contract, its analysis and its file.",
            "POST /analysis/analyze/{contract_id}": "Start an analysis; returns 202 immediately.",
            "GET /analysis/{contract_id}/insights": "Poll for the analysis status and report.",
            "GET /docs": "Interactive API documentation (Swagger UI).",
        },
        "authentication": (
            "Every endpoint above except this one requires "
            "'Authorization: Bearer <access token>' from /auth/login."
        ),
    }


logger.info("Pact Pulse API ready. CORS origins: %s", settings.cors_origin_list)
