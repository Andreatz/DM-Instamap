from fastapi import FastAPI

from .health import health_payload
from .jobs import JobStore
from .routes import (
    ai_router,
    assets_router,
    exports_router,
    images_router,
    jobs_router,
    references_router,
)
from .security import reject_remote_requests


def create_app(job_store: JobStore | None = None) -> FastAPI:
    app = FastAPI(
        title="DM-Instamap Worker",
        summary="Local worker for heavy asset processing.",
        version="0.1.0",
    )

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return health_payload()

    app.middleware("http")(reject_remote_requests)
    app.state.job_store = job_store or JobStore()
    app.include_router(jobs_router)
    app.include_router(assets_router)
    app.include_router(references_router)
    app.include_router(images_router)
    app.include_router(ai_router)
    app.include_router(exports_router)

    return app


app = create_app()
