"""Which AI provider to use, in order: Gemini first, Groq as the fallback.

Each provider carries the chunk sizes that suit it. Gemini reads 400,000
characters in one pass; Groq's free tier only allows a few thousand tokens a
minute, so it gets small chunks, one at a time.
"""

from dataclasses import dataclass

from pydantic import BaseModel

from Backend.app.core.config import settings
from Backend.app.services.llm import gemini, groq


@dataclass(frozen=True, slots=True)
class Provider:
    name: str
    model: str
    chunk_chars: int
    chunk_overlap_chars: int
    max_concurrent_chunks: int
    merge_max_output_tokens: int | None

    async def structured[T: BaseModel](
        self, prompt: str, schema: type[T], *, system: str, max_output_tokens: int | None = None
    ) -> T:
        # Looked up at call time, so tests can replace the module function.
        module = gemini if self.name == "Gemini" else groq
        return await module.generate_structured(
            prompt, schema, system=system, max_output_tokens=max_output_tokens
        )


def analysis_providers() -> list[Provider]:
    cfg = settings.analysis
    providers = [
        Provider(
            name="Gemini",
            model=settings.gemini.model,
            chunk_chars=cfg.chunk_chars,
            chunk_overlap_chars=cfg.chunk_overlap_chars,
            max_concurrent_chunks=cfg.max_concurrent_chunks,
            merge_max_output_tokens=settings.gemini.merge_max_output_tokens,
        )
    ]
    if groq.available():
        g = settings.groq
        providers.append(
            Provider(
                name="Groq",
                model=g.model,
                chunk_chars=g.chunk_chars,
                chunk_overlap_chars=g.chunk_overlap_chars,
                max_concurrent_chunks=g.max_concurrent_chunks,
                merge_max_output_tokens=g.max_output_tokens,
            )
        )
    return providers
