import asyncio
import logging

from google import genai
from google.genai import types

from Backend.app.config import settings
from Backend.app.models.insights import ContractInsights
from Backend.app.service.prompt import build_system_prompt, build_user_prompt

logger = logging.getLogger(__name__)


class AnalysisError(RuntimeError):
    """Raised when a usable report could not be produced.

    Any failure is surfaced as this type so callers can record a 'failed' status
    with a meaningful message instead of storing a half-built report.
    """


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    """Return the shared SDK client, or explain what is missing."""
    global _client

    if not settings.gemini_api_key:
        raise AnalysisError(
            "GEMINI_API_KEY is not configured, so contracts cannot be analysed. "
            "Add it to .env and restart the server."
        )

    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)

    return _client


def _finish_reason(response) -> object | None:
    if response.candidates:
        return getattr(response.candidates[0], "finish_reason", None)
    return None


async def _generate_once(user_prompt: str, max_output_tokens: int) -> ContractInsights:
    """One attempt at a single Gemini call. Raises AnalysisError on any failure."""
    client = _get_client()

    config = types.GenerateContentConfig(
        system_instruction=build_system_prompt(),
        response_mime_type="application/json",
        response_schema=ContractInsights,
        max_output_tokens=max_output_tokens,
        temperature=settings.gemini_temperature,
    )

    try:
        # .aio keeps the event loop free while the request is in flight. The
        # timeout stops a stalled connection from holding the job open until
        # the stale-analysis sweep declares it dead.
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=settings.gemini_model,
                contents=user_prompt,
                config=config,
            ),
            timeout=settings.gemini_timeout_seconds,
        )
    except asyncio.TimeoutError as exc:
        raise AnalysisError(
            f"Gemini did not respond within {settings.gemini_timeout_seconds:.0f} seconds."
        ) from exc
    except Exception as exc:
        raise AnalysisError(f"Gemini request failed: {exc}") from exc

    parsed = response.parsed

    if parsed is None:
        # Known SDK behaviour: with structured output, a response that stops
        # early (finish_reason MAX_TOKENS, or a safety block) returns parsed=None
        # *and* text=None. Falling back to `or {}` here would silently store an
        # empty report as a success, which is worse than failing loudly.
        raise AnalysisError(
            f"Gemini returned no usable report (finish_reason={_finish_reason(response)}). "
            "The contract may be too long for a single pass."
        )

    return parsed


async def generate_report(user_prompt: str, *, max_output_tokens: int | None = None) -> ContractInsights:
    """Run one Gemini call and return the parsed report, retrying transient failures.

    Long chunked jobs make many calls, so a single 429 or dropped connection
    used to fail the whole analysis. Retrying with a backoff keeps that from
    discarding work that has already been paid for; a genuine error (bad key,
    oversized input) still fails fast, because retrying it cannot help.
    """
    budget = max_output_tokens or settings.gemini_max_output_tokens
    attempts = max(1, settings.gemini_max_attempts)
    last_error: AnalysisError | None = None

    for attempt in range(1, attempts + 1):
        try:
            return await _generate_once(user_prompt, budget)
        except AnalysisError as exc:
            last_error = exc

            if attempt < attempts:
                # 2s, then 4s. Short enough not to eat the stale-job window.
                delay = 2**attempt
                logger.warning(
                    "Gemini call failed (attempt %d/%d), retrying in %ds: %s",
                    attempt,
                    attempts,
                    delay,
                    exc,
                )
                await asyncio.sleep(delay)

    raise last_error or AnalysisError("Gemini request failed for an unknown reason.")


async def analyze_with_gemini(
    contract_text: str,
    *,
    chunk_index: int | None = None,
    chunk_total: int | None = None,
) -> ContractInsights:
    """Analyse contract text (or one chunk of it) and return the report."""
    return await generate_report(
        build_user_prompt(
            contract_text,
            chunk_index=chunk_index,
            chunk_total=chunk_total,
        )
    )
