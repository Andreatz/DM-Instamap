from fastapi import FastAPI

from .health import health_payload


def create_app() -> FastAPI:
    app = FastAPI(
        title="DM-Instamap Worker",
        summary="Local worker for heavy asset processing.",
        version="0.1.0",
    )

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return health_payload()

    return app


app = create_app()
