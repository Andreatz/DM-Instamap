from fastapi import APIRouter, BackgroundTasks, Depends

from ..jobs import JobStore, find_repo_root, run_image_analysis_job
from ..models import ImageAnalyzeRequest, JobRecord
from ..security import validate_local_path
from .dependencies import get_job_store

router = APIRouter(prefix="/jobs/images", tags=["images"])


@router.post("/analyze", response_model=JobRecord)
def create_image_analysis_job(
    payload: ImageAnalyzeRequest,
    background_tasks: BackgroundTasks,
    store: JobStore = Depends(get_job_store),
) -> JobRecord:
    image_path = validate_local_path(
        payload.imagePath, repo_root=find_repo_root(), must_exist=True
    )
    job = store.create_job("images.analyze", "Queued local image analysis.")
    background_tasks.add_task(run_image_analysis_job, store, job.id, image_path)
    return job
