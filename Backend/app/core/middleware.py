"""Request body size limit.

Starlette parses a multipart upload completely (spooling it to a temporary file)
before the route runs, so a size check inside the route comes too late to stop a
2 GB upload from being received. This middleware rejects an oversized body at
the door: immediately from Content-Length when the client sends one, and while
streaming when it does not.
"""

from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Multipart framing (boundaries, part headers) on top of the file itself.
_ENVELOPE_BYTES = 64 * 1024


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, *, max_bytes: int, paths: tuple[str, ...]) -> None:
        self.app = app
        self.limit = max_bytes + _ENVELOPE_BYTES
        self.paths = paths
        self.detail = f"File exceeds the maximum size of {max_bytes // (1024 * 1024)} MB."

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope["path"].startswith(self.paths):
            await self.app(scope, receive, send)
            return

        declared = dict(scope.get("headers") or []).get(b"content-length", b"")
        if declared.isdigit() and int(declared) > self.limit:
            await JSONResponse({"detail": self.detail}, status_code=413)(scope, receive, send)
            return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            received += len(message.get("body", b""))
            if received > self.limit:
                # FastAPI re-raises HTTPException from body parsing, so this
                # becomes a clean 413 instead of a generic "could not parse".
                raise HTTPException(status_code=413, detail=self.detail)
            return message

        await self.app(scope, limited_receive, send)
