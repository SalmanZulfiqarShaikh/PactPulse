from pydantic import BaseModel, Field

UPLOADED = "uploaded"
ANALYZING = "analyzing"
ANALYZED = "analyzed"
FAILED = "failed"


class Contract(BaseModel):
    """A stored contract and the text extracted from it."""

    contract_id: str = Field(..., description="Public identifier for the contract")
    # Every read and write is scoped to this. A contract without an owner_id is
    # invisible to every query, including the list endpoint, because the
    # ownership filter can never match a missing field against a real user id.
    owner_id: str = Field(..., description="user_id of the account that uploaded this contract")
    filename: str = Field(..., description="Name the file is stored under on disk")
    originalname: str = Field(..., description="Original name of the uploaded file")
    content_type: str | None = Field(default=None, description="MIME type reported by the client")
    size_bytes: int = Field(..., description="Size of the uploaded file in bytes")
    upload_date: str = Field(..., description="ISO-8601 timestamp of when the contract was uploaded")
    text_content: str = Field(..., description="Text extracted from the contract file")
    page_count: int = Field(..., description="Number of pages (estimated for DOCX)")
    word_count: int = Field(..., description="Number of words in the extracted text")
    status: str = Field(
        default=UPLOADED,
        description="Analysis status: 'uploaded', 'analyzing', 'analyzed' or 'failed'",
    )
