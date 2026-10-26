"""Starting an analysis and running it in the background."""

import asyncio
import logging
import uuid

from Backend.app.core.clock import parse_iso, utc_now
from Backend.app.core.config import settings
from Backend.app.core.errors import BadRequestError, NotFoundError
from Backend.app.models.contract import ContractStatus
from Backend.app.models.report import ContractReport
from Backend.app.prompts import analysis as prompts
from Backend.app.repositories import AnalysisRepository, ContractRepository
from Backend.app.schemas.analysis import InsightsResponse
from Backend.app.services.analysis.chunking import split_text
from Backend.app.services.analysis.merge import merge_checklists, merge_locally
from Backend.app.services.analysis.quotes import check_quotes
from Backend.app.services.llm import LLMError
from Backend.app.services.llm.providers import Provider, analysis_providers

logger = logging.getLogger(__name__)

STALE_MESSAGE = (
    "The analysis was interrupted before it finished, most likely because the server "
    "restarted. Start a new analysis to try again."
)
_MERGE_EXCERPT_CHARS = 20_000


# --- Running the model --------------------------------------------------------


async def _analyse_once(
    provider: Provider, text: str, *, part: int | None = None, parts: int | None = None
) -> ContractReport:
    return await provider.structured(
        prompts.contract_prompt(text, part=part, parts=parts), ContractReport, system=prompts.SYSTEM
    )


async def _merge(
    provider: Provider, partials: list[ContractReport], opening: str
) -> ContractReport:
    payload = "[" + ",".join(p.model_dump_json() for p in partials) + "]"
    try:
        merged = await provider.structured(
            prompts.merge_prompt(payload, opening),
            ContractReport,
            system=prompts.SYSTEM,
            max_output_tokens=provider.merge_max_output_tokens,
        )
    except LLMError as exc:
        logger.warning("Merge call failed (%s); merging locally.", exc)
        merged = merge_locally(partials)
    # The checklist is merged by rule, not by the model, so it is stable.
    merged.checklist = merge_checklists([p.checklist for p in partials])
    return merged


async def analyse_text(text: str, provider: Provider) -> ContractReport:
    """Analyse a contract with one provider, chunking it when it is too long."""
    chunks = split_text(text, provider.chunk_chars, provider.chunk_overlap_chars)
    if len(chunks) == 1:
        return await _analyse_once(provider, chunks[0].text)

    logger.info("Contract split into %d chunks for %s.", len(chunks), provider.name)
    limit = asyncio.Semaphore(provider.max_concurrent_chunks)

    async def run(index: int, chunk: str) -> ContractReport:
        async with limit:
            return await _analyse_once(provider, chunk, part=index + 1, parts=len(chunks))

    # A report missing whole sections would look complete while silently
    # omitting part of the contract, so any failed chunk fails the run.
    try:
        async with asyncio.TaskGroup() as group:
            tasks = [group.create_task(run(i, chunk.text)) for i, chunk in enumerate(chunks)]
    except* LLMError as failures:
        raise LLMError(
            f"Could not analyse {len(failures.exceptions)} of {len(chunks)} sections, so no "
            f"report was saved. {failures.exceptions[0]}"
        ) from None

    opening = chunks[0].text[:_MERGE_EXCERPT_CHARS]
    report = await _merge(provider, [task.result() for task in tasks], opening)
    report.chunk_count = len(chunks)
    return report


async def analyse_with_fallback(text: str) -> tuple[ContractReport, str]:
    """Try each configured provider in turn. Returns the report and the model used."""
    failures: list[str] = []
    for provider in analysis_providers():
        try:
            return await analyse_text(text, provider), provider.model
        except LLMError as exc:
            logger.warning("%s analysis failed: %s", provider.name, exc)
            failures.append(f"{provider.name}: {exc}")
    raise LLMError(" | ".join(failures))


# --- The service used by the routes -------------------------------------------


class AnalysisService:
    def __init__(self) -> None:
        self.contracts = ContractRepository()
        self.analyses = AnalysisRepository()

    async def start(self, contract_id: str, owner_id: str) -> str:
        """Claim a new run and return its id. The caller schedules ``run``."""
        text = await self.contracts.get_text(contract_id, owner_id)
        if text is None:
            raise NotFoundError("Contract not found.")
        if not text.strip():
            raise BadRequestError("This contract has no text to analyse. Re-upload it.")

        run_id = uuid.uuid4().hex
        await self.analyses.claim(
            contract_id, owner_id, run_id, settings.analysis.stale_analysis_seconds
        )
        await self.contracts.set_status(contract_id, owner_id, ContractStatus.ANALYZING)
        return run_id

    async def run(self, contract_id: str, owner_id: str, run_id: str) -> None:
        """Background job. Records success or failure - never raises."""
        try:
            text = await self.contracts.get_text(contract_id, owner_id)
            if not text:
                raise LLMError("The contract no longer exists or has no text.")
            report, model = await analyse_with_fallback(text)
            insights = check_quotes(report.model_dump(), text)
            outcome = ContractStatus.ANALYZED
            fields = {
                "status": outcome.value,
                "insights": insights,
                "chunk_count": report.chunk_count,
                "model": model,
                "error": None,
            }
        except Exception as exc:  # noqa: BLE001 - every failure must be recorded
            logger.exception("Analysis %s failed for contract %s.", run_id, contract_id)
            outcome = ContractStatus.FAILED
            message = (
                str(exc) if isinstance(exc, LLMError) else "The analysis hit an unexpected error."
            )
            fields = {"status": outcome.value, "insights": None, "error": message}

        if await self.analyses.finish(contract_id, owner_id, run_id, **fields):
            await self.contracts.set_status(contract_id, owner_id, outcome)
        else:
            logger.info("Run %s for %s was superseded; result discarded.", run_id, contract_id)

    async def insights(self, contract_id: str, owner_id: str) -> InsightsResponse:
        record = await self.analyses.get(contract_id, owner_id)
        if record is None:
            raise NotFoundError(
                "No analysis found for this contract. "
                f"Start one with POST /analysis/analyze/{contract_id}."
            )

        status, error = record.get("status"), record.get("error")
        started = parse_iso(record.get("started_at"))
        stale = (
            started
            and (utc_now() - started).total_seconds() > settings.analysis.stale_analysis_seconds
        )
        if status == ContractStatus.ANALYZING and stale:
            status, error = ContractStatus.FAILED.value, error or STALE_MESSAGE

        insights = record.get("insights") if status == ContractStatus.ANALYZED else None
        if insights and insights.get("risks") and "quote_check" not in insights["risks"][0]:
            # Reports saved before quote checking existed get checked on read.
            insights = check_quotes(
                insights, await self.contracts.get_text(contract_id, owner_id) or ""
            )

        return InsightsResponse(
            contract_id=contract_id,
            status=status,
            insights=insights,
            error=error,
            model=record.get("model"),
            chunk_count=record.get("chunk_count"),
            started_at=record.get("started_at"),
            completed_at=record.get("completed_at"),
        )
