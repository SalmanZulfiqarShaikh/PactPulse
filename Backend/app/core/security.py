"""Password hashing and JWTs.

argon2 is deliberately slow (~100 ms and 64 MiB per hash), so the async helpers
run it in a worker thread. Calling it directly inside an ``async def`` route
would stall every other request for that long.
"""

import asyncio
from dataclasses import dataclass
from datetime import timedelta
from enum import StrEnum

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from Backend.app.core.clock import utc_now
from Backend.app.core.config import settings

_hasher = PasswordHasher()


class TokenType(StrEnum):
    ACCESS = "access"
    REFRESH = "refresh"


class TokenError(Exception):
    """A token is missing, malformed, expired, or of the wrong type."""


@dataclass(frozen=True, slots=True)
class TokenClaims:
    user_id: str
    email: str = ""
    version: int = 0


# --- Passwords ----------------------------------------------------------------


def _verify(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


async def hash_password(password: str) -> str:
    return await asyncio.to_thread(_hasher.hash, password)


async def verify_password(password: str, password_hash: str) -> bool:
    return await asyncio.to_thread(_verify, password, password_hash)


def needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return False


# Verified against when an email is unknown, so a missing account costs the same
# time as a wrong password and response timing cannot reveal who is registered.
_DUMMY_HASH = _hasher.hash("pact-pulse-timing-equaliser")


async def spend_verify_time() -> None:
    await verify_password("not-the-password", _DUMMY_HASH)


# --- Tokens -------------------------------------------------------------------


def _encode(user_id: str, token_type: TokenType, lifetime: timedelta, **claims: object) -> str:
    now = utc_now()
    payload = {
        "sub": user_id,
        "type": token_type.value,
        "iat": now,
        "exp": now + lifetime,
        **claims,
    }
    return jwt.encode(payload, settings.auth.jwt_secret, algorithm=settings.auth.jwt_algorithm)


def create_access_token(user_id: str, email: str) -> str:
    lifetime = timedelta(minutes=settings.auth.access_token_minutes)
    return _encode(user_id, TokenType.ACCESS, lifetime, email=email)


def create_refresh_token(user_id: str, version: int = 0) -> str:
    """``version`` is the account's session generation; logout bumps it."""
    lifetime = timedelta(days=settings.auth.refresh_token_days)
    return _encode(user_id, TokenType.REFRESH, lifetime, ver=int(version))


def decode_token(token: str, expected: TokenType) -> TokenClaims:
    """Verify signature, expiry and type.

    The type check matters: both token kinds share a key, so without it a
    long-lived refresh cookie could be replayed as a bearer token.
    """
    try:
        claims = jwt.decode(
            token, settings.auth.jwt_secret, algorithms=[settings.auth.jwt_algorithm]
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("Token is invalid.") from exc

    if claims.get("type") != expected.value or not claims.get("sub"):
        raise TokenError(f"Expected a valid {expected.value} token.")

    return TokenClaims(
        user_id=claims["sub"], email=claims.get("email", ""), version=int(claims.get("ver", 0))
    )
