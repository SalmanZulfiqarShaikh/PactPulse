"""Chat threads: one per document, stored so the conversation can go on indefinitely."""

import uuid

from Backend.app.core.clock import iso_now
from Backend.app.core.config import settings
from Backend.app.core.errors import ConflictError, NotFoundError
from Backend.app.models.chat import ChatMessage, ChatRole, Citation
from Backend.app.models.contract import IndexStatus
from Backend.app.prompts.chat import DocumentInfo
from Backend.app.repositories import ChatRepository, ContractRepository
from Backend.app.schemas.chat import ChatMessageOut, ChatReply, ChatThread
from Backend.app.services.rag.agent import answer_question
from Backend.app.services.rag.splitter import split_passages
from Backend.app.services.rag.tools import DocumentToolbox


def _out(message: ChatMessage) -> ChatMessageOut:
    return ChatMessageOut.model_validate(message.model_dump())


class ChatService:
    def __init__(self) -> None:
        self.contracts = ContractRepository()
        self.chats = ChatRepository()

    async def _contract(self, contract_id: str, owner_id: str) -> dict:
        contract = await self.contracts.get(contract_id, owner_id)
        if contract is None:
            raise NotFoundError("Contract not found.")
        return contract

    async def thread(self, contract_id: str, owner_id: str) -> ChatThread:
        contract = await self._contract(contract_id, owner_id)
        messages = await self.chats.history(contract_id, owner_id)
        return ChatThread(
            contract_id=contract_id,
            index_status=contract.get("index_status") or IndexStatus.NOT_INDEXED,
            index_error=contract.get("index_error"),
            messages=[_out(m) for m in messages],
        )

    async def needs_index(self, contract_id: str, owner_id: str) -> bool:
        """True for documents uploaded before chat existed (never indexed)."""
        contract = await self._contract(contract_id, owner_id)
        return (contract.get("index_status") or IndexStatus.NOT_INDEXED) == IndexStatus.NOT_INDEXED

    async def ask(self, contract_id: str, owner_id: str, question: str) -> ChatReply:
        contract = await self._contract(contract_id, owner_id)
        if contract.get("index_status") != IndexStatus.READY:
            raise ConflictError(
                "This document is still being prepared for chat. Try again in a moment."
            )

        history = await self.chats.history(
            contract_id, owner_id, last=settings.rag.chat_history_messages
        )
        # Search-only replies are not real answers; the model should not see
        # them as something it said.
        history = [m for m in history if not m.search_only]
        text = contract.get("text_content") or ""
        toolbox = DocumentToolbox(contract_id, owner_id, text, split_passages(text))
        document = DocumentInfo(
            title=contract.get("originalname") or "document",
            page_count=contract.get("page_count"),
        )
        answer = await answer_question(question, history, toolbox, document)

        asked = self._message(contract_id, owner_id, ChatRole.USER, question)
        replied = self._message(
            contract_id, owner_id, ChatRole.ASSISTANT, answer.text, answer.citations
        )
        replied.search_only = answer.search_only
        await self.chats.add(asked)
        await self.chats.add(replied)
        return ChatReply(question=_out(asked), answer=_out(replied))

    async def clear(self, contract_id: str, owner_id: str) -> None:
        await self._contract(contract_id, owner_id)
        await self.chats.clear(contract_id, owner_id)

    @staticmethod
    def _message(
        contract_id: str,
        owner_id: str,
        role: ChatRole,
        content: str,
        citations: list[Citation] | None = None,
    ) -> ChatMessage:
        return ChatMessage(
            message_id=uuid.uuid4().hex,
            contract_id=contract_id,
            owner_id=owner_id,
            role=role,
            content=content,
            citations=citations or [],
            created_at=iso_now(),
        )
