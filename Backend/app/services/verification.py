"""Email verification codes: issuing, sending and checking them.

Codes are 6 digits, stored only as a keyed hash, expire after a few minutes,
and allow a limited number of wrong guesses before a new one must be sent.
"""

import hashlib
import hmac
import secrets
from datetime import timedelta

from Backend.app.core.clock import parse_iso, utc_now
from Backend.app.core.config import settings
from Backend.app.core.errors import BadRequestError, TooManyRequestsError
from Backend.app.repositories import EmailCodeRepository
from Backend.app.services.email_service import send_verification_code

_WRONG_CODE = "That code is not right. Check the email and try again."
_EXPIRED = "That code has expired. Send a new one."


def _hash(email: str, code: str) -> str:
    key = settings.auth.jwt_secret.encode()
    return hmac.new(key, f"{email}:{code}".encode(), hashlib.sha256).hexdigest()


def _as_datetime(value):
    return parse_iso(value) if isinstance(value, str) else value


async def issue_code(email: str, *, enforce_cooldown: bool = True) -> None:
    """Create a new code for ``email`` and send it, replacing any earlier one."""
    limits = settings.limits
    codes = EmailCodeRepository()
    now = utc_now()

    if enforce_cooldown and (existing := await codes.get(email)):
        sent_at = _as_datetime(existing.get("sent_at"))
        if sent_at and sent_at.tzinfo is None:
            sent_at = sent_at.replace(tzinfo=now.tzinfo)
        if sent_at and (wait := limits.code_resend_seconds - (now - sent_at).total_seconds()) > 0:
            raise TooManyRequestsError(
                f"Wait {int(wait) + 1} seconds before asking for a new code."
            )

    code = f"{secrets.randbelow(1_000_000):06d}"
    await codes.replace(
        email, _hash(email, code), now + timedelta(minutes=limits.code_minutes), now
    )
    await send_verification_code(email, code)


async def check_code(email: str, code: str) -> None:
    """Raise unless ``code`` is the current, unexpired code for ``email``."""
    codes = EmailCodeRepository()
    record = await codes.get(email)
    if record is None:
        raise BadRequestError(_EXPIRED)

    expires_at = _as_datetime(record["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=utc_now().tzinfo)
    if expires_at < utc_now():
        await codes.delete(email)
        raise BadRequestError(_EXPIRED)

    if record.get("attempts", 0) >= settings.limits.code_attempts:
        raise BadRequestError("Too many wrong attempts. Send a new code.")

    if not hmac.compare_digest(record["code_hash"], _hash(email, code.strip())):
        await codes.count_attempt(email)
        raise BadRequestError(_WRONG_CODE)

    await codes.delete(email)
