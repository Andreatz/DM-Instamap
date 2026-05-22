from fastapi import APIRouter, BackgroundTasks, Depends

from ..jobs import (
    JobStore,
    find_repo_root,
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
from ..security import validate_local_path
from .dependencies import get_job_store

router = APIRouter(prefix="/jobs/assets", tags=["assets"])


@router.post("/scan", response_model=JobRecord)
def create_asset_scan_job(
    payload: AssetScanRequest,
    background_tasks: BackgroundTasks,
    store: JobStore = Depends(get_job_store),
) -> JobRecord:
    folder = validate_local_path(payload.folder, repo_root=find_repo_root())
    job = store.create_job("assets.scan", "Queued local asset scan.")
    background_tasks.add_task(run_asset_scan_job, store, job.id, folder)
    return job


@router.post("/import-pack", response_model=JobRecord)
def create_asset_import_pack_job(
    payload: AssetImportPackRequest,
    background_tasks: BackgroundTasks,
    store: JobStore = Depends(get_job_store),
) -> JobRecord:
    root = validate_local_path(payload.root, repo_root=find_repo_root())
    job = store.create_job("assets.import-pack", "Queued asset pack import.")
    background_tasks.add_task(
        run_asset_import_pack_job,
        store,
        job.id,
        root=root,
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
    output_directory = (
        validate_local_path(payload.outputDirectory, repo_root=find_repo_root())
        if payload.outputDirectory
        else payload.outputDirectory
    )
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
        output_directory=output_directory,
    )
    return job
