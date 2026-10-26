from fastapi import APIRouter, BackgroundTasks, Request, Response, status

from Backend.app.api.deps import CurrentUser
from Backend.app.core.client_ip import client_ip
from Backend.app.core.config import settings
from Backend.app.core.rate_limit import limiter
from Backend.app.schemas.chat import ChatReply, ChatRequest, ChatThread
from Backend.app.services.chat_service import ChatService
from Backend.app.services.rag.indexer import index_document
from Backend.app.services.usage_service import Action, charge

router = APIRouter(prefix="/contracts/{contract_id}/chat", tags=["chat"])


@router.get("", response_model=ChatThread)
async def get_chat(contract_id: str, user: CurrentUser, background: BackgroundTasks):
    """The conversation so far, and whether the document is ready for chat.

    Documents uploaded before chat existed are indexed on first visit.
    """
    service = ChatService()
    if await service.needs_index(contract_id, user.user_id):
        background.add_task(index_document, contract_id, user.user_id)
    return await service.thread(contract_id, user.user_id)


@router.post("", response_model=ChatReply)
@limiter.limit(settings.http.chat_rate_limit)
async def ask(
    request: Request, response: Response, contract_id: str, payload: ChatRequest, user: CurrentUser
):
    """Ask a question about the document. The answer cites passages as [P#].

    ``request`` and ``response`` are required by the rate limiter, which writes
    the X-RateLimit headers onto ``response``.
    """
    async with charge(client_ip(request), Action.CHAT):
        return await ChatService().ask(contract_id, user.user_id, payload.message.strip())


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def clear_chat(contract_id: str, user: CurrentUser) -> None:
    await ChatService().clear(contract_id, user.user_id)


@router.post("/reindex", status_code=status.HTTP_202_ACCEPTED, response_model=ChatThread)
async def reindex(contract_id: str, user: CurrentUser, background: BackgroundTasks):
    """Rebuild the document's search index, e.g. after a failure."""
    service = ChatService()
    thread = await service.thread(contract_id, user.user_id)
    background.add_task(index_document, contract_id, user.user_id)
    return thread
