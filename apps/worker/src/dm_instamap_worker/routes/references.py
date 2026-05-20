from fastapi import APIRouter, BackgroundTasks, Depends

from ..jobs import JobStore, run_placeholder_job
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
    background_tasks.add_task(
        run_placeholder_job,
        store,
        job.id,
        {
            "folder": payload.folder,
            "scannedReferences": 0,
            "note": "Placeholder worker job. Use pnpm references:scan for the current real scanner.",
        },
    )
    return job
