from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class JobRecord(BaseModel):
    id: str
    type: str
    status: JobStatus
    progress: int = Field(ge=0, le=100)
    message: str
    createdAt: str
    updatedAt: str
    result: dict[str, Any] | None = None
    error: str | None = None


class AssetScanRequest(BaseModel):
    folder: str = Field(min_length=1)


class ReferenceScanRequest(BaseModel):
    folder: str = Field(min_length=1)


class ImageAnalyzeRequest(BaseModel):
    imagePath: str = Field(min_length=1)


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()
