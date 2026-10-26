from typing import Annotated

from fastapi import APIRouter, Cookie, Request, Response, status

from Backend.app.api.deps import CurrentUser, clear_refresh_cookie, set_refresh_cookie
from Backend.app.core.config import settings
from Backend.app.core.errors import UnauthorizedError
from Backend.app.core.rate_limit import limiter
from Backend.app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    ResendRequest,
    TokenResponse,
    UserResponse,
    VerifyRequest,
)
from Backend.app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

# Every rate-limited route takes ``request`` and ``response``: the limiter
# needs the first to identify the caller and writes its headers onto the second.

RefreshCookie = Annotated[str | None, Cookie(alias=settings.auth.refresh_cookie_name)]


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=RegisterResponse)
@limiter.limit(settings.http.register_rate_limit)
async def register(request: Request, response: Response, payload: RegisterRequest):
    """Create an account and email a 6-digit code. Sign-in happens at /auth/verify."""
    email = await AuthService().register(payload.email, payload.password)
    return RegisterResponse(email=email)


@router.post("/verify", response_model=TokenResponse)
@limiter.limit(settings.http.login_rate_limit)
async def verify(request: Request, response: Response, payload: VerifyRequest):
    """Confirm the emailed code. Verifies the address and signs in."""
    session = await AuthService().verify_email(payload.email, payload.code)
    set_refresh_cookie(response, session.refresh_token)
    return session.tokens


@router.post("/resend-code", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(settings.http.resend_code_rate_limit)
async def resend_code(request: Request, response: Response, payload: ResendRequest) -> dict:
    """Send a new code. Answers the same way whether or not the address exists."""
    await AuthService().resend_code(payload.email)
    return {"message": "If that address is waiting for verification, a new code is on its way."}


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.http.login_rate_limit)
async def login(request: Request, response: Response, payload: LoginRequest):
    session = await AuthService().login(payload.email, payload.password)
    set_refresh_cookie(response, session.refresh_token)
    return session.tokens


@router.post("/refresh", response_model=TokenResponse)
async def refresh(response: Response, refresh_token: RefreshCookie = None):
    """New access token from the refresh cookie. The cookie is rotated too."""
    try:
        session = await AuthService().refresh(refresh_token)
    except UnauthorizedError:
        clear_refresh_cookie(response)
        raise
    set_refresh_cookie(response, session.refresh_token)
    return session.tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, refresh_token: RefreshCookie = None) -> None:
    await AuthService().logout(refresh_token)
    clear_refresh_cookie(response)


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser):
    return UserResponse(user_id=user.user_id, email=user.email)
