from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

from Backend.app.auth import CurrentUser, get_current_user
from Backend.app.config import settings
from Backend.app.database import analysis_collection, contracts_collection
from Backend.app.models.contract import ANALYZED, ANALYZING
from Backend.app.service.analysis_service import (
    STALE_MESSAGE,
    iso_now,
    is_stale,
    run_analysis_job,
    utc_now,
)

router = APIRouter(prefix="/analysis", tags=["analysis"])

# Same reasoning as in the contract routes: scoping the lookup by owner turns
# "someone else's contract" into the identical 404 as "no such contract".
_NOT_FOUND = "Contract not found."


@router.post("/analyze/{contract_id}", status_code=status.HTTP_202_ACCEPTED)
async def analyze_contract(
    contract_id: str,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
):
    """Start an analysis job for one of the caller's contracts.

    Returns immediately with 202; poll ``GET /analysis/{contract_id}/insights``
    for the result. Only the owner can start an analysis, so this cannot be used
    to make the server spend Gemini quota on someone else's contract.
    """
    contract = contracts_collection.find_one(
        {"contract_id": contract_id, "owner_id": user.user_id}, {"_id": 0}
    )

    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)

    if not (contract.get("text_content") or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Contract text content is empty, so there is nothing to analyse. "
                "Re-upload the contract to have its text extracted."
            ),
        )

    stale_cutoff = (
        utc_now() - timedelta(seconds=settings.stale_analysis_seconds)
    ).isoformat()

    try:
        analysis_collection.update_one(
            {
                "contract_id": contract_id,
                "owner_id": user.user_id,
                "$or": [
                    {"status": {"$ne": ANALYZING}},
                    {"started_at": {"$lt": stale_cutoff}},
                ],
            },
            {
                "$set": {
                    "status": ANALYZING,
                    "started_at": iso_now(),
                    "insights": None,
                    "error": None,
                }
            },
            upsert=True,
        )
    except DuplicateKeyError:
        # The document exists and is already being analysed.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An analysis is already in progress for this contract.",
        ) from None

    # owner_id travels with the job so every query it makes stays inside this
    # account.
    background_tasks.add_task(run_analysis_job, contract_id, user.user_id)

    return {
        "message": "Analysis started.",
        "contract_id": contract_id,
        "status": ANALYZING,
        "poll": f"/analysis/{contract_id}/insights",
    }


@router.get("/{contract_id}/insights")
async def get_insights(contract_id: str, user: CurrentUser = Depends(get_current_user)):
    """Return the analysis status and, once finished, the report.

    Always responds 200 while an analysis is running so a client can poll this
    endpoint on a fixed interval.
    """
    analysis = analysis_collection.find_one(
        {"contract_id": contract_id, "owner_id": user.user_id}, {"_id": 0}
    )

    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No analysis found for this contract. "
                f"Start one with POST /analysis/analyze/{contract_id}."
            ),
        )

    current_status = analysis.get("status")
    error = analysis.get("error")

    if current_status == ANALYZING and is_stale(analysis):
        current_status = "failed"
        error = error or STALE_MESSAGE

    return {
        "contract_id": contract_id,
        "status": current_status,
        # Stored reports are returned exactly as recorded, without re-validation
        # against the current model. That is what keeps reports written before
        # the plain-language rewrite readable: they still carry `summary` and
        # `explanation` instead of `tldr` and `plain_explanation`, and they load
        # unchanged rather than failing validation.
        "insights": analysis.get("insights") if current_status == ANALYZED else None,
        "error": error,
        "model": analysis.get("model"),
        "chunk_count": analysis.get("chunk_count"),
        "started_at": analysis.get("started_at"),
        "completed_at": analysis.get("completed_at"),
    }
