from fastapi import APIRouter, BackgroundTasks, Depends

from ..jobs import JobStore, run_reference_scan_job
from ..models import JobRecord, ReferenceScanRequest
from .dependencies import get_job_store

router = APIRouter(prefix="/jobs/references", tags=["references"])


@router.post("/scan", response_model=JobRecord)
def create_reference_scan_job(
    payload: ReferenceScanRequest,
    background_tasks: BackgroundTasks,
    store: JobStore = Depends(get_job_store),
) -> JobRecord:
    job = store.create_job("references.scan", "Queued local reference scan.")
    background_tasks.add_task(run_reference_scan_job, store, job.id, payload.folder)
    return job
