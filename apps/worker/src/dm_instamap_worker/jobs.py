from __future__ import annotations

from threading import RLock
from typing import Any
from uuid import uuid4

from .models import JobRecord, JobStatus, utc_now_iso


class JobNotFoundError(KeyError):
    pass


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, JobRecord] = {}
        self._lock = RLock()

    def list_jobs(self) -> list[JobRecord]:
        with self._lock:
            return sorted(self._jobs.values(), key=lambda job: job.createdAt, reverse=True)

    def create_job(self, job_type: str, message: str) -> JobRecord:
        now = utc_now_iso()
        job = JobRecord(
            id=f"job_{uuid4().hex[:12]}",
            type=job_type,
            status=JobStatus.queued,
            progress=0,
            message=message,
            createdAt=now,
            updatedAt=now,
        )

        with self._lock:
            self._jobs[job.id] = job

        return job

    def get_job(self, job_id: str) -> JobRecord:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                raise JobNotFoundError(job_id)
            return job

    def update_job(
        self,
        job_id: str,
        *,
        status: JobStatus | None = None,
        progress: int | None = None,
        message: str | None = None,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> JobRecord:
        with self._lock:
            job = self.get_job(job_id)
            if job.status == JobStatus.cancelled:
                return job

            updated = job.model_copy(
                update={
                    "status": status if status is not None else job.status,
                    "progress": progress if progress is not None else job.progress,
                    "message": message if message is not None else job.message,
                    "result": result if result is not None else job.result,
                    "error": error if error is not None else job.error,
                    "updatedAt": utc_now_iso(),
                }
            )
            self._jobs[job_id] = updated
            return updated

    def cancel_job(self, job_id: str) -> JobRecord:
        with self._lock:
            job = self.get_job(job_id)
            if job.status in {JobStatus.completed, JobStatus.failed, JobStatus.cancelled}:
                return job

            updated = job.model_copy(
                update={
                    "status": JobStatus.cancelled,
                    "progress": job.progress,
                    "message": "Job cancelled.",
                    "updatedAt": utc_now_iso(),
                }
            )
            self._jobs[job_id] = updated
            return updated


def run_placeholder_job(store: JobStore, job_id: str, result: dict[str, Any]) -> None:
    try:
        store.update_job(
            job_id,
            status=JobStatus.running,
            progress=25,
            message="Local worker started.",
        )
        store.update_job(
            job_id,
            status=JobStatus.running,
            progress=75,
            message="Preparing local placeholder result.",
        )
        store.update_job(
            job_id,
            status=JobStatus.completed,
            progress=100,
            message="Job completed.",
            result=result,
        )
    except Exception as error:  # pragma: no cover - defensive guard for background tasks.
        store.update_job(
            job_id,
            status=JobStatus.failed,
            progress=100,
            message="Job failed.",
            error=str(error),
        )
