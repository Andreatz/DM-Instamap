from typing import cast

from fastapi import Request

from ..jobs import JobStore


def get_job_store(request: Request) -> JobStore:
    return cast(JobStore, request.app.state.job_store)
