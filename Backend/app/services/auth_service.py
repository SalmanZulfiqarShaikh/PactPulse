"""Registration, login, token refresh and logout."""

import contextlib
import uuid
from dataclasses import dataclass

from Backend.app.core import security
from Backend.app.core.clock import iso_now
from Backend.app.core.config import settings
from Backend.app.core.errors import (
    AppError,
    BadRequestError,
    ConflictError,
    ForbiddenError,
    UnauthorizedError,
)
from Backend.app.models.user import User
from Backend.app.repositories import UserRepository
from Backend.app.schemas.auth import TokenResponse, normalise_email
from Backend.app.services.verification import check_code, issue_code

# One message for unknown email and wrong password alike, so login cannot be
# used to discover which addresses are registered.
_INVALID_CREDENTIALS = "Incorrect email or password."


@dataclass(slots=True)
class Session:
    """What the route needs: the response body and the refresh cookie value."""

    tokens: TokenResponse
    refresh_token: str


def _session(user_id: str, email: str, version: int) -> Session:
    return Session(
        tokens=TokenResponse(
            access_token=security.create_access_token(user_id, email),
            expires_in=settings.auth.access_token_minutes * 60,
            user_id=user_id,
            email=email,
        ),
        refresh_token=security.create_refresh_token(user_id, version),
    )


class AuthService:
    def __init__(self) -> None:
        self.users = UserRepository()

    async def register(self, email: str, password: str) -> str:
        """Create an unverified account and email it a code. Returns the email.

        Signing up again with an address that was never verified is allowed:
        it sets the new password and sends a fresh code, so a typo in the first
        attempt doesn't lock the address.
        """
        email = normalise_email(email)
        password_hash = await security.hash_password(password)
        user = User(
            user_id=uuid.uuid4().hex,
            email=email,
            password_hash=password_hash,
            created_at=iso_now(),
            email_verified=False,
        )
        try:
            await self.users.create(user)
        except ConflictError:
            existing = await self.users.by_email(email)
            if existing is None or existing.email_verified:
                raise
            await self.users.set_password_hash(existing.user_id, password_hash)
        await issue_code(email, enforce_cooldown=False)
        return email

    async def verify_email(self, email: str, code: str) -> Session:
        """Check the code, mark the address verified, and sign in."""
        email = normalise_email(email)
        user = await self.users.by_email(email)
        if user is None:
            raise BadRequestError("That code has expired. Send a new one.")
        if not user.email_verified:
            await check_code(email, code)
            await self.users.mark_verified(user.user_id)
        return _session(user.user_id, user.email, user.token_version)

    async def resend_code(self, email: str) -> None:
        """Send a new code. Silent for unknown or already-verified addresses."""
        user = await self.users.by_email(normalise_email(email))
        if user is not None and not user.email_verified:
            await issue_code(user.email)

    async def login(self, email: str, password: str) -> Session:
        user = await self.users.by_email(normalise_email(email))
        if user is None:
            # Spend the same time as a real check so timing reveals nothing.
            await security.spend_verify_time()
            raise UnauthorizedError(_INVALID_CREDENTIALS)
        if not await security.verify_password(password, user.password_hash):
            raise UnauthorizedError(_INVALID_CREDENTIALS)

        if not user.email_verified:
            # The password was right, so this is the owner: send a fresh code
            # (unless one went out moments ago) and point them to verification.
            with contextlib.suppress(AppError):  # a code sent moments ago still works
                await issue_code(user.email)
            raise ForbiddenError(
                "Verify your email to continue. We've sent a code to " + user.email + "."
            )

        if security.needs_rehash(user.password_hash):
            await self.users.set_password_hash(user.user_id, await security.hash_password(password))

        return _session(user.user_id, user.email, user.token_version)

    async def refresh(self, refresh_token: str | None) -> Session:
        """Rotate the refresh token and mint a new access token."""
        if not refresh_token:
            raise UnauthorizedError("No refresh token.")
        try:
            claims = security.decode_token(refresh_token, security.TokenType.REFRESH)
        except security.TokenError:
            raise UnauthorizedError("Refresh token is invalid or has expired.") from None

        user = await self.users.by_id(claims.user_id)
        # Logout bumps token_version, so a cookie from before a logout is dead.
        if user is None or claims.version != user.token_version:
            raise UnauthorizedError("Refresh token is invalid or has expired.")
        return _session(user.user_id, user.email, user.token_version)

    async def logout(self, refresh_token: str | None) -> None:
        """End the session for real by invalidating every earlier refresh token.

        Always succeeds: an expired or missing cookie has nothing left to revoke.
        Access tokens already issued stay valid until they expire (20 minutes).
        """
        if not refresh_token:
            return
        try:
            claims = security.decode_token(refresh_token, security.TokenType.REFRESH)
        except security.TokenError:
            return
        await self.users.bump_token_version(claims.user_id)
