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

Jobs are stored in memory for now. Restarting the worker clears them.

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

## Placeholder task endpoints

These endpoints create local jobs and return placeholder results. The current
production asset/reference scanners still live in the pnpm CLI commands.

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

Future work can move the real scanner and image analysis pipeline behind these
endpoints without changing the web app contract.
