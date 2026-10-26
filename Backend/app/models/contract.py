from enum import StrEnum

from pydantic import BaseModel, Field


class ContractStatus(StrEnum):
    UPLOADED = "uploaded"
    ANALYZING = "analyzing"
    ANALYZED = "analyzed"
    FAILED = "failed"


class TextSource(StrEnum):
    TEXT_LAYER = "text_layer"  # read straight from the file
    OCR = "ocr"  # a scanned PDF, transcribed by Gemini


class IndexStatus(StrEnum):
    """Whether the document is ready for chat."""

    NOT_INDEXED = "not_indexed"
    INDEXING = "indexing"
    READY = "ready"
    FAILED = "failed"


class Contract(BaseModel):
    contract_id: str
    # Every query filters on this, so a contract is invisible to other accounts.
    owner_id: str
    filename: str = Field(description="Name the file is stored under on disk")
    originalname: str
    content_type: str | None = None
    size_bytes: int
    upload_date: str
    text_content: str
    text_source: TextSource = TextSource.TEXT_LAYER
    page_count: int
    word_count: int
    status: ContractStatus = ContractStatus.UPLOADED
    index_status: IndexStatus = IndexStatus.NOT_INDEXED
    index_error: str | None = None
    passage_count: int = 0
