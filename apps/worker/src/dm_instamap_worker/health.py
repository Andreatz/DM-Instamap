from __future__ import annotations

from typing import Any

from .jobs import JobStore, find_repo_root


def health_payload(store: JobStore | None = None) -> dict[str, Any]:
    repo_root = None
    try:
        repo_root = str(find_repo_root())
    except RuntimeError:
        repo_root = None

    return {
        "service": "dm-instamap-worker",
        "status": "ok",
        "mode": "local-first",
        "version": "0.1.0",
        "repoRoot": repo_root,
        "dbPath": str(store.db_path) if store is not None else None,
        "jobCounts": store.status_counts() if store is not None else None,
        "runningJobIds": store.running_job_ids() if store is not None else [],
        "maxConcurrentJobs": store.max_concurrent_jobs if store is not None else None,
    }
