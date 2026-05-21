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


class AssetImportPackRequest(BaseModel):
    root: str = Field(min_length=1)
    preset: str = "generic"
    defaultTags: list[str] = Field(default_factory=list)


class AssetGenerateRequest(BaseModel):
    prompt: str = Field(min_length=1)
    classification: str = "prop"
    seed: int | None = None
    steps: int | None = None
    styleTags: list[str] = Field(default_factory=list)
    negativePrompt: str | None = None
    fileNameHint: str | None = None
    outputDirectory: str | None = None


class AiPlanRequest(BaseModel):
    userRequest: str = Field(min_length=1)
    maxRetries: int | None = None


class ExportsSessionPackRequest(BaseModel):
    projectId: str = Field(min_length=1)
    scale: float | None = None
    description: str | None = None
    includeInitiative: bool | None = None
    imageFormat: str | None = None
    includeGrid: bool | None = None
    output: str | None = None


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()
