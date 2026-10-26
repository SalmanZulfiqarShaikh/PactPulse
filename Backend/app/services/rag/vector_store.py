"""Passage vectors in Qdrant.

Embedded mode (a folder on disk, no server) unless QDRANT_URL is set. Every
point carries contract_id and owner_id, and every search filters on both, so
one account's documents never surface in another's chat.
"""

import uuid
from dataclasses import dataclass

from qdrant_client import AsyncQdrantClient, models

from Backend.app.core.config import settings
from Backend.app.services.analysis.chunking import Span
from Backend.app.services.rag import embeddings

_client: AsyncQdrantClient | None = None


@dataclass(frozen=True, slots=True)
class Hit:
    passage: int
    start: int
    end: int
    text: str
    score: float


def _make_client() -> AsyncQdrantClient:
    cfg = settings.rag
    if cfg.qdrant_url:
        return AsyncQdrantClient(url=cfg.qdrant_url, api_key=cfg.qdrant_api_key)
    cfg.qdrant_path.mkdir(parents=True, exist_ok=True)
    return AsyncQdrantClient(path=str(cfg.qdrant_path))


def use_client(client: AsyncQdrantClient | None) -> None:
    """Swap in another client, e.g. AsyncQdrantClient(":memory:") in tests."""
    global _client
    _client = client


async def _ready_client() -> AsyncQdrantClient:
    global _client
    if _client is None:
        _client = _make_client()
    name = settings.rag.qdrant_collection
    if not await _client.collection_exists(name):
        await _client.create_collection(
            name,
            vectors_config=models.VectorParams(
                size=await embeddings.dimension(), distance=models.Distance.COSINE
            ),
        )
    return _client


async def close() -> None:
    if _client is not None:
        await _client.close()
        use_client(None)


def _owned_by(contract_id: str, owner_id: str) -> models.Filter:
    return models.Filter(
        must=[
            models.FieldCondition(key="contract_id", match=models.MatchValue(value=contract_id)),
            models.FieldCondition(key="owner_id", match=models.MatchValue(value=owner_id)),
        ]
    )


async def replace_document(contract_id: str, owner_id: str, passages: list[Span]) -> None:
    client = await _ready_client()
    vectors = await embeddings.embed_passages([p.text for p in passages])
    await delete_document(contract_id, owner_id)
    await client.upsert(
        settings.rag.qdrant_collection,
        points=[
            models.PointStruct(
                id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"{contract_id}/{number}")),
                vector=vector,
                payload={
                    "contract_id": contract_id,
                    "owner_id": owner_id,
                    "passage": number,
                    "start": passage.start,
                    "end": passage.end,
                    "text": passage.text,
                },
            )
            for number, (passage, vector) in enumerate(zip(passages, vectors, strict=True), start=1)
        ],
    )


async def search(contract_id: str, owner_id: str, query: str, limit: int) -> list[Hit]:
    client = await _ready_client()
    result = await client.query_points(
        settings.rag.qdrant_collection,
        query=await embeddings.embed_query(query),
        query_filter=_owned_by(contract_id, owner_id),
        limit=limit,
        with_payload=True,
    )
    return [
        Hit(
            passage=point.payload["passage"],
            start=point.payload["start"],
            end=point.payload["end"],
            text=point.payload["text"],
            score=point.score,
        )
        for point in result.points
    ]


async def delete_document(contract_id: str, owner_id: str) -> None:
    if _client is None and not settings.rag.qdrant_url and not settings.rag.qdrant_path.exists():
        return  # nothing has ever been indexed
    client = await _ready_client()
    await client.delete(
        settings.rag.qdrant_collection,
        points_selector=models.FilterSelector(filter=_owned_by(contract_id, owner_id)),
    )
