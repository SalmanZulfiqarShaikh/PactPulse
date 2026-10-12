"""Password hashing and JWT issuing/verification.

Everything that touches a secret lives here, so the rules are in one place:
plaintext passwords and raw tokens are never logged, never stored, and never
returned anywhere other than to the caller that just supplied them.
"""

import logging
from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from Backend.app.config import settings
from Backend.app.service.timeutil import utc_now

logger = logging.getLogger(__name__)

# argon2id with the library defaults (time_cost=3, memory_cost=64 MiB,
# parallelism=4). Chosen over bcrypt because bcrypt silently caps input at 72
# bytes - it raises outright on anything longer - which would reject valid
# passwords up to the 128-character limit the API advertises.
_hasher = PasswordHasher()

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


class TokenError(Exception):
    """Raised when a token is missing, malformed, expired or the wrong type."""


# --- Passwords -------------------------------------------------------------


def hash_password(password: str) -> str:
    """Return an argon2id hash of ``password``. The salt is embedded."""
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Check ``password`` against a stored hash.

    Returns False rather than raising for a wrong password or a corrupt hash, so
    callers cannot accidentally turn a mismatch into a 500.
    """
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    """True if the hash was made with weaker parameters than we now use."""
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return False


# A valid hash of a value nobody can supply, verified against when the email is
# unknown so that a missing account costs the same time as a wrong password.
# Without this, response time alone reveals which emails are registered.
#
# Built once at import rather than on first use: hashing takes the best part of
# a tenth of a second, and paying that inside the first unknown-email request
# would make that one request conspicuous instead of uniform.
_DUMMY_HASH = _hasher.hash("pact-pulse-timing-equaliser")


def dummy_verify() -> None:
    """Spend the same time as a real password check, and discard the result.

    Goes through ``verify_password`` rather than the hasher directly: the
    password deliberately does not match, and the raw call raises
    ``VerifyMismatchError``, which would surface as a 500. That would be an
    enumeration oracle in its own right - a 401 for a real email and a 500 for
    an unknown one - which is exactly what this function exists to prevent.
    """
    verify_password("not-the-password", _DUMMY_HASH)


# --- Tokens ----------------------------------------------------------------


def _create_token(user_id: str, token_type: str, lifetime: timedelta, **claims) -> str:
    now = utc_now()
    payload = {
        "sub": user_id,
        "type": token_type,
        "iat": now,
        "exp": now + lifetime,
        **claims,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str, email: str) -> str:
    """Mint a short-lived access token for the ``Authorization`` header."""
    return _create_token(
        user_id,
        ACCESS_TOKEN_TYPE,
        timedelta(minutes=settings.access_token_minutes),
        email=email,
    )


def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    """Mint a long-lived refresh token, delivered only as an httpOnly cookie.

    ``token_version`` is the account's current session generation. Refresh
    compares it with the stored value and rejects a token carrying an older one,
    which is what makes logout terminate the session for real rather than only
    deleting the caller's copy of the cookie.
    """
    return _create_token(
        user_id,
        REFRESH_TOKEN_TYPE,
        timedelta(days=settings.refresh_token_days),
        ver=int(token_version),
    )


def decode_token(token: str, *, expected_type: str) -> dict:
    """Verify a token's signature, expiry and type, and return its claims.

    The type is checked explicitly: access and refresh tokens are signed with
    the same key, so without this a refresh token would be accepted as an
    access token (and the reverse), which would let a stolen long-lived cookie
    be replayed as a bearer credential and defeat the short access lifetime.
    """
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        # Covers a bad signature, a malformed token and a wrong algorithm.
        raise TokenError("Token is invalid.") from exc

    if claims.get("type") != expected_type:
        raise TokenError(f"Expected a {expected_type} token.")

    if not claims.get("sub"):
        raise TokenError("Token is missing its subject.")

    return claims


__all__ = [
    "ACCESS_TOKEN_TYPE",
    "REFRESH_TOKEN_TYPE",
    "TokenError",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "dummy_verify",
    "hash_password",
    "password_needs_rehash",
    "verify_password",
]
