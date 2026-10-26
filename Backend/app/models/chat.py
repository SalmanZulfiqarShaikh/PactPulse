from enum import StrEnum

from pydantic import BaseModel, Field


class ChatRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"


class Citation(BaseModel):
    """A passage of the document an answer relied on, with its exact position."""

    passage: int = Field(description="Passage number, as cited in the answer text: [P3]")
    start: int
    end: int
    text: str


class ChatMessage(BaseModel):
    message_id: str
    contract_id: str
    owner_id: str
    role: ChatRole
    content: str
    citations: list[Citation] = Field(default_factory=list)
    # A reply made of search results only, because no AI model was available.
    search_only: bool = False
    created_at: str
