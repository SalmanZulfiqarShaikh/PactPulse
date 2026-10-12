"""Timestamp helpers.

Kept in their own module so that storing a timestamp never drags in the Gemini
SDK: the auth routes and the legacy-contract script only need a clock, and
importing the analysis service to get one would pull in google-genai.
"""

from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    """Current UTC time as an ISO-8601 string.

    Always timezone-aware, so a lexical sort of these strings is also a
    chronological one.
    """
    return utc_now().isoformat()
