from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, Query, Request, UploadFile, status

from Backend.app.api.deps import CurrentUser
from Backend.app.core.client_ip import client_ip
from Backend.app.schemas.contract import (
    ContractDetail,
    ContractList,
    ContractPreview,
    DeleteResponse,
    UploadResponse,
)
from Backend.app.services.contract_service import ContractService
from Backend.app.services.rag.indexer import index_document
from Backend.app.services.usage_service import Action, charge

router = APIRouter(prefix="/contracts", tags=["contracts"])


@router.post("/upload", status_code=status.HTTP_201_CREATED, response_model=UploadResponse)
async def upload_contract(
    request: Request,
    user: CurrentUser,
    background: BackgroundTasks,
    file: Annotated[UploadFile, File()],
):
    """Upload a PDF, DOCX or TXT and extract its text (scanned PDFs go through OCR).

    The document is then indexed for chat in the background.
    """
    async with charge(client_ip(request), Action.UPLOAD):
        contract = await ContractService().upload(file, user.user_id)
    background.add_task(index_document, contract.contract_id, user.user_id)
    return UploadResponse.model_validate(contract.model_dump())


@router.get("", response_model=ContractList)
async def list_contracts(
    user: CurrentUser,
    search: Annotated[str | None, Query(description="Matches the original filename.")] = None,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    limit: Annotated[int | None, Query(ge=1, le=200)] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
):
    return await ContractService().list(
        user.user_id, search=search, status=status_filter, limit=limit, skip=skip
    )


@router.get("/{contract_id}/summary", response_model=ContractPreview)
async def contract_summary(contract_id: str, user: CurrentUser):
    return await ContractService().preview(contract_id, user.user_id)


@router.get("/{contract_id}", response_model=ContractDetail)
async def get_contract(contract_id: str, user: CurrentUser):
    return await ContractService().get(contract_id, user.user_id)


@router.delete("/{contract_id}", response_model=DeleteResponse)
async def delete_contract(contract_id: str, user: CurrentUser):
    """Irreversible: the contract, its analysis, chat history, vectors and file."""
    await ContractService().delete(contract_id, user.user_id)
    return DeleteResponse(contract_id=contract_id)
