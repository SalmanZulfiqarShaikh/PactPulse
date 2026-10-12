"""FastAPI dependencies for authentication and the refresh cookie."""

import logging
from dataclasses import dataclass

from fastapi import HTTPException, Request, Response, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from Backend.app.auth.security import (
    ACCESS_TOKEN_TYPE,
    REFRESH_TOKEN_TYPE,
    TokenError,
    decode_token,
)
from Backend.app.config import settings

logger = logging.getLogger(__name__)

# auto_error=False so a missing header raises our own 401 with a consistent
# body, rather than FastAPI's default 403.
_bearer_scheme = HTTPBearer(auto_error=False, description="Access token from /auth/login")

# One message for every authentication failure. Distinguishing "no token" from
# "expired token" or "wrong user" tells a prober which of those they achieved.
_UNAUTHENTICATED = "Not authenticated."


@dataclass(frozen=True)
class CurrentUser:
    """The authenticated caller, as resolved from the access token."""

    user_id: str
    email: str
    # Session generation carried by a refresh token. Only /auth/refresh uses it;
    # an access token does not carry one, so it stays 0 there.
    token_version: int = 0


def _unauthorised(detail: str = _UNAUTHENTICATED) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer_scheme),
) -> CurrentUser:
    """Resolve the caller from ``Authorization: Bearer <access token>``.

    Every contract and analysis route depends on this. It deliberately trusts
    only the signed token: the user is not looked up in the database here, so
    this stays a pure signature check on the hot path. A user deleted after a
    token was issued keeps access until that token expires, which is bounded by
    the short access lifetime.
    """
    if credentials is None or not credentials.credentials:
        raise _unauthorised()

    try:
        claims = decode_token(credentials.credentials, expected_type=ACCESS_TOKEN_TYPE)
    except TokenError as exc:
        # The reason is logged for the operator but never returned to the
        # caller, who only learns that they are not authenticated.
        logger.debug("Rejected access token: %s", exc)
        raise _unauthorised() from None

    user_id = claims["sub"]
    if not user_id:
        raise _unauthorised()

    return CurrentUser(user_id=user_id, email=claims.get("email") or "")


def get_refresh_user(request: Request) -> CurrentUser:
    """Resolve the caller from the httpOnly refresh cookie, or 401.

    The token type is checked, so an access token copied into the cookie cannot
    be used to mint more tokens. The token's session generation is passed
    through for the caller to compare against the account; that check needs a
    database read, which is left to /auth/refresh so this stays a pure signature
    check like get_current_user.
    """
    token = request.cookies.get(settings.refresh_cookie_name)

    if not token:
        raise _unauthorised("No refresh token.")

    try:
        claims = decode_token(token, expected_type=REFRESH_TOKEN_TYPE)
    except TokenError as exc:
        logger.debug("Rejected refresh token: %s", exc)
        raise _unauthorised("Refresh token is invalid or has expired.") from None

    return CurrentUser(
        user_id=claims["sub"],
        email=claims.get("email") or "",
        # A token minted before session generations existed has no "ver" claim.
        # Treating that as 0 matches the default stored on the account, so those
        # cookies keep working rather than signing everyone out on deploy.
        token_version=int(claims.get("ver", 0)),
    )


def set_refresh_cookie(response: Response, token: str) -> None:
    """Attach the refresh token as an httpOnly cookie.

    httpOnly keeps it away from JavaScript, so an XSS bug cannot read it. The
    path is narrowed to /auth so the cookie is not attached to ordinary API
    calls, and SameSite=lax means a cross-site request will not carry it.
    """
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=token,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite="lax",
        path=settings.refresh_cookie_path,
    )


def clear_refresh_cookie(response: Response) -> None:
    """Expire the refresh cookie. The path must match the one it was set with."""
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite="lax",
        path=settings.refresh_cookie_path,
    )
