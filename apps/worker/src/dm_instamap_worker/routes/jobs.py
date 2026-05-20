from fastapi import APIRouter, Depends, HTTPException

from ..jobs import JobNotFoundError, JobStore
from ..models import JobRecord
from .dependencies import get_job_store

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobRecord])
def list_jobs(store: JobStore = Depends(get_job_store)) -> list[JobRecord]:
    return store.list_jobs()


@router.get("/{job_id}", response_model=JobRecord)
def get_job(job_id: str, store: JobStore = Depends(get_job_store)) -> JobRecord:
    try:
        return store.get_job(job_id)
    except JobNotFoundError as error:
        raise HTTPException(status_code=404, detail="Job not found.") from error


@router.post("/{job_id}/cancel", response_model=JobRecord)
def cancel_job(job_id: str, store: JobStore = Depends(get_job_store)) -> JobRecord:
    try:
        return store.cancel_job(job_id)
    except JobNotFoundError as error:
        raise HTTPException(status_code=404, detail="Job not found.") from error
