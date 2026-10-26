from pydantic import BaseModel, Field

from Backend.app.models.chat import ChatRole, Citation
from Backend.app.models.contract import IndexStatus


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4_000)


class ChatMessageOut(BaseModel):
    message_id: str
    role: ChatRole
    content: str
    citations: list[Citation] = Field(default_factory=list)
    search_only: bool = False
    created_at: str


class ChatThread(BaseModel):
    contract_id: str
    index_status: IndexStatus
    index_error: str | None = None
    messages: list[ChatMessageOut]


class ChatReply(BaseModel):
    question: ChatMessageOut
    answer: ChatMessageOut
