from pydantic import BaseModel

from Backend.app.models.contract import ContractStatus


class Analysis(BaseModel):
    """One analysis record per contract, overwritten by each new run."""

    contract_id: str
    owner_id: str
    status: ContractStatus
    # A fresh id per run. A job only writes its result if its run_id is still
    # the current one, so a slow job cannot overwrite a newer run.
    run_id: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    insights: dict | None = None
    error: str | None = None
    model: str | None = None
    chunk_count: int | None = None
