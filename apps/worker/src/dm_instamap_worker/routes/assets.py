from fastapi import APIRouter, BackgroundTasks, Depends

from ..jobs import (
    JobStore,
    run_asset_generate_job,
    run_asset_import_pack_job,
    run_asset_scan_job,
)
from ..models import (
    AssetGenerateRequest,
    AssetImportPackRequest,
    AssetScanRequest,
    JobRecord,
)
from .dependencies import get_job_store

router = APIRouter(prefix="/jobs/assets", tags=["assets"])


@router.post("/scan", response_model=JobRecord)
def create_asset_scan_job(
    payload: AssetScanRequest,
    background_tasks: BackgroundTasks,
    store: JobStore = Depends(get_job_store),
) -> JobRecord:
    job = store.create_job("assets.scan", "Queued local asset scan.")
    background_tasks.add_task(run_asset_scan_job, store, job.id, payload.folder)
    return job


@router.post("/import-pack", response_model=JobRecord)
def create_asset_import_pack_job(
    payload: AssetImportPackRequest,
    background_tasks: BackgroundTasks,
    store: JobStore = Depends(get_job_store),
) -> JobRecord:
    job = store.create_job("assets.import-pack", "Queued asset pack import.")
    background_tasks.add_task(
        run_asset_import_pack_job,
        store,
        job.id,
        root=payload.root,
        preset=payload.preset,
        default_tags=payload.defaultTags,
    )
    return job


@router.post("/generate", response_model=JobRecord)
def create_asset_generate_job(
    payload: AssetGenerateRequest,
    background_tasks: BackgroundTasks,
    store: JobStore = Depends(get_job_store),
) -> JobRecord:
    job = store.create_job("assets.generate", "Queued asset generation.")
    background_tasks.add_task(
        run_asset_generate_job,
        store,
        job.id,
        prompt=payload.prompt,
        classification=payload.classification,
        seed=payload.seed,
        steps=payload.steps,
        style_tags=payload.styleTags,
        negative_prompt=payload.negativePrompt,
        file_name_hint=payload.fileNameHint,
        output_directory=payload.outputDirectory,
    )
    return job
