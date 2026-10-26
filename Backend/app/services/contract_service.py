"""Uploading, listing, reading and deleting contracts."""

import logging
import uuid
from pathlib import Path

import anyio
from fastapi import UploadFile

from Backend.app.core.clock import iso_now
from Backend.app.core.config import settings
from Backend.app.core.errors import BadRequestError, NotFoundError, PayloadTooLargeError
from Backend.app.models.contract import Contract
from Backend.app.repositories import AnalysisRepository, ChatRepository, ContractRepository
from Backend.app.schemas.contract import ContractList, ContractPreview, ContractSummary
from Backend.app.services.documents import DocumentParseError, extract_document
from Backend.app.services.rag import vector_store

logger = logging.getLogger(__name__)

_READ_CHUNK = 1024 * 1024
_PREVIEW_CHARS = 500


async def read_limited(file: UploadFile, max_bytes: int) -> bytes:
    """Read an upload, stopping as soon as it passes ``max_bytes``."""
    data = bytearray()
    while chunk := await file.read(_READ_CHUNK):
        data += chunk
        if len(data) > max_bytes:
            raise PayloadTooLargeError(
                f"File exceeds the maximum size of {settings.upload.max_file_size_mb} MB."
            )
    return bytes(data)


def _safe_stem(filename: str) -> str:
    stem = Path(filename).stem
    return "".join(c if c.isalnum() or c in "-_ " else "_" for c in stem)[:80] or "contract"


class ContractService:
    def __init__(self) -> None:
        self.contracts = ContractRepository()
        self.analyses = AnalysisRepository()
        self.chats = ChatRepository()

    async def upload(self, file: UploadFile, owner_id: str) -> Contract:
        cfg = settings.upload
        original_name = file.filename or ""
        suffix = Path(original_name).suffix.lower()
        if suffix not in cfg.allowed_extensions:
            raise BadRequestError(
                f"Invalid file type '{suffix or original_name}'. "
                f"Allowed types: {cfg.allowed_label}."
            )

        data = await read_limited(file, cfg.max_file_size)
        if not data:
            raise BadRequestError("The uploaded file is empty.")

        try:
            document = await extract_document(original_name, data)
        except DocumentParseError as exc:
            raise BadRequestError(str(exc)) from exc

        contract_id = uuid.uuid4().hex
        stored_name = f"{_safe_stem(original_name)}_{contract_id}{suffix}"
        await anyio.Path(cfg.upload_dir).mkdir(parents=True, exist_ok=True)
        await anyio.Path(cfg.upload_dir / stored_name).write_bytes(data)

        contract = Contract(
            contract_id=contract_id,
            owner_id=owner_id,
            filename=stored_name,
            originalname=original_name,
            content_type=file.content_type,
            size_bytes=len(data),
            upload_date=iso_now(),
            text_content=document.text,
            text_source=document.source,
            page_count=document.page_count,
            word_count=document.word_count,
        )
        await self.contracts.insert(contract)
        return contract

    async def list(self, owner_id: str, **filters) -> ContractList:
        rows, total = await self.contracts.search(owner_id, **filters)
        return ContractList(
            count=len(rows),
            total=total,
            limit=filters.get("limit"),
            skip=filters.get("skip", 0),
            contracts=[ContractSummary.model_validate(row) for row in rows],
        )

    async def get(self, contract_id: str, owner_id: str) -> dict:
        if (contract := await self.contracts.get(contract_id, owner_id)) is None:
            raise NotFoundError("Contract not found.")
        return contract

    async def preview(self, contract_id: str, owner_id: str) -> ContractPreview:
        contract = await self.get(contract_id, owner_id)
        analysis = await self.analyses.get(contract_id, owner_id)
        text = contract.get("text_content") or ""
        return ContractPreview.model_validate(
            {
                **contract,
                "analysis_status": analysis.get("status") if analysis else None,
                "preview": text[:_PREVIEW_CHARS],
                "preview_truncated": len(text) > _PREVIEW_CHARS,
            }
        )

    async def delete(self, contract_id: str, owner_id: str) -> None:
        """Delete the contract, its analysis, chat, vectors and stored file."""
        contract = await self.contracts.get(contract_id, owner_id, with_text=False)
        if contract is None:
            raise NotFoundError("Contract not found.")

        await self.contracts.delete(contract_id, owner_id)
        await self.analyses.delete(contract_id, owner_id)
        await self.chats.clear(contract_id, owner_id)
        await vector_store.delete_document(contract_id, owner_id)

        if filename := contract.get("filename"):
            # .name strips any path, so a stored value cannot escape the folder.
            path = anyio.Path(settings.upload.upload_dir / Path(filename).name)
            try:
                await path.unlink(missing_ok=True)
            except OSError as exc:
                logger.warning("Could not delete stored file for %s: %s", contract_id, exc)
