from fastapi import FastAPI

from .health import health_payload
from .jobs import JobStore
from .routes import assets_router, images_router, jobs_router, references_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="DM-Instamap Worker",
        summary="Local worker for heavy asset processing.",
        version="0.1.0",
    )

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return health_payload()

    app.state.job_store = JobStore()
    app.include_router(jobs_router)
    app.include_router(assets_router)
    app.include_router(references_router)
    app.include_router(images_router)

    return app


app = create_app()
