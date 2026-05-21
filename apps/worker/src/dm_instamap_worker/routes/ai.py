from fastapi import APIRouter, BackgroundTasks, Depends

from ..jobs import JobStore, run_ai_plan_job
from ..models import AiPlanRequest, JobRecord
from .dependencies import get_job_store

router = APIRouter(prefix="/jobs/ai", tags=["ai"])


@router.post("/plan", response_model=JobRecord)
def create_ai_plan_job(
    payload: AiPlanRequest,
    background_tasks: BackgroundTasks,
    store: JobStore = Depends(get_job_store),
) -> JobRecord:
    job = store.create_job("ai.plan", "Queued AI plan generation.")
    background_tasks.add_task(
        run_ai_plan_job,
        store,
        job.id,
        user_request=payload.userRequest,
        max_retries=payload.maxRetries,
    )
    return job
