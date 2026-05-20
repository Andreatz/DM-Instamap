from fastapi import Request

from ..jobs import JobStore


def get_job_store(request: Request) -> JobStore:
    return request.app.state.job_store
