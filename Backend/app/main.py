"""Application entry point: ``uvicorn Backend.app.main:app`` from the repo root."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from Backend.app import __version__
from Backend.app.api.frontend import mount_frontend
from Backend.app.api.routes import routers
from Backend.app.core.config import settings
from Backend.app.core.errors import register_error_handlers
from Backend.app.core.middleware import BodySizeLimitMiddleware
from Backend.app.core.rate_limit import install_rate_limiting
from Backend.app.db import close_mongo, connect_mongo
from Backend.app.services.rag import vector_store

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.validate()
    settings.upload.upload_dir.mkdir(parents=True, exist_ok=True)
    await connect_mongo()
    yield
    await vector_store.close()
    await close_mongo()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Pact Pulse - Legal AI",
        description="Contract analysis and document chat, with per-user accounts.",
        version=__version__,
        lifespan=lifespan,
    )
    register_error_handlers(app)
    install_rate_limiting(app)
    app.add_middleware(
        BodySizeLimitMiddleware,
        max_bytes=settings.upload.max_file_size,
        paths=("/contracts/upload",),
    )
    # Explicit origins, never "*": the refresh cookie needs allow_credentials.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.http.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for router in routers:
        app.include_router(router)

    @app.get("/health", tags=["meta"])
    async def health() -> dict:
        """Health check. The only open endpoint."""
        return {"status": "ok", "version": __version__}

    # In production the built frontend is served from here too (one service,
    # one origin). Registered last, so every API route takes priority.
    mount_frontend(app, settings.http.frontend_dist)
    return app


app = create_app()
