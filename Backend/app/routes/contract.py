import logging
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from Backend.app.auth import CurrentUser, get_current_user
from Backend.app.config import settings
from Backend.app.database import analysis_collection, contracts_collection
from Backend.app.models.contract import Contract, UPLOADED
from Backend.app.service.document_parser import DocumentParseError, extract_contract
from Backend.app.service.timeutil import iso_now

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contracts", tags=["contracts"])

# Preview length returned by the summary endpoint.
_PREVIEW_CHARS = 500

# Every lookup below is scoped by owner. A contract belonging to another account
# simply does not match, so the caller gets the same 404 they would get for an
# id that does not exist - which stops contract ids being probed for existence.
# Returning 403 instead would confirm that an id is real.
_NOT_FOUND = "Contract not found."


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_contract(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    """Upload a contract, extract its text, and return it for immediate viewing.

    The contract is stamped with the caller's ``owner_id`` and is never visible
    to any other account.
    """
    original_name = file.filename or ""
    suffix = Path(original_name).suffix.lower()

    if suffix not in settings.allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid file type '{suffix or original_name}'. "
                f"Allowed types: {settings.allowed_extensions_label}."
            ),
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    # UploadFile.size is usually None, so measure the bytes actually read.
    if len(content) > settings.max_file_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds the maximum size of {settings.max_file_size // (1024 * 1024)} MB.",
        )

    contract_id = uuid.uuid4().hex
    stored_name = f"{Path(original_name).stem}_{contract_id}{suffix}"

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = settings.upload_dir / stored_name
    file_path.write_bytes(content)

    try:
        text, page_count, word_count = extract_contract(file_path)
    except DocumentParseError as exc:
        # Don't keep a file we cannot read.
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    contract = Contract(
        contract_id=contract_id,
        owner_id=user.user_id,
        filename=stored_name,
        originalname=original_name,
        content_type=file.content_type,
        size_bytes=len(content),
        upload_date=iso_now(),
        text_content=text,
        page_count=page_count,
        word_count=word_count,
        status=UPLOADED,
    )

    contracts_collection.insert_one(contract.model_dump())

    return {
        "message": "Contract uploaded and parsed successfully.",
        "contract_id": contract_id,
        "filename": stored_name,
        "originalname": original_name,
        "size_bytes": len(content),
        "page_count": page_count,
        "word_count": word_count,
        "status": UPLOADED,
        "upload_date": contract.upload_date,
        "text_content": text,
    }


@router.get("")
async def list_contracts(
    user: CurrentUser = Depends(get_current_user),
    search: str | None = Query(
        default=None,
        description="Case-insensitive match against the original filename.",
    ),
    status_filter: str | None = Query(
        default=None,
        alias="status",
        description="Only return contracts in this analysis status.",
    ),
    limit: int | None = Query(
        default=None,
        ge=1,
        le=200,
        description="Maximum number of contracts to return. Omit to return every match.",
    ),
    skip: int = Query(default=0, ge=0, description="Number of matches to skip."),
):
    """List the caller's contracts, newest first.

    Only contracts owned by the authenticated account are returned; there is no
    way to ask for anyone else's. The extracted text is excluded here because it
    is large and available from the single-contract endpoint. ``total`` is the
    number of matches before ``limit`` and ``skip`` are applied, so a client can
    paginate without a second request.
    """
    # Owner first, then the optional filters. An ownerless legacy row can never
    # match this, so it stays invisible until it is assigned an owner.
    query: dict = {"owner_id": user.user_id}

    if search and search.strip():
        # re.escape so a filename containing regex metacharacters is matched
        # literally rather than being interpreted as a pattern.
        query["originalname"] = {"$regex": re.escape(search.strip()), "$options": "i"}

    if status_filter and status_filter.strip():
        query["status"] = status_filter.strip()

    total = contracts_collection.count_documents(query)

    # upload_date is an ISO-8601 UTC string written by iso_now(), so a lexical
    # sort is the same as a chronological one.
    cursor = (
        contracts_collection.find(query, {"_id": 0, "text_content": 0})
        .sort("upload_date", -1)
        .skip(skip)
    )

    if limit is not None:
        cursor = cursor.limit(limit)

    contracts = list(cursor)

    return {
        "count": len(contracts),
        "total": total,
        "limit": limit,
        "skip": skip,
        "contracts": contracts,
    }


@router.get("/{contract_id}/summary")
async def contract_summary(contract_id: str, user: CurrentUser = Depends(get_current_user)):
    """Return metadata and a short preview for one contract.

    Scoped to the caller, so another account's contract is a 404.
    """
    contract = contracts_collection.find_one(
        {"contract_id": contract_id, "owner_id": user.user_id}, {"_id": 0}
    )

    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)

    analysis = analysis_collection.find_one(
        {"contract_id": contract_id, "owner_id": user.user_id}, {"_id": 0}
    )

    text = contract.get("text_content") or ""

    return {
        "contract_id": contract_id,
        "filename": contract.get("filename"),
        "originalname": contract.get("originalname"),
        "upload_date": contract.get("upload_date"),
        "page_count": contract.get("page_count"),
        "word_count": contract.get("word_count"),
        "size_bytes": contract.get("size_bytes"),
        "status": contract.get("status"),
        "analysis_status": analysis.get("status") if analysis else None,
        "preview": text[:_PREVIEW_CHARS],
        "preview_truncated": len(text) > _PREVIEW_CHARS,
    }


@router.get("/{contract_id}")
async def get_contract(contract_id: str, user: CurrentUser = Depends(get_current_user)):
    """Return a single contract, including its extracted text."""
    contract = contracts_collection.find_one(
        {"contract_id": contract_id, "owner_id": user.user_id}, {"_id": 0}
    )

    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)

    return contract


@router.delete("/{contract_id}")
async def delete_contract(contract_id: str, user: CurrentUser = Depends(get_current_user)):
    """Delete a contract, its analysis and its stored file. Owner only.

    Destructive and irreversible: the uploaded file is removed from disk too, so
    re-analysis is not possible afterwards. Confidential documents need a way to
    be taken off the server, so this is the one operation with no undo.
    """
    contract = contracts_collection.find_one(
        {"contract_id": contract_id, "owner_id": user.user_id}, {"_id": 0}
    )

    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)

    # owner_id is repeated in the delete filters so that even a race in which the
    # contract changed hands between the read above and here cannot delete
    # another account's data or its analysis.
    contracts_collection.delete_one({"contract_id": contract_id, "owner_id": user.user_id})
    # Without this the analysis would outlive its contract and keep being
    # returned by GET /analysis/{id}/insights.
    analysis_collection.delete_one({"contract_id": contract_id, "owner_id": user.user_id})

    filename = contract.get("filename")
    if filename:
        # .name strips any path component, so a stored value can never escape
        # the upload directory.
        try:
            (settings.upload_dir / Path(filename).name).unlink(missing_ok=True)
        except OSError as exc:
            # The record is already gone; a locked or missing file is not worth
            # failing the request over.
            logger.warning("Could not delete stored file for %s: %s", contract_id, exc)

    logger.info("User %s deleted contract %s", user.user_id, contract_id)

    return {"message": "Contract deleted.", "contract_id": contract_id}
