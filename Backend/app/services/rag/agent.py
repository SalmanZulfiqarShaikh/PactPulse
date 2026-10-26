"""The chat agent (agentic RAG): the model decides which tools to call - vector
search in Qdrant, exact search, reading passages - reads the results, and
answers with [P#] citations. A bounded loop, so a confused model cannot spin.

Gemini runs first. If it fails (quota, outage, missing key) and GROQ_API_KEY is
set, the same question is answered by Groq with the same tools.
"""

import json
import logging
import re
from dataclasses import dataclass, field

from google.genai import types

from Backend.app.core.config import settings
from Backend.app.models.chat import ChatMessage, ChatRole, Citation
from Backend.app.prompts.chat import DocumentInfo, system_prompt
from Backend.app.services.llm import LLMError, generate, groq
from Backend.app.services.rag import vector_store
from Backend.app.services.rag.tools import GEMINI_DECLARATIONS, OPENAI_TOOLS, DocumentToolbox

logger = logging.getLogger(__name__)

_CITATION = re.compile(r"\[P(\d+)\]")
# Models sometimes group citations: [P1, P2], [P3; P7], [P4-P6], [P1, 2].
_GROUPED = re.compile(r"\[\s*P\s*\d+(?:\s*[,;\-–]\s*P?\s*\d+)+\s*\]")
_FALLBACK = "I couldn't find an answer to that in the document. Try rephrasing the question."
_WRAP_UP = "Answer now using only what you have found, with citations."


@dataclass(slots=True)
class AgentAnswer:
    text: str
    citations: list[Citation] = field(default_factory=list)
    tool_calls: int = 0
    provider: str = "Gemini"
    # True when no model could answer and the reply is just the closest passages.
    search_only: bool = False


def _normalise_citations(answer: str) -> str:
    """Rewrite grouped citations as one [P#] each, so every one becomes a chip."""

    def expand(match: re.Match) -> str:
        group = match.group(0)
        numbers = [int(n) for n in re.findall(r"\d+", group)]
        if len(numbers) == 2 and re.search(r"[\-–]", group) and numbers[0] < numbers[1] <= 999:
            numbers = list(range(numbers[0], min(numbers[1], numbers[0] + 9) + 1))
        return "".join(f"[P{n}]" for n in numbers)

    return _GROUPED.sub(expand, answer)


def _citations(answer: str, toolbox: DocumentToolbox) -> list[Citation]:
    numbers = sorted({int(n) for n in _CITATION.findall(answer)})
    return [
        Citation(passage=n, start=span.start, end=span.end, text=span.text)
        for n in numbers
        if 1 <= n <= len(toolbox.passages) and (span := toolbox.passages[n - 1])
    ]


def _as_json(value: object) -> object:
    """Tool output made JSON-safe (dates, sets and the like become strings)."""
    return json.loads(json.dumps(value, default=str))


def _finish(text: str | None, toolbox: DocumentToolbox, calls: int, provider: str) -> AgentAnswer:
    text = _normalise_citations((text or "").strip()) or _FALLBACK
    return AgentAnswer(text, _citations(text, toolbox), calls, provider)


# --- Gemini ------------------------------------------------------------------


def _gemini_config(system: str, *, with_tools: bool) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        system_instruction=system,
        temperature=0.2,
        tools=[types.Tool(function_declarations=GEMINI_DECLARATIONS)] if with_tools else None,
    )


async def _ask_gemini(
    question: str, history: list[ChatMessage], toolbox: DocumentToolbox, system: str
) -> AgentAnswer:
    contents = [
        types.Content(
            role="user" if m.role == ChatRole.USER else "model",
            parts=[types.Part.from_text(text=m.content)],
        )
        for m in history
    ]
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=question)]))
    calls_made = 0

    for _ in range(settings.rag.agent_max_steps):
        response = await generate(
            contents, _gemini_config(system, with_tools=True), model=settings.gemini.chat_model
        )
        calls = response.function_calls or []
        if not calls:
            return _finish(response.text, toolbox, calls_made, "Gemini")

        contents.append(response.candidates[0].content)
        results = []
        for call in calls:
            calls_made += 1
            logger.info("Chat tool (Gemini): %s %s", call.name, dict(call.args or {}))
            output = await toolbox.call(call.name, dict(call.args or {}))
            results.append(
                types.Part.from_function_response(
                    name=call.name, response={"result": _as_json(output)}
                )
            )
        contents.append(types.Content(role="user", parts=results))

    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=_WRAP_UP)]))
    response = await generate(
        contents, _gemini_config(system, with_tools=False), model=settings.gemini.chat_model
    )
    return _finish(response.text, toolbox, calls_made, "Gemini")


# --- Groq (OpenAI chat-completions format) -----------------------------------


def _size(messages: list[dict]) -> int:
    return sum(
        len(m.get("content") or "") + len(json.dumps(m.get("tool_calls") or "")) for m in messages
    )


def _fit_budget(messages: list[dict], budget: int) -> None:
    """Keep a Groq request under its per-minute token budget, in place.

    Older tool results are shortened first (the model has already read them),
    then the oldest earlier-conversation turns are dropped. The system prompt,
    the current question and the latest tool results always stay.
    """
    question = next(i for i in range(len(messages) - 1, 0, -1) if messages[i].get("is_question"))
    latest_tool_turn = max(
        (i for i, m in enumerate(messages) if m.get("tool_calls")), default=len(messages)
    )
    for index in range(question + 1, latest_tool_turn):
        if _size(messages) <= budget:
            return
        message = messages[index]
        if message["role"] == "tool" and len(message["content"]) > 300:
            message["content"] = message["content"][:300] + " ... (trimmed, already read)"
    while _size(messages) > budget and question > 1:
        del messages[1]
        question -= 1


def _for_api(messages: list[dict]) -> list[dict]:
    return [{k: v for k, v in m.items() if k != "is_question"} for m in messages]


async def _ask_groq(
    question: str, history: list[ChatMessage], toolbox: DocumentToolbox, system: str
) -> AgentAnswer:
    cfg = settings.groq
    toolbox.compact(results=cfg.chat_search_results, passage_chars=cfg.chat_passage_chars)
    recent = history[-cfg.chat_history_messages :] if cfg.chat_history_messages else []
    messages: list[dict] = [{"role": "system", "content": system}]
    messages += [{"role": m.role.value, "content": m.content} for m in recent]
    messages.append({"role": "user", "content": question, "is_question": True})
    calls_made = 0

    async def call_groq(**options):
        _fit_budget(messages, cfg.chat_budget_chars)
        return await groq.chat(
            _for_api(messages), temperature=0.2, max_tokens=cfg.chat_max_output_tokens, **options
        )

    for _ in range(settings.rag.agent_max_steps):
        completion = await call_groq(tools=OPENAI_TOOLS)
        message = completion.choices[0].message
        if not message.tool_calls:
            return _finish(message.content, toolbox, calls_made, "Groq")

        messages.append(
            {
                "role": "assistant",
                "content": message.content or "",
                "tool_calls": [call.model_dump() for call in message.tool_calls],
            }
        )
        for call in message.tool_calls:
            calls_made += 1
            try:
                args = json.loads(call.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            logger.info("Chat tool (Groq): %s %s", call.function.name, args)
            output = await toolbox.call(call.function.name, args)
            messages.append(
                {"role": "tool", "tool_call_id": call.id, "content": json.dumps(_as_json(output))}
            )

    messages.append({"role": "user", "content": _WRAP_UP})
    completion = await call_groq()
    return _finish(completion.choices[0].message.content, toolbox, calls_made, "Groq")


# --- Entry point ---------------------------------------------------------------


async def answer_question(
    question: str,
    history: list[ChatMessage],
    toolbox: DocumentToolbox,
    document: DocumentInfo,
) -> AgentAnswer:
    system = system_prompt(document, passages=len(toolbox.passages))
    try:
        return await _ask_gemini(question, history, toolbox, system)
    except LLMError as gemini_error:
        failure = gemini_error
        if groq.available():
            logger.warning("Gemini chat failed (%s); answering with Groq.", gemini_error)
            try:
                return await _ask_groq(question, history, toolbox, system)
            except LLMError as groq_error:
                failure = LLMError(f"Gemini: {gemini_error} | Groq: {groq_error}")

    logger.warning("No model could answer (%s); replying with search results only.", failure)
    return await _search_only_answer(question, toolbox, failure)


# --- Last resort: retrieval without a model -----------------------------------

_SEARCH_ONLY_RESULTS = 3
_SEARCH_ONLY_CHARS = 600


async def _search_only_answer(
    question: str, toolbox: DocumentToolbox, failure: LLMError
) -> AgentAnswer:
    """Answer with the closest passages when every model is unavailable.

    Retrieval runs locally (fastembed + Qdrant), so it still works when every
    AI provider is down or out of quota.
    """
    try:
        hits = await vector_store.search(
            toolbox.contract_id, toolbox.owner_id, question, _SEARCH_ONLY_RESULTS
        )
    except Exception:  # noqa: BLE001 - nothing left to fall back to
        logger.exception("Search-only fallback failed too.")
        raise failure from None
    if not hits:
        raise failure

    lines = [
        "The AI is busy right now, so I can't write an answer. "
        f"Here are the {len(hits)} passages most relevant to your question:",
        "",
    ]
    for hit in hits:
        excerpt = hit.text.strip().replace("\n", " ")
        if len(excerpt) > _SEARCH_ONLY_CHARS:
            excerpt = excerpt[:_SEARCH_ONLY_CHARS].rsplit(" ", 1)[0] + " …"
        lines += [f"**Passage {hit.passage}** [P{hit.passage}]", f"> {excerpt}", ""]
    lines.append("Try asking again in a minute for a written answer.")

    text = "\n".join(lines)
    return AgentAnswer(text, _citations(text, toolbox), 0, "search", search_only=True)
