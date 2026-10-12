"""Analysis orchestration: chunking, merging and persistence.

The route layer only claims a job and schedules ``run_analysis_job``; everything
about how a contract is analysed and recorded lives here.

Ownership: the job takes an ``owner_id`` and every read and write it performs is
filtered by it, so a background task can never touch another account's data even
if it were somehow handed a contract id belonging to someone else.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

from Backend.app.config import settings
from Backend.app.database import analysis_collection, contracts_collection
from Backend.app.models.contract import ANALYZED, FAILED
from Backend.app.models.insights import ContractInsights, KeyTerm, Obligation, RiskItem
from Backend.app.service.geminianalyze import AnalysisError, analyze_with_gemini, generate_report
from Backend.app.service.prompt import build_merge_prompt
from Backend.app.service.timeutil import iso_now, utc_now

logger = logging.getLogger(__name__)

_MERGE_EXCERPT_CHARS = 20_000

__all__ = [
    "AnalysisError",
    "STALE_MESSAGE",
    "analyze_text",
    "iso_now",
    "is_stale",
    "run_analysis_job",
    "split_into_chunks",
    "utc_now",
]


def split_into_chunks(text: str, limit: int, overlap: int) -> list[str]:
    """Split ``text`` into chunks of at most ``limit`` characters.

    Splits are made at paragraph boundaries wherever possible so that quoted
    clause text stays intact, with a small overlap so a clause straddling a
    boundary is still seen whole by at least one chunk.
    """
    if len(text) <= limit:
        return [text]

    chunks: list[str] = []
    start = 0

    while start < len(text):
        end = min(start + limit, len(text))

        if end < len(text):
            # Look for a paragraph break in the second half of the window; if
            # there is none (one enormous paragraph) fall back to a hard split.
            split_at = text.rfind("\n\n", start + limit // 2, end)
            if split_at != -1:
                end = split_at

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break

        start = max(end - overlap, start + 1)

    return chunks


def _merge_locally(partials: list[ContractInsights], chunk_count: int) -> ContractInsights:
    """Deterministically merge partial reports, without another model call.

    Used when the merge call itself fails, so a chunked contract still produces a
    usable report rather than nothing at all.
    """
    risks: list[RiskItem] = []
    seen_risks: set[tuple[str, str]] = set()
    terms: list[KeyTerm] = []
    seen_terms: set[str] = set()
    obligations: list[Obligation] = []
    seen_obligations: set[tuple[str, str]] = set()
    bullets: list[str] = []
    seen_bullets: set[str] = set()

    for partial in partials:
        for risk in partial.risks:
            key = (risk.title.strip().lower(), risk.clause_text[:80].strip().lower())
            if key not in seen_risks:
                seen_risks.add(key)
                risks.append(risk)

        for term in partial.key_terms:
            if term.term.strip().lower() not in seen_terms:
                seen_terms.add(term.term.strip().lower())
                terms.append(term)

        for obligation in partial.obligations:
            key = (obligation.party.strip().lower(), obligation.obligation.strip().lower())
            if key not in seen_obligations:
                seen_obligations.add(key)
                obligations.append(obligation)

        for bullet in partial.what_this_means:
            if bullet.strip().lower() not in seen_bullets:
                seen_bullets.add(bullet.strip().lower())
                bullets.append(bullet)

    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    risks.sort(key=lambda r: severity_order.get(r.severity, 4))

    first = partials[0]
    # There is no model here to write a real summary of the whole contract, so
    # the partial openings are joined and labelled rather than passed off as a
    # single coherent tldr.
    tldr = " ".join(p.tldr.strip() for p in partials if p.tldr.strip())

    return ContractInsights(
        tldr=tldr,
        what_this_means=bullets,
        contract_type=first.contract_type,
        parties=first.parties,
        effective_date=first.effective_date,
        governing_law=first.governing_law,
        key_terms=terms,
        obligations=obligations,
        risks=risks,
        chunk_count=chunk_count,
    )


async def _merge_reports(
    partials: list[ContractInsights],
    opening_excerpt: str,
    chunk_count: int,
) -> ContractInsights:
    """Merge partial reports with a model call, falling back to a local merge."""
    payload = json.dumps([p.model_dump() for p in partials], indent=2)

    try:
        # The merge writes one report covering the whole contract, so it gets a
        # larger output budget than a single-pass analysis. Sharing one cap is
        # what used to push long contracts into the local fallback.
        merged = await generate_report(
            build_merge_prompt(payload, opening_excerpt),
            max_output_tokens=settings.gemini_merge_max_output_tokens,
        )
        merged.chunk_count = chunk_count
        return merged
    except AnalysisError as exc:
        logger.warning("Merge call failed (%s); falling back to local merge.", exc)
        return _merge_locally(partials, chunk_count)


async def analyze_text(text: str) -> ContractInsights:
    """Analyse contract text, chunking and merging it when it is too long."""
    chunks = split_into_chunks(text, settings.chunk_chars, settings.chunk_overlap_chars)

    if len(chunks) == 1:
        return await analyze_with_gemini(chunks[0])

    logger.info("Contract split into %d chunks for analysis.", len(chunks))

    # Bounded concurrency: sending dozens of requests at once invites 429s.
    semaphore = asyncio.Semaphore(settings.max_concurrent_chunks)

    async def run(index: int, chunk: str) -> ContractInsights:
        async with semaphore:
            return await analyze_with_gemini(chunk, chunk_index=index, chunk_total=len(chunks))

    # return_exceptions=True so one section failing does not abandon the others
    # mid-flight; gather then lets every chunk finish and we decide afterwards.
    results = await asyncio.gather(
        *(run(i, c) for i, c in enumerate(chunks)),
        return_exceptions=True,
    )

    partials: list[ContractInsights] = []
    failed_sections: list[str] = []

    for index, result in enumerate(results):
        if isinstance(result, BaseException):
            failed_sections.append(str(index + 1))
            logger.error("Chunk %d/%d failed: %s", index + 1, len(chunks), result)
        else:
            partials.append(result)

    # A report built from only some of the sections would look complete while
    # silently omitting whole parts of the contract - the worst possible outcome
    # for a legal risk review, because the reader cannot tell it happened. Fail
    # loudly instead and let the caller retry.
    if failed_sections:
        raise AnalysisError(
            "Could not analyse section(s) "
            f"{', '.join(failed_sections)} of {len(chunks)} of this contract. "
            "The report would be incomplete, so it was not saved. Try again."
        )

    return await _merge_reports(partials, chunks[0][:_MERGE_EXCERPT_CHARS], len(chunks))


def _record_success(contract_id: str, owner_id: str, insights: ContractInsights) -> None:
    analysis_collection.update_one(
        {"contract_id": contract_id, "owner_id": owner_id},
        {
            "$set": {
                "status": ANALYZED,
                "insights": insights.model_dump(),
                "chunk_count": insights.chunk_count,
                "model": settings.gemini_model,
                "error": None,
                "completed_at": iso_now(),
            }
        },
        upsert=True,
    )
    contracts_collection.update_one(
        {"contract_id": contract_id, "owner_id": owner_id}, {"$set": {"status": ANALYZED}}
    )


def _record_failure(contract_id: str, owner_id: str, error: str) -> None:
    analysis_collection.update_one(
        {"contract_id": contract_id, "owner_id": owner_id},
        {
            "$set": {
                "status": FAILED,
                "insights": None,
                "error": error,
                "completed_at": iso_now(),
            }
        },
        upsert=True,
    )
    contracts_collection.update_one(
        {"contract_id": contract_id, "owner_id": owner_id}, {"$set": {"status": FAILED}}
    )


async def run_analysis_job(contract_id: str, owner_id: str) -> None:
    """Background job: analyse a stored contract and record the outcome.

    ``owner_id`` is threaded through from the request that scheduled the job and
    used in every query, so the task cannot read or write across accounts.
    """
    try:
        contract = contracts_collection.find_one(
            {"contract_id": contract_id, "owner_id": owner_id}, {"_id": 0}
        )

        if not contract:
            raise AnalysisError(f"Contract '{contract_id}' no longer exists.")

        text = (contract.get("text_content") or "").strip()
        if not text:
            raise AnalysisError("Contract has no extracted text to analyse.")

        insights = await analyze_text(text)
        _record_success(contract_id, owner_id, insights)
        logger.info("Analysis complete for contract %s.", contract_id)

    except Exception as exc:  # noqa: BLE001 - the job must record any failure
        logger.exception("Analysis failed for contract %s.", contract_id)
        _record_failure(contract_id, owner_id, str(exc))


def is_stale(analysis: dict) -> bool:
    """Has an 'analyzing' job been running for implausibly long?

    BackgroundTasks run in-process, so a restart or crash mid-job would
    otherwise leave the document stuck at 'analyzing' forever.
    """
    started_at = analysis.get("started_at")
    if not started_at:
        return False

    try:
        started = datetime.fromisoformat(started_at)
    except (TypeError, ValueError):
        return False

    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)

    return utc_now() - started > timedelta(seconds=settings.stale_analysis_seconds)


STALE_MESSAGE = (
    "The analysis was interrupted before it finished, most likely because the "
    "server restarted. Start a new analysis to try again."
)
