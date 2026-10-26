from pydantic import BaseModel


class AnalysisStarted(BaseModel):
    message: str = "Analysis started."
    contract_id: str
    status: str
    poll: str


class InsightsResponse(BaseModel):
    contract_id: str
    status: str
    # Returned as stored rather than re-validated, so reports written in an
    # older format keep loading.
    insights: dict | None = None
    error: str | None = None
    model: str | None = None
    chunk_count: int | None = None
    started_at: str | None = None
    completed_at: str | None = None
