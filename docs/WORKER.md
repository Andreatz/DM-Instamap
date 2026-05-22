# Worker

The DM-Instamap worker is a local FastAPI service for heavier processing tasks.
It does not call external services and it does not require a cloud queue.

## Run locally

```bash
pnpm worker:install
pnpm worker:dev
```

The API starts on:

```txt
http://127.0.0.1:8000
```

The worker is local-only by default and has no authentication layer. Requests
with non-local host headers are rejected unless `DM_INSTAMAP_ALLOW_REMOTE=true`
is set deliberately. Do not bind it to a public interface or expose it on the
internet.

Path payloads are validated before jobs are queued:

- relative paths must resolve inside the DM-Instamap workspace;
- broad/system folders such as a drive root, home directory, Windows system
  folders, or Unix system folders are rejected;
- image analysis paths must exist before the job starts.

## Health

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{
  "service": "dm-instamap-worker",
  "status": "ok",
  "mode": "local-first",
  "version": "0.1.0",
  "repoRoot": "C:/path/to/DM-Instamap",
  "dbPath": "C:/Users/you/.dm-instamap/jobs.db",
  "jobCounts": {
    "queued": 0,
    "running": 0,
    "completed": 12,
    "failed": 1,
    "cancelled": 0
  },
  "runningJobIds": [],
  "maxConcurrentJobs": 2
}
```

## Jobs

Jobs are persisted locally in SQLite at:

```txt
~/.dm-instamap/jobs.db
```

Set `DM_INSTAMAP_JOBS_DB` to override the path during tests or local
experiments. If the worker restarts while a job is running, that job is marked
as failed on startup because the local process was interrupted.

```bash
curl http://127.0.0.1:8000/jobs
curl http://127.0.0.1:8000/jobs/job_abc123
curl -X POST http://127.0.0.1:8000/jobs/job_abc123/cancel
```

Each job has:

- `id`
- `type`
- `status`
- `progress`
- `message`
- `createdAt`
- `updatedAt`
- `result`
- `error`
- `log` with `lastCommand`, `durationMs`, `stdoutTail`, `stderrTail`, and
  restart interruption metadata when available

## Task endpoints

These endpoints create local jobs and run local-first processing. They do not
call external APIs.

Asset and reference scans invoke the existing monorepo CLI commands via
subprocess:

- `pnpm assets:scan <folder>`
- `pnpm references:scan <folder>`
- `pnpm references:style` after a successful reference scan

Image analysis invokes the local Sharp-based CLI:

- `pnpm assets:analyze-image <image>`

The result includes dimensions, format, transparency and sampled dominant
colors. Python metadata parsing remains available internally as a lightweight
fallback helper.

```bash
curl -X POST http://127.0.0.1:8000/jobs/assets/scan \
  -H "Content-Type: application/json" \
  -d "{\"folder\":\"local-assets\"}"

curl -X POST http://127.0.0.1:8000/jobs/references/scan \
  -H "Content-Type: application/json" \
  -d "{\"folder\":\"local-references\"}"

curl -X POST http://127.0.0.1:8000/jobs/images/analyze \
  -H "Content-Type: application/json" \
  -d "{\"imagePath\":\"reference.png\"}"
```

The job payload captures command output, per-step results and exit codes so the
web app can inspect failures without reading terminal logs.

## Long-job robustness

The worker keeps a short log summary directly on each job record. It stores the
last command, command tails for stdout/stderr, and duration in milliseconds.
The web `JobProgressBar` displays the stderr tail on failures so UI errors are
actionable without opening a terminal.

Concurrency is bounded by `DM_INSTAMAP_WORKER_CONCURRENCY` (default `2`). This
keeps large pack imports or exports from starting too many local subprocesses
at once.

Old terminal jobs are cleaned on worker startup:

```bash
DM_INSTAMAP_JOBS_RETENTION_DAYS=30
DM_INSTAMAP_JOBS_MAX_TERMINAL=500
```

Only `completed`, `failed`, and `cancelled` jobs are removed by cleanup. Queued
or running jobs stay visible. If the worker restarts while a job is running,
the job is marked `failed` with `log.interrupted: true`.

## Crash recovery

1. Restart the worker with `pnpm worker:dev`.
2. Check `GET /health` for `dbPath`, `jobCounts`, and `runningJobIds`.
3. Open `GET /jobs` or the web proxy `GET /api/jobs` to inspect failed jobs.
4. Re-run idempotent jobs such as scans/imports after confirming the local
   source folder still exists.
5. For exports, verify whether the target zip/image was written before
   starting a new export.

## Worker offload

The following endpoints expose longer-running tasks as background jobs. Each
shells out to a `pnpm` CLI registered at the monorepo root (see
[../README.md](../README.md) and [LEGACY_ROADMAP.md](LEGACY_ROADMAP.md)), so the
worker stays thin and the same logic is reachable from the terminal.

- `POST /jobs/assets/import-pack` - body `{ "root": "...", "preset": "generic|forgotten-adventures|two-minute-tabletop|czepeku", "defaultTags": ["..."] }`. Runs `pnpm assets:import-pack`.
- `POST /jobs/assets/generate` - body `{ "prompt": "...", "classification": "prop", "seed": 42, "steps": 24, "styleTags": ["..."], "negativePrompt": "...", "fileNameHint": "...", "outputDirectory": "..." }`. Runs `pnpm assets:generate`. Requires `IMAGE_GEN_*` env vars.
- `POST /jobs/ai/plan` - body `{ "userRequest": "...", "maxRetries": 2 }`. Runs `pnpm ai:plan`. Requires `AI_*` env vars. Useful when retries can take 30-90s round-trip.
- `POST /jobs/exports/session-pack` - body `{ "projectId": "...", "scale": 2, "description": "...", "includeInitiative": true, "imageFormat": "png|webp", "includeGrid": true, "output": "data/exports/foo.zip" }`. Runs `pnpm exports:session-pack`.

Example:

```bash
curl -X POST http://127.0.0.1:8000/jobs/assets/import-pack \
  -H "Content-Type: application/json" \
  -d '{"root":"./local-assets/fa","preset":"forgotten-adventures"}'
```

The web app proxies the job lifecycle through `/api/jobs/<jobId>` and exposes
a shared React hook `useJob` (`apps/web/src/lib/use-job.ts`) plus the
`JobProgressBar` component. Form components opt into worker mode (e.g. the
"Run on local worker" toggle in `PackImporterForm`) to start a fire-and-forget
job and poll the progress.

Configure the worker base URL on the web side with:

```bash
DM_INSTAMAP_WORKER_URL=http://127.0.0.1:8000
DM_INSTAMAP_ALLOW_REMOTE=false
DM_INSTAMAP_WORKER_CONCURRENCY=2
DM_INSTAMAP_JOBS_RETENTION_DAYS=30
DM_INSTAMAP_JOBS_MAX_TERMINAL=500
```
