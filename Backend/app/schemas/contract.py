from pydantic import BaseModel

from Backend.app.models.contract import ContractStatus, IndexStatus, TextSource


class ContractSummary(BaseModel):
    """A contract without its (potentially large) text."""

    contract_id: str
    filename: str
    originalname: str
    content_type: str | None = None
    size_bytes: int
    upload_date: str
    page_count: int
    word_count: int
    status: ContractStatus
    text_source: TextSource = TextSource.TEXT_LAYER
    index_status: IndexStatus = IndexStatus.NOT_INDEXED


class ContractDetail(ContractSummary):
    text_content: str


class UploadResponse(ContractDetail):
    message: str = "Contract uploaded and parsed successfully."


class ContractPreview(ContractSummary):
    analysis_status: str | None = None
    preview: str
    preview_truncated: bool


class ContractList(BaseModel):
    count: int
    total: int
    limit: int | None
    skip: int
    contracts: list[ContractSummary]


class DeleteResponse(BaseModel):
    message: str = "Contract deleted."
    contract_id: str
