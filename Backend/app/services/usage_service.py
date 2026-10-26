"""Daily usage limits per visitor IP address.

Each analysis, chat message and upload costs AI quota, so a public demo caps
how many one visitor can make per day. Counting is by IP rather than account,
so making new accounts (or using a private window) doesn't reset it.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import timedelta
from enum import StrEnum

from Backend.app.core.clock import utc_now
from Backend.app.core.config import settings
from Backend.app.core.errors import AppError, TooManyRequestsError
from Backend.app.repositories import UsageRepository


class Action(StrEnum):
    ANALYSIS = "analysis"
    CHAT = "chat"
    UPLOAD = "upload"


_NOUNS = {
    Action.ANALYSIS: "contract reviews",
    Action.CHAT: "questions",
    Action.UPLOAD: "uploads",
}


def _limit(action: Action) -> int:
    limits = settings.limits
    return {
        Action.ANALYSIS: limits.analysis_limit,
        Action.CHAT: limits.chat_limit,
        Action.UPLOAD: limits.upload_limit,
    }[action]


def _key(ip: str, action: Action) -> str:
    return f"{ip}:{action.value}:{utc_now().date().isoformat()}"


@asynccontextmanager
async def charge(ip: str, action: Action) -> AsyncIterator[None]:
    """Count one use for the block, refunded if the block fails with an app
    error (a bad file, a document still indexing...), so mistakes cost nothing.
    """
    await consume(ip, action)
    try:
        yield
    except AppError:
        await UsageRepository().decrement(_key(ip, action))
        raise


async def consume(ip: str, action: Action) -> None:
    """Count one use, or refuse with a 429 once today's limit is used up.

    Days run on UTC; the counter document deletes itself after midnight.
    """
    now = utc_now()
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    key = _key(ip, action)
    repo = UsageRepository()

    if await repo.increment(key, tomorrow) <= (limit := _limit(action)):
        return

    await repo.decrement(key)  # the refused attempt doesn't count
    hours = max(1, round((tomorrow - now).total_seconds() / 3600))
    raise TooManyRequestsError(
        f"You've reached today's limit of {limit} {_NOUNS[action]}. "
        f"It resets in about {hours} hour{'s' if hours != 1 else ''}."
    )
