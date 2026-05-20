from fastapi import APIRouter, BackgroundTasks, Depends

from ..jobs import JobStore, run_placeholder_job
from ..models import AssetScanRequest, JobRecord
from .dependencies import get_job_store

router = APIRouter(prefix="/jobs/assets", tags=["assets"])


@router.post("/scan", response_model=JobRecord)
def create_asset_scan_job(
    payload: AssetScanRequest,
    background_tasks: BackgroundTasks,
    store: JobStore = Depends(get_job_store),
) -> JobRecord:
    job = store.create_job("assets.scan", "Queued local asset scan.")
    background_tasks.add_task(
        run_placeholder_job,
        store,
        job.id,
        {
            "folder": payload.folder,
            "scannedAssets": 0,
            "note": "Placeholder worker job. Use pnpm assets:scan for the current real scanner.",
        },
    )
    return job
