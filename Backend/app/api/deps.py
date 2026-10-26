"""Shared route dependencies."""

from typing import Annotated

from fastapi import Depends, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from Backend.app.core import security
from Backend.app.core.config import settings
from Backend.app.core.errors import UnauthorizedError

_bearer = HTTPBearer(auto_error=False, description="Access token from /auth/login")


async def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> security.TokenClaims:
    """The caller, from ``Authorization: Bearer <access token>``.

    A pure signature check, no database read. Every failure gives the same
    message so a prober cannot tell "expired" from "forged".
    """
    if credentials is None or not credentials.credentials:
        raise UnauthorizedError()
    try:
        return security.decode_token(credentials.credentials, security.TokenType.ACCESS)
    except security.TokenError:
        raise UnauthorizedError() from None


CurrentUser = Annotated[security.TokenClaims, Depends(current_user)]


def set_refresh_cookie(response: Response, token: str) -> None:
    """httpOnly (no JavaScript access), scoped to /auth, SameSite=Lax."""
    cfg = settings.auth
    response.set_cookie(
        key=cfg.refresh_cookie_name,
        value=token,
        max_age=cfg.refresh_token_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path=cfg.refresh_cookie_path,
    )


def clear_refresh_cookie(response: Response) -> None:
    cfg = settings.auth
    response.delete_cookie(
        key=cfg.refresh_cookie_name,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path=cfg.refresh_cookie_path,
    )
