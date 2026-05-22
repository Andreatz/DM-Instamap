from __future__ import annotations

import json
import os
import sqlite3
import struct
import subprocess
import time
from contextlib import closing
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import BoundedSemaphore, RLock
from typing import Any
from uuid import uuid4

from .models import JobRecord, JobStatus, utc_now_iso

type CommandStep = tuple[list[str], str, int]


class JobNotFoundError(KeyError):
    pass


class JobStore:
    def __init__(self, db_path: str | Path | None = None) -> None:
        self._jobs: dict[str, JobRecord] = {}
        self._processes: dict[str, subprocess.Popen[str]] = {}
        self._lock = RLock()
        self._db_path = Path(db_path) if db_path is not None else default_jobs_db_path()
        self._max_concurrent_jobs = read_positive_int_env(
            "DM_INSTAMAP_WORKER_CONCURRENCY", 2
        )
        self._semaphore = BoundedSemaphore(self._max_concurrent_jobs)
        self._initialize_db()
        self._load_jobs()
        self.cleanup_old_jobs()

    def list_jobs(self) -> list[JobRecord]:
        with self._lock:
            return sorted(
                self._jobs.values(), key=lambda job: job.createdAt, reverse=True
            )

    @property
    def db_path(self) -> Path:
        return self._db_path

    @property
    def max_concurrent_jobs(self) -> int:
        return self._max_concurrent_jobs

    def running_job_ids(self) -> list[str]:
        with self._lock:
            return sorted(
                job.id for job in self._jobs.values() if job.status == JobStatus.running
            )

    def status_counts(self) -> dict[str, int]:
        counts = {status.value: 0 for status in JobStatus}
        with self._lock:
            for job in self._jobs.values():
                counts[job.status.value] += 1
        return counts

    def create_job(self, job_type: str, message: str) -> JobRecord:
        now = utc_now_iso()
        job = JobRecord(
            id=f"job_{uuid4().hex[:12]}",
            type=job_type,
            status=JobStatus.queued,
            progress=0,
            message=message,
            createdAt=now,
            updatedAt=now,
        )

        with self._lock:
            self._jobs[job.id] = job
            self._save_job(job)

        return job

    def get_job(self, job_id: str) -> JobRecord:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                raise JobNotFoundError(job_id)
            return job

    def update_job(
        self,
        job_id: str,
        *,
        status: JobStatus | None = None,
        progress: int | None = None,
        message: str | None = None,
        result: dict[str, Any] | None = None,
        error: str | None = None,
        log: dict[str, Any] | None = None,
    ) -> JobRecord:
        with self._lock:
            job = self.get_job(job_id)
            if job.status == JobStatus.cancelled:
                return job

            updated = job.model_copy(
                update={
                    "status": status if status is not None else job.status,
                    "progress": progress if progress is not None else job.progress,
                    "message": message if message is not None else job.message,
                    "result": result if result is not None else job.result,
                    "error": error if error is not None else job.error,
                    "log": merge_log(job.log, log),
                    "updatedAt": utc_now_iso(),
                }
            )
            self._jobs[job_id] = updated
            self._save_job(updated)
            return updated

    def cancel_job(self, job_id: str) -> JobRecord:
        with self._lock:
            job = self.get_job(job_id)
            if job.status in {
                JobStatus.completed,
                JobStatus.failed,
                JobStatus.cancelled,
            }:
                return job

            updated = job.model_copy(
                update={
                    "status": JobStatus.cancelled,
                    "progress": job.progress,
                    "message": "Job cancelled.",
                    "updatedAt": utc_now_iso(),
                }
            )
            self._jobs[job_id] = updated
            self._save_job(updated)
            process = self._processes.get(job_id)
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
            return updated

    def register_process(self, job_id: str, process: subprocess.Popen[str]) -> None:
        with self._lock:
            self._processes[job_id] = process

    def unregister_process(self, job_id: str) -> None:
        with self._lock:
            self._processes.pop(job_id, None)

    def is_cancelled(self, job_id: str) -> bool:
        return self.get_job(job_id).status == JobStatus.cancelled

    def acquire_worker_slot(self) -> None:
        self._semaphore.acquire()

    def release_worker_slot(self) -> None:
        self._semaphore.release()

    def cleanup_old_jobs(
        self, *, max_age_days: int | None = None, max_terminal_jobs: int | None = None
    ) -> int:
        age_days = (
            max_age_days
            if max_age_days is not None
            else read_positive_int_env("DM_INSTAMAP_JOBS_RETENTION_DAYS", 30)
        )
        keep_terminal = (
            max_terminal_jobs
            if max_terminal_jobs is not None
            else read_positive_int_env("DM_INSTAMAP_JOBS_MAX_TERMINAL", 500)
        )
        cutoff = datetime.now(UTC) - timedelta(days=age_days)

        with self._lock:
            terminal = [
                job
                for job in self._jobs.values()
                if job.status
                in {JobStatus.completed, JobStatus.failed, JobStatus.cancelled}
            ]
            expired_ids = {
                job.id
                for job in terminal
                if (updated := parse_iso_datetime(job.updatedAt)) is not None
                and updated < cutoff
            }
            terminal_sorted = sorted(
                terminal, key=lambda job: job.updatedAt, reverse=True
            )
            overflow_ids = (
                {job.id for job in terminal_sorted[keep_terminal:]}
                if keep_terminal >= 0
                else set()
            )
            ids_to_delete = expired_ids | overflow_ids

            if not ids_to_delete:
                return 0

            for job_id in ids_to_delete:
                self._jobs.pop(job_id, None)

            with closing(sqlite3.connect(self._db_path)) as connection:
                with connection:
                    connection.executemany(
                        "DELETE FROM jobs WHERE id = ?",
                        [(job_id,) for job_id in ids_to_delete],
                    )

            return len(ids_to_delete)

    def _initialize_db(self) -> None:
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(self._db_path)) as connection:
            with connection:
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS jobs (
                        id TEXT PRIMARY KEY,
                        type TEXT NOT NULL,
                        status TEXT NOT NULL,
                        progress INTEGER NOT NULL,
                        message TEXT NOT NULL,
                        createdAt TEXT NOT NULL,
                        updatedAt TEXT NOT NULL,
                        result TEXT,
                        error TEXT,
                        log TEXT
                    )
                    """
                )
                columns = {
                    row[1]
                    for row in connection.execute("PRAGMA table_info(jobs)").fetchall()
                }
                if "log" not in columns:
                    connection.execute("ALTER TABLE jobs ADD COLUMN log TEXT")

    def _load_jobs(self) -> None:
        with closing(sqlite3.connect(self._db_path)) as connection:
            rows = connection.execute(
                """
                SELECT id, type, status, progress, message, createdAt, updatedAt, result, error, log
                FROM jobs
                """
            ).fetchall()

        with self._lock:
            for row in rows:
                result = json.loads(row[7]) if row[7] is not None else None
                log = json.loads(row[9]) if row[9] is not None else None
                status = JobStatus(row[2])
                if status == JobStatus.running:
                    status = JobStatus.failed
                    message = "Worker restarted before the job completed."
                    error = "Job interrupted by worker restart."
                    log = merge_log(log, {"interrupted": True})
                else:
                    message = row[4]
                    error = row[8]

                job = JobRecord(
                    id=row[0],
                    type=row[1],
                    status=status,
                    progress=row[3],
                    message=message,
                    createdAt=row[5],
                    updatedAt=row[6],
                    result=result,
                    error=error,
                    log=log,
                )
                self._jobs[job.id] = job
                if status != JobStatus(row[2]):
                    self._save_job(job)

    def _save_job(self, job: JobRecord) -> None:
        with closing(sqlite3.connect(self._db_path)) as connection:
            with connection:
                connection.execute(
                    """
                    INSERT INTO jobs (id, type, status, progress, message, createdAt, updatedAt, result, error, log)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        type=excluded.type,
                        status=excluded.status,
                        progress=excluded.progress,
                        message=excluded.message,
                        createdAt=excluded.createdAt,
                        updatedAt=excluded.updatedAt,
                        result=excluded.result,
                        error=excluded.error,
                        log=excluded.log
                    """,
                    (
                        job.id,
                        job.type,
                        job.status.value,
                        job.progress,
                        job.message,
                        job.createdAt,
                        job.updatedAt,
                        json.dumps(job.result) if job.result is not None else None,
                        job.error,
                        json.dumps(job.log) if job.log is not None else None,
                    ),
                )


def default_jobs_db_path() -> Path:
    override = os.environ.get("DM_INSTAMAP_JOBS_DB")
    if override:
        return Path(override)
    return Path.home() / ".dm-instamap" / "jobs.db"


def read_positive_int_env(name: str, fallback: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return fallback
    try:
        value = int(raw)
    except ValueError:
        return fallback
    return value if value > 0 else fallback


def parse_iso_datetime(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def merge_log(
    existing: dict[str, Any] | None, update: dict[str, Any] | None
) -> dict[str, Any] | None:
    if update is None:
        return existing
    return {**(existing or {}), **update}


def summarize_output(value: str, *, max_chars: int = 1200) -> str:
    stripped = value.strip()
    if len(stripped) <= max_chars:
        return stripped
    return stripped[-max_chars:]


def find_repo_root(start: Path | None = None) -> Path:
    current = (start or Path(__file__)).resolve()
    for candidate in [current, *current.parents]:
        if (candidate / "pnpm-workspace.yaml").exists() and (
            candidate / "package.json"
        ).exists():
            return candidate
    raise RuntimeError("Could not find the DM-Instamap monorepo root.")


def run_asset_scan_job(store: JobStore, job_id: str, folder: str) -> None:
    run_subprocess_steps_job(
        store,
        job_id,
        [(["pnpm", "assets:scan", folder], "Running local asset scanner.", 85)],
        {"folder": folder},
    )


def run_asset_import_pack_job(
    store: JobStore,
    job_id: str,
    *,
    root: str,
    preset: str,
    default_tags: list[str],
) -> None:
    command: list[str] = [
        "pnpm",
        "assets:import-pack",
        "--root",
        root,
        "--preset",
        preset,
    ]
    if default_tags:
        command.extend(["--default-tags", ",".join(default_tags)])

    run_subprocess_steps_job(
        store,
        job_id,
        [(command, f"Importing asset pack from {root} with preset {preset}.", 85)],
        {"root": root, "preset": preset, "defaultTags": default_tags},
    )


def run_asset_generate_job(
    store: JobStore,
    job_id: str,
    *,
    prompt: str,
    classification: str,
    seed: int | None,
    steps: int | None,
    style_tags: list[str],
    negative_prompt: str | None,
    file_name_hint: str | None,
    output_directory: str | None,
) -> None:
    command: list[str] = [
        "pnpm",
        "assets:generate",
        "--prompt",
        prompt,
        "--classification",
        classification,
    ]
    if seed is not None:
        command.extend(["--seed", str(seed)])
    if steps is not None:
        command.extend(["--steps", str(steps)])
    if style_tags:
        command.extend(["--style-tags", ",".join(style_tags)])
    if negative_prompt:
        command.extend(["--negative-prompt", negative_prompt])
    if file_name_hint:
        command.extend(["--file-name-hint", file_name_hint])
    if output_directory:
        command.extend(["--output-directory", output_directory])

    run_subprocess_steps_job(
        store,
        job_id,
        [(command, "Generating asset via configured provider.", 85)],
        {
            "prompt": prompt,
            "classification": classification,
            "seed": seed,
            "styleTags": style_tags,
        },
    )


def run_ai_plan_job(
    store: JobStore,
    job_id: str,
    *,
    user_request: str,
    max_retries: int | None,
) -> None:
    command: list[str] = ["pnpm", "ai:plan", user_request]
    if max_retries is not None:
        command.extend(["--max-retries", str(max_retries)])

    run_subprocess_steps_job(
        store,
        job_id,
        [(command, "Calling AI provider for map plan.", 85)],
        {"userRequest": user_request, "maxRetries": max_retries},
    )


def run_exports_session_pack_job(
    store: JobStore,
    job_id: str,
    *,
    project_id: str,
    scale: float | None,
    description: str | None,
    include_initiative: bool | None,
    image_format: str | None,
    include_grid: bool | None,
    output: str | None,
) -> None:
    command: list[str] = ["pnpm", "exports:session-pack", project_id]
    if scale is not None:
        command.extend(["--scale", str(scale)])
    if description:
        command.extend(["--description", description])
    if include_initiative is True:
        command.append("--include-initiative")
    if include_initiative is False:
        command.append("--no-initiative")
    if image_format:
        command.extend(["--format", image_format])
    if include_grid is False:
        command.append("--no-grid")
    if output:
        command.extend(["--output", output])

    run_subprocess_steps_job(
        store,
        job_id,
        [(command, f"Exporting session pack for {project_id}.", 90)],
        {
            "projectId": project_id,
            "scale": scale,
            "includeInitiative": include_initiative,
            "output": output,
        },
    )


def run_reference_scan_job(store: JobStore, job_id: str, folder: str) -> None:
    run_subprocess_steps_job(
        store,
        job_id,
        [
            (["pnpm", "references:scan", folder], "Scanning local reference maps.", 60),
            (["pnpm", "references:style"], "Generating local reference Style DNA.", 90),
        ],
        {"folder": folder},
    )


def run_subprocess_job(
    store: JobStore,
    job_id: str,
    command: list[str],
    running_message: str,
    result_context: dict[str, Any] | None = None,
    *,
    cwd: Path | None = None,
) -> None:
    run_subprocess_steps_job(
        store, job_id, [(command, running_message, 85)], result_context, cwd=cwd
    )


def run_subprocess_steps_job(
    store: JobStore,
    job_id: str,
    steps: list[CommandStep],
    result_context: dict[str, Any] | None = None,
    *,
    cwd: Path | None = None,
) -> None:
    step_results: list[dict[str, Any]] = []
    store.acquire_worker_slot()
    started = time.monotonic()

    try:
        if store.is_cancelled(job_id):
            return

        repo_root = cwd or find_repo_root()

        for index, (command, message, progress) in enumerate(steps):
            if store.is_cancelled(job_id):
                return

            store.update_job(
                job_id,
                status=JobStatus.running,
                progress=max(5, min(95, progress - 20)),
                message=message,
                log={
                    "lastCommand": command,
                    "startedAt": utc_now_iso(),
                    "step": index + 1,
                    "stepCount": len(steps),
                },
            )
            step_result = run_command_step(store, job_id, command, repo_root)
            step_results.append(step_result)

            if store.is_cancelled(job_id):
                return

            if step_result["exitCode"] != 0:
                store.update_job(
                    job_id,
                    status=JobStatus.failed,
                    progress=100,
                    message="Job failed.",
                    result={
                        **(result_context or {}),
                        "command": command,
                        "commands": [step[0] for step in steps],
                        "exitCode": step_result["exitCode"],
                        "steps": step_results,
                        "stderr": step_result["stderr"],
                        "stdout": step_result["stdout"],
                    },
                    error=step_result["stderr"]
                    or step_result["stdout"]
                    or f"Command exited with code {step_result['exitCode']}.",
                    log={
                        "durationMs": int((time.monotonic() - started) * 1000),
                        "lastCommand": command,
                        "stderrTail": summarize_output(step_result["stderr"]),
                        "stdoutTail": summarize_output(step_result["stdout"]),
                    },
                )
                return

            store.update_job(
                job_id,
                status=JobStatus.running,
                progress=max(5, min(99, progress)),
                message=f"Completed step {index + 1} of {len(steps)}.",
                log={
                    "durationMs": int((time.monotonic() - started) * 1000),
                    "lastCommand": command,
                    "stderrTail": summarize_output(step_result["stderr"]),
                    "stdoutTail": summarize_output(step_result["stdout"]),
                },
            )

        store.update_job(
            job_id,
            status=JobStatus.completed,
            progress=100,
            message="Job completed.",
            result={
                **(result_context or {}),
                "command": steps[-1][0] if steps else [],
                "commands": [step[0] for step in steps],
                "exitCode": 0,
                "steps": step_results,
                "stderr": "\n".join(
                    step["stderr"] for step in step_results if step["stderr"]
                ).strip(),
                "stdout": "\n".join(
                    step["stdout"] for step in step_results if step["stdout"]
                ).strip(),
            },
            log={
                "durationMs": int((time.monotonic() - started) * 1000),
                "lastCommand": steps[-1][0] if steps else [],
            },
        )
    except (
        Exception
    ) as error:  # pragma: no cover - defensive guard for background tasks.
        store.update_job(
            job_id,
            status=JobStatus.failed,
            progress=100,
            message="Job failed.",
            error=str(error),
            log={"durationMs": int((time.monotonic() - started) * 1000)},
        )
    finally:
        store.release_worker_slot()


def run_command_step(
    store: JobStore, job_id: str, command: list[str], cwd: Path
) -> dict[str, Any]:
    process: subprocess.Popen[str] | None = None
    resolved_command = resolve_command(command)
    process = subprocess.Popen(
        resolved_command,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    store.register_process(job_id, process)

    try:
        stdout, stderr = process.communicate()
        return {
            "command": command,
            "exitCode": process.returncode,
            "stderr": stderr.strip(),
            "stdout": stdout.strip(),
        }
    finally:
        store.unregister_process(job_id)


def resolve_command(command: list[str]) -> list[str]:
    if os.name == "nt" and command and command[0] == "pnpm":
        return ["pnpm.cmd", *command[1:]]

    return command


def run_image_analysis_job(store: JobStore, job_id: str, image_path: str) -> None:
    try:
        if store.is_cancelled(job_id):
            return
        store.update_job(
            job_id,
            status=JobStatus.running,
            progress=25,
            message="Analyzing local image metadata with Sharp.",
            log={
                "lastCommand": ["pnpm", "assets:analyze-image", image_path],
                "startedAt": utc_now_iso(),
            },
        )
        started = time.monotonic()
        step_result = run_command_step(
            store,
            job_id,
            ["pnpm", "assets:analyze-image", image_path],
            find_repo_root(),
        )
        if store.is_cancelled(job_id):
            return
        if step_result["exitCode"] != 0:
            store.update_job(
                job_id,
                status=JobStatus.failed,
                progress=100,
                message="Job failed.",
                result={"imagePath": image_path, **step_result},
                error=step_result["stderr"]
                or step_result["stdout"]
                or f"Command exited with code {step_result['exitCode']}.",
                log={
                    "durationMs": int((time.monotonic() - started) * 1000),
                    "stderrTail": summarize_output(step_result["stderr"]),
                    "stdoutTail": summarize_output(step_result["stdout"]),
                },
            )
            return

        analysis = parse_json_stdout(step_result["stdout"])
        store.update_job(
            job_id,
            status=JobStatus.completed,
            progress=100,
            message="Job completed.",
            result={
                "imagePath": image_path,
                "analysis": analysis,
                "command": step_result["command"],
                "exitCode": step_result["exitCode"],
            },
            log={
                "durationMs": int((time.monotonic() - started) * 1000),
                "stderrTail": summarize_output(step_result["stderr"]),
                "stdoutTail": summarize_output(step_result["stdout"]),
            },
        )
    except (
        Exception
    ) as error:  # pragma: no cover - defensive guard for background tasks.
        store.update_job(
            job_id,
            status=JobStatus.failed,
            progress=100,
            message="Job failed.",
            error=str(error),
        )


def parse_json_stdout(stdout: str) -> Any:
    stripped = stdout.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        start = stripped.find("{")
        end = stripped.rfind("}")

        if start < 0 or end < start:
            raise

        return json.loads(stripped[start : end + 1])


def analyze_image_file(image_path: Path) -> dict[str, Any]:
    data = image_path.read_bytes()
    width: int | None = None
    height: int | None = None
    transparency: bool | None = None
    image_format = image_path.suffix.lower().lstrip(".") or None

    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        width, height = struct.unpack(">II", data[16:24])
        color_type = data[25]
        transparency = color_type in {4, 6} or b"tRNS" in data
        image_format = "png"
    elif data.startswith(b"\xff\xd8"):
        width, height = read_jpeg_size(data)
        transparency = False
        image_format = "jpg"
    elif data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        width, height = struct.unpack("<HH", data[6:10])
        transparency = b"\x21\xf9\x04" in data
        image_format = "gif"
    elif data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        width, height, transparency = read_webp_metadata(data)
        image_format = "webp"

    if width is None or height is None:
        raise ValueError("Unsupported or unreadable image format.")

    return {
        "format": image_format,
        "width": width,
        "height": height,
        "transparency": transparency,
        "dominantColors": [],
    }


def read_jpeg_size(data: bytes) -> tuple[int | None, int | None]:
    index = 2
    while index < len(data):
        if data[index] != 0xFF:
            index += 1
            continue
        marker = data[index + 1]
        index += 2
        if marker in {0xD8, 0xD9}:
            continue
        segment_length = int.from_bytes(data[index : index + 2], "big")
        if marker in {
            0xC0,
            0xC1,
            0xC2,
            0xC3,
            0xC5,
            0xC6,
            0xC7,
            0xC9,
            0xCA,
            0xCB,
            0xCD,
            0xCE,
            0xCF,
        }:
            height = int.from_bytes(data[index + 3 : index + 5], "big")
            width = int.from_bytes(data[index + 5 : index + 7], "big")
            return width, height
        index += segment_length
    return None, None


def read_webp_metadata(data: bytes) -> tuple[int | None, int | None, bool | None]:
    chunk = data[12:16]
    if chunk == b"VP8X":
        flags = data[20]
        width = int.from_bytes(data[24:27], "little") + 1
        height = int.from_bytes(data[27:30], "little") + 1
        return width, height, bool(flags & 0b00010000)
    if chunk == b"VP8L":
        bits = int.from_bytes(data[21:25], "little")
        width = (bits & 0x3FFF) + 1
        height = ((bits >> 14) & 0x3FFF) + 1
        return width, height, True
    if chunk == b"VP8 ":
        width = int.from_bytes(data[26:28], "little") & 0x3FFF
        height = int.from_bytes(data[28:30], "little") & 0x3FFF
        return width, height, False
    return None, None, None


def run_placeholder_job(store: JobStore, job_id: str, result: dict[str, Any]) -> None:
    """Deprecated helper kept only for older tests or local experiments."""
    try:
        store.update_job(
            job_id,
            status=JobStatus.running,
            progress=25,
            message="Local worker started.",
        )
        store.update_job(
            job_id,
            status=JobStatus.running,
            progress=75,
            message="Preparing local placeholder result.",
        )
        store.update_job(
            job_id,
            status=JobStatus.completed,
            progress=100,
            message="Job completed.",
            result=result,
        )
    except (
        Exception
    ) as error:  # pragma: no cover - defensive guard for background tasks.
        store.update_job(
            job_id,
            status=JobStatus.failed,
            progress=100,
            message="Job failed.",
            error=str(error),
        )
