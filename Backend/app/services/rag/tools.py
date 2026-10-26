"""The tools the chat agent can call, all scoped to one document.

The chat is independent of the contract analysis: everything it knows comes
from the document itself, through retrieval (Qdrant vector search), exact text
search, and reading passages.

Each tool returns plain JSON-able data. Passage numbers are 1-based and match
the [P#] citations the agent writes, which the server resolves back to exact
character ranges for highlighting.
"""

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from google.genai import types

from Backend.app.core.config import settings
from Backend.app.services.analysis.chunking import Span
from Backend.app.services.analysis.quotes import NormalisedText
from Backend.app.services.rag import vector_store

logger = logging.getLogger(__name__)

_MAX_EXACT_MATCHES = 8
_SNIPPET_RADIUS = 220


@dataclass(frozen=True, slots=True)
class ToolSpec:
    """One tool, described once and rendered for each provider's format."""

    name: str
    description: str
    properties: dict = field(default_factory=dict)
    required: tuple[str, ...] = ()

    def parameters(self) -> dict:
        return {"type": "object", "properties": self.properties, "required": list(self.required)}

    def for_gemini(self) -> types.FunctionDeclaration:
        if not self.properties:  # a no-argument tool is declared without parameters
            return types.FunctionDeclaration(name=self.name, description=self.description)
        return types.FunctionDeclaration(
            name=self.name, description=self.description, parameters_json_schema=self.parameters()
        )

    def for_openai(self) -> dict:
        """The chat-completions format, used by Groq."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters(),
            },
        }


TOOLS = [
    ToolSpec(
        "search_document",
        "Semantic search: find the passages most related in meaning to a question or topic.",
        {"query": {"type": "string", "description": "What to look for, in natural language."}},
        ("query",),
    ),
    ToolSpec(
        "find_exact_text",
        "Find exact occurrences of a word, phrase, number, name or clause number "
        "(case-insensitive). Use for precise lookups like 'Clause 7.2' or '30 days'.",
        {"text": {"type": "string", "description": "The exact text to find."}},
        ("text",),
    ),
    ToolSpec(
        "read_passages",
        "Read passages by number, e.g. to see what comes before or after a search hit.",
        {
            "first": {"type": "integer", "description": "First passage number to read."},
            "count": {"type": "integer", "description": "How many passages, 1 to 4."},
        },
        ("first",),
    ),
]

GEMINI_DECLARATIONS = [tool.for_gemini() for tool in TOOLS]
OPENAI_TOOLS = [tool.for_openai() for tool in TOOLS]


class DocumentToolbox:
    def __init__(self, contract_id: str, owner_id: str, text: str, passages: list[Span]) -> None:
        self.contract_id = contract_id
        self.owner_id = owner_id
        self.text = text
        self.passages = passages
        self._normalised: NormalisedText | None = None
        self.search_limit = settings.rag.search_results
        self.passage_chars: int | None = None
        self._tools: dict[str, Callable[..., Awaitable[Any]]] = {
            "search_document": self.search_document,
            "find_exact_text": self.find_exact_text,
            "read_passages": self.read_passages,
        }

    async def call(self, name: str, args: dict[str, Any]) -> Any:
        if (tool := self._tools.get(name)) is None:
            return {"error": f"Unknown tool '{name}'."}
        try:
            return await tool(**args)
        except TypeError as exc:
            return {"error": f"Bad arguments for {name}: {exc}"}
        except Exception as exc:  # noqa: BLE001 - the agent should see the failure, not crash
            logger.exception("Chat tool %s failed.", name)
            return {"error": f"{name} failed: {exc}. Try another tool."}

    def _passage_at(self, offset: int) -> int:
        for number, passage in enumerate(self.passages, start=1):
            if passage.start <= offset < passage.end:
                return number
        return len(self.passages)

    def compact(self, *, results: int, passage_chars: int) -> None:
        """Return fewer, shorter passages - for providers with small token budgets."""
        self.search_limit = results
        self.passage_chars = passage_chars

    def _clip(self, text: str) -> str:
        if self.passage_chars and len(text) > self.passage_chars:
            return text[: self.passage_chars] + " …"
        return text

    async def search_document(self, query: str) -> list[dict]:
        hits = await vector_store.search(self.contract_id, self.owner_id, query, self.search_limit)
        return [
            {"passage": h.passage, "text": self._clip(h.text), "relevance": round(h.score, 3)}
            for h in hits
        ]

    async def find_exact_text(self, text: str) -> dict:
        self._normalised = self._normalised or NormalisedText(self.text)
        needle = NormalisedText(text).text
        if not needle:
            return {"matches": [], "total": 0}

        haystack, matches, position = self._normalised.text, [], 0
        while (found := haystack.find(needle, position)) != -1:
            start, end = self._normalised.original_span(found, found + len(needle))
            matches.append(
                {
                    "passage": self._passage_at(start),
                    "snippet": self.text[max(0, start - _SNIPPET_RADIUS) : end + _SNIPPET_RADIUS],
                }
            )
            position = found + len(needle)
        return {"matches": matches[:_MAX_EXACT_MATCHES], "total": len(matches)}

    async def read_passages(self, first: int, count: int = 2) -> list[dict]:
        first = max(1, int(first))
        last = min(len(self.passages), first + max(1, min(int(count), 4)) - 1)
        return [
            {"passage": number, "text": self._clip(self.passages[number - 1].text)}
            for number in range(first, last + 1)
        ]
