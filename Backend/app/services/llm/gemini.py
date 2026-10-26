"""The one place that calls Google's Gemini API.

Retries and timeouts use the SDK's built-in HTTP options: transient 429 and 5xx
responses are retried with exponential backoff, while a real error (bad key,
oversized input) fails straight away because retrying cannot help.
"""

from functools import cache

from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from Backend.app.core.config import settings
from Backend.app.core.errors import ServiceUnavailableError

_TRANSIENT_STATUS_CODES = [408, 429, 500, 502, 503, 504]


class LLMError(ServiceUnavailableError):
    """Gemini could not produce a usable answer. The message is safe to show users.

    It is an AppError, so if it escapes a request (e.g. in chat) the client gets
    a 503 with this message instead of a bare 500, which browsers report as
    "could not reach the server" because a crash response carries no CORS headers.
    """


@cache
def _client() -> genai.Client:
    if not settings.gemini.api_key:
        raise LLMError("GEMINI_API_KEY is not configured. Add it to Backend/.env and restart.")
    return genai.Client(
        api_key=settings.gemini.api_key,
        http_options=types.HttpOptions(
            timeout=int(settings.gemini.timeout_seconds * 1000),
            retry_options=types.HttpRetryOptions(
                attempts=max(1, settings.gemini.max_attempts),
                http_status_codes=_TRANSIENT_STATUS_CODES,
            ),
        ),
    )


def _friendly(exc: errors.APIError) -> LLMError:
    match exc.code:
        case 400:
            return LLMError("Gemini rejected the request (it may be too large).")
        case 401 | 403:
            return LLMError("Gemini refused the API key. Check GEMINI_API_KEY.")
        case 429:
            return LLMError("Gemini's rate limit or quota was reached. Try again shortly.")
        case _:
            return LLMError(f"Gemini is unavailable right now (HTTP {exc.code}). Try again.")


async def generate(
    contents: types.ContentListUnion,
    config: types.GenerateContentConfig,
    *,
    model: str | None = None,
) -> types.GenerateContentResponse:
    """A raw call, for callers that need the full response (the chat agent)."""
    try:
        return await _client().aio.models.generate_content(
            model=model or settings.gemini.model, contents=contents, config=config
        )
    except errors.APIError as exc:
        raise _friendly(exc) from exc
    except TimeoutError as exc:
        raise LLMError("Gemini did not respond in time. Try again.") from exc


def _finish_reason(response: types.GenerateContentResponse) -> str:
    if response.candidates and response.candidates[0].finish_reason:
        return str(response.candidates[0].finish_reason)
    return "unknown"


async def generate_structured[T: BaseModel](
    prompt: types.ContentListUnion,
    schema: type[T],
    *,
    system: str,
    max_output_tokens: int | None = None,
) -> T:
    """Ask for JSON matching ``schema`` and return it parsed."""
    response = await generate(
        prompt,
        types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=schema,
            max_output_tokens=max_output_tokens or settings.gemini.max_output_tokens,
            temperature=settings.gemini.temperature,
            seed=settings.gemini.seed,
        ),
    )
    if not isinstance(response.parsed, schema):
        # A response cut short (MAX_TOKENS, safety block) comes back unparsed.
        # Storing an empty report as a success would be worse than failing.
        raise LLMError(
            f"Gemini returned no usable report (finish reason: {_finish_reason(response)})."
        )
    return response.parsed


async def generate_text(
    prompt: types.ContentListUnion, *, system: str, max_output_tokens: int | None = None
) -> str:
    response = await generate(
        prompt,
        types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_output_tokens or settings.gemini.max_output_tokens,
            temperature=settings.gemini.temperature,
            seed=settings.gemini.seed,
        ),
    )
    if not response.text:
        raise LLMError(f"Gemini returned no text (finish reason: {_finish_reason(response)}).")
    return response.text
