"""Serving the built React app from the API server, for a one-service deploy.

Any GET that no API route handles gets index.html, so client-side routes like
/app/contracts/123 work on a hard refresh. Real files (JS, CSS, images) are
served as they are. Locally, with no built frontend, nothing is mounted and
Vite serves the app instead.
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# API prefixes: an unknown path under these is a real 404, never the app shell.
_API_PREFIXES = ("auth/", "contracts", "analysis/", "health", "docs", "redoc", "openapi.json")


def mount_frontend(app: FastAPI, dist: Path) -> None:
    index = dist / "index.html"
    if not index.is_file():
        return

    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    root = dist.resolve()

    # A plain def: FastAPI runs it in a worker thread, so the file checks
    # don't block the event loop.
    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path.startswith(_API_PREFIXES):
            raise HTTPException(status_code=404, detail="Not found.")
        candidate = (root / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(root):
            return FileResponse(candidate)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
