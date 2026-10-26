"""Groq, used as a fallback when Gemini fails.

Groq speaks the OpenAI chat-completions format. The SDK retries 429s and 5xx
responses itself (honouring Retry-After), which matters on the free tier's
small per-minute token budget.
"""

import copy
from functools import cache
from typing import Any

import groq
from groq import AsyncGroq
from pydantic import BaseModel, ValidationError

from Backend.app.core.config import settings
from Backend.app.services.llm.gemini import LLMError


def available() -> bool:
    return settings.groq.enabled


def model_name() -> str:
    return settings.groq.model


@cache
def _client() -> AsyncGroq:
    if not settings.groq.enabled:
        raise LLMError("GROQ_API_KEY is not configured.")
    return AsyncGroq(
        api_key=settings.groq.api_key,
        max_retries=settings.groq.max_retries,
        timeout=settings.groq.timeout_seconds,
    )


def _friendly(exc: groq.APIError) -> LLMError:
    status = getattr(exc, "status_code", None)
    match status:
        case 401 | 403:
            return LLMError("Groq refused the API key. Check GROQ_API_KEY.")
        case 413:
            return LLMError(
                "The request was larger than Groq's per-minute token limit on this plan."
            )
        case 429:
            return LLMError("Groq's rate limit was reached as well. Try again in a minute.")
        case 400:
            return LLMError(f"Groq rejected the request: {exc.message}")
        case _:
            return LLMError(f"Groq is unavailable right now ({status or 'no response'}).")


async def chat(messages: list[dict], *, tools: list[dict] | None = None, **options: Any):
    """One chat-completions call. Returns the SDK's completion object."""
    try:
        return await _client().chat.completions.create(
            model=settings.groq.model,
            messages=messages,
            tools=tools or groq.NOT_GIVEN,
            max_completion_tokens=options.pop("max_tokens", None)
            or settings.groq.max_output_tokens,
            **options,
        )
    except groq.APIError as exc:
        raise _friendly(exc) from exc


def strict_schema(model: type[BaseModel]) -> dict:
    """Pydantic's JSON schema, adjusted for Groq's strict mode.

    Strict mode needs every property listed in ``required`` and
    ``additionalProperties: false`` on every object. Optional fields are
    already ``anyOf [..., null]`` in Pydantic's output, so they stay optional
    in meaning while being "required" in form. Nested models are inlined
    (no ``$ref``), and defaults and titles are dropped.
    """
    schema = copy.deepcopy(model.model_json_schema())
    definitions = schema.pop("$defs", {})

    def inline(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node:
                target = definitions[node["$ref"].rsplit("/", 1)[-1]]
                extra = {k: v for k, v in node.items() if k != "$ref"}
                return inline({**copy.deepcopy(target), **extra})
            return {key: inline(value) for key, value in node.items()}
        if isinstance(node, list):
            return [inline(item) for item in node]
        return node

    schema = inline(schema)

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            # Only on schema nodes: a *property* called "title" (RiskItem has
            # one) lives in a "properties" dict and must stay.
            if any(key in node for key in ("type", "anyOf", "enum")):
                if isinstance(node.get("title"), str):
                    del node["title"]
                node.pop("default", None)
                if "const" in node:  # strict mode lists enum, not const
                    node["enum"] = [node.pop("const")]
            if node.get("type") == "object" and "properties" in node:
                node["required"] = list(node["properties"])
                node["additionalProperties"] = False
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for item in node:
                visit(item)

    visit(schema)
    return schema


async def generate_structured[T: BaseModel](
    prompt: str, schema: type[T], *, system: str, max_output_tokens: int | None = None
) -> T:
    completion = await chat(
        [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=max_output_tokens,
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": schema.__name__,
                "strict": True,
                "schema": strict_schema(schema),
            },
        },
    )
    content = completion.choices[0].message.content or ""
    try:
        return schema.model_validate_json(content)
    except ValidationError as exc:
        raise LLMError("Groq returned a report in the wrong shape.") from exc
