"""Making a document searchable for chat."""

import logging

from Backend.app.models.contract import IndexStatus
from Backend.app.repositories import ContractRepository
from Backend.app.services.rag import vector_store
from Backend.app.services.rag.splitter import split_passages

logger = logging.getLogger(__name__)


async def index_document(contract_id: str, owner_id: str) -> None:
    """Background job: split, embed and store the document. Never raises."""
    contracts = ContractRepository()
    await contracts.set_index_state(contract_id, owner_id, IndexStatus.INDEXING)
    try:
        text = await contracts.get_text(contract_id, owner_id)
        if not text:
            raise ValueError("The document has no text to index.")
        passages = split_passages(text)
        await vector_store.replace_document(contract_id, owner_id, passages)
    except Exception as exc:  # noqa: BLE001 - recorded for the UI instead
        logger.exception("Indexing failed for %s.", contract_id)
        await contracts.set_index_state(
            contract_id, owner_id, IndexStatus.FAILED, error=f"Could not prepare chat: {exc}"
        )
        return
    await contracts.set_index_state(
        contract_id, owner_id, IndexStatus.READY, passage_count=len(passages)
    )
    logger.info("Indexed %s: %d passages.", contract_id, len(passages))
