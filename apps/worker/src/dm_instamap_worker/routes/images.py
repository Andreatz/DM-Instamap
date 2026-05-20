from fastapi import APIRouter, BackgroundTasks, Depends

from ..jobs import JobStore, run_placeholder_job
from ..models import ImageAnalyzeRequest, JobRecord
from .dependencies import get_job_store

router = APIRouter(prefix="/jobs/images", tags=["images"])


@router.post("/analyze", response_model=JobRecord)
def create_image_analysis_job(
    payload: ImageAnalyzeRequest,
    background_tasks: BackgroundTasks,
    store: JobStore = Depends(get_job_store),
) -> JobRecord:
    job = store.create_job("images.analyze", "Queued local image analysis.")
    background_tasks.add_task(
        run_placeholder_job,
        store,
        job.id,
        {
            "imagePath": payload.imagePath,
            "analysis": {
                "dominantColors": [],
                "transparency": None,
                "width": None,
                "height": None,
            },
            "note": "Placeholder worker job. Detailed analysis remains local and will be wired later.",
        },
    )
    return job
