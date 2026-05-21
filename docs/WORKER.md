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

## Health

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{
  "service": "dm-instamap-worker",
  "status": "ok",
  "mode": "local-first"
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

## Worker offload (H1–H4)

The following endpoints expose longer-running tasks as background jobs. Each
shells out to a `pnpm` CLI registered at the monorepo root (see
[ROADMAP.md](ROADMAP.md) FASE G), so the worker stays thin and
the same logic is reachable from the terminal.

- `POST /jobs/assets/import-pack` — body `{ "root": "...", "preset": "generic|forgotten-adventures|two-minute-tabletop|czepeku", "defaultTags": ["..."] }`. Runs `pnpm assets:import-pack`.
- `POST /jobs/assets/generate` — body `{ "prompt": "...", "classification": "prop", "seed": 42, "steps": 24, "styleTags": ["..."], "negativePrompt": "...", "fileNameHint": "...", "outputDirectory": "..." }`. Runs `pnpm assets:generate`. Requires `IMAGE_GEN_*` env vars.
- `POST /jobs/ai/plan` — body `{ "userRequest": "...", "maxRetries": 2 }`. Runs `pnpm ai:plan`. Requires `AI_*` env vars. Useful when retries can take 30–90s round-trip.
- `POST /jobs/exports/session-pack` — body `{ "projectId": "...", "scale": 2, "description": "...", "includeInitiative": true, "imageFormat": "png|webp", "includeGrid": true, "output": "data/exports/foo.zip" }`. Runs `pnpm exports:session-pack`.

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
```
