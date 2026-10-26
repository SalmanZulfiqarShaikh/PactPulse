from fastapi import APIRouter, BackgroundTasks, Request, status

from Backend.app.api.deps import CurrentUser
from Backend.app.core.client_ip import client_ip
from Backend.app.models.contract import ContractStatus
from Backend.app.schemas.analysis import AnalysisStarted, InsightsResponse
from Backend.app.services.analysis.service import AnalysisService
from Backend.app.services.usage_service import Action, charge

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post(
    "/analyze/{contract_id}", status_code=status.HTTP_202_ACCEPTED, response_model=AnalysisStarted
)
async def analyze_contract(
    request: Request, contract_id: str, user: CurrentUser, background: BackgroundTasks
):
    """Start an analysis. Returns at once; poll the insights endpoint for the result."""
    service = AnalysisService()
    async with charge(client_ip(request), Action.ANALYSIS):
        run_id = await service.start(contract_id, user.user_id)
    background.add_task(service.run, contract_id, user.user_id, run_id)
    return AnalysisStarted(
        contract_id=contract_id,
        status=ContractStatus.ANALYZING,
        poll=f"/analysis/{contract_id}/insights",
    )


@router.get("/{contract_id}/insights", response_model=InsightsResponse)
async def get_insights(contract_id: str, user: CurrentUser):
    """Status and, once finished, the report. Safe to poll."""
    return await AnalysisService().insights(contract_id, user.user_id)
