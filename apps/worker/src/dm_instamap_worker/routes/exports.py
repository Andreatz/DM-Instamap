from fastapi import APIRouter, BackgroundTasks, Depends

from ..jobs import JobStore, find_repo_root, run_exports_session_pack_job
from ..models import ExportsSessionPackRequest, JobRecord
from ..security import validate_local_path
from .dependencies import get_job_store

router = APIRouter(prefix="/jobs/exports", tags=["exports"])


@router.post("/session-pack", response_model=JobRecord)
def create_session_pack_job(
    payload: ExportsSessionPackRequest,
    background_tasks: BackgroundTasks,
    store: JobStore = Depends(get_job_store),
) -> JobRecord:
    output = (
        validate_local_path(payload.output, repo_root=find_repo_root())
        if payload.output
        else payload.output
    )
    job = store.create_job("exports.session-pack", "Queued session pack export.")
    background_tasks.add_task(
        run_exports_session_pack_job,
        store,
        job.id,
        project_id=payload.projectId,
        scale=payload.scale,
        description=payload.description,
        include_initiative=payload.includeInitiative,
        image_format=payload.imageFormat,
        include_grid=payload.includeGrid,
        output=output,
    )
    return job
