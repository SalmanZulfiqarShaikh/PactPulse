"""Text embeddings with fastembed: Hugging Face models run locally on ONNX.

No API key and no PyTorch. The model (~70 MB for the default) downloads from
Hugging Face on first use and is cached. Embedding is CPU-bound, so it runs in
a worker thread to keep the server responsive.
"""

import asyncio
from functools import cache
from typing import Protocol

from Backend.app.core.config import settings


class Embedder(Protocol):
    dimension: int

    def embed_passages(self, texts: list[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...


class FastEmbedder:
    def __init__(self, model_name: str) -> None:
        from fastembed import TextEmbedding  # heavy import, only when chat is used

        self.model = TextEmbedding(model_name=model_name)
        self.dimension = TextEmbedding.get_embedding_size(model_name)

    def embed_passages(self, texts: list[str]) -> list[list[float]]:
        return [vector.tolist() for vector in self.model.passage_embed(texts)]

    def embed_query(self, text: str) -> list[float]:
        return next(iter(self.model.query_embed(text))).tolist()


_override: Embedder | None = None


def use_embedder(embedder: Embedder | None) -> None:
    """Swap in another embedder (used by the tests)."""
    global _override
    _override = embedder


@cache
def _default() -> Embedder:
    return FastEmbedder(settings.rag.embedding_model)


def get_embedder() -> Embedder:
    return _override or _default()


async def embed_passages(texts: list[str]) -> list[list[float]]:
    return await asyncio.to_thread(get_embedder().embed_passages, texts)


async def embed_query(text: str) -> list[float]:
    return await asyncio.to_thread(get_embedder().embed_query, text)


async def dimension() -> int:
    return (await asyncio.to_thread(get_embedder)).dimension
