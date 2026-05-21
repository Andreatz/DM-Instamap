from fastapi import APIRouter, BackgroundTasks, Depends

from ..jobs import JobStore, find_repo_root, run_reference_scan_job
from ..models import JobRecord, ReferenceScanRequest
from ..security import validate_local_path
from .dependencies import get_job_store

router = APIRouter(prefix="/jobs/references", tags=["references"])


@router.post("/scan", response_model=JobRecord)
def create_reference_scan_job(
    payload: ReferenceScanRequest,
    background_tasks: BackgroundTasks,
    store: JobStore = Depends(get_job_store),
) -> JobRecord:
    folder = validate_local_path(payload.folder, repo_root=find_repo_root())
    job = store.create_job("references.scan", "Queued local reference scan.")
    background_tasks.add_task(run_reference_scan_job, store, job.id, folder)
    return job
