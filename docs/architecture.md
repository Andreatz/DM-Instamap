# Architecture

DM-Instamap is organized as a local-first monorepo.

## Applications

- `apps/web` contains the Next.js visual editor, asset/reference browsers,
  AI bridge, wizard, project/campaign management, generators preview, and
  the export panel.
- `apps/worker` contains the FastAPI worker that runs longer-running local
  tasks as background jobs persisted in SQLite (`~/.dm-instamap/jobs.db`),
  with subprocess invocations of the workspace `pnpm` CLIs and cancellation
  support.

## Packages

- `packages/core` owns shared map document types, snapshot records (full +
  delta), and campaign schemas. Pure TypeScript + Zod.
- `packages/assets` owns local asset scanning, classification, audit,
  reference Style DNA, embeddings (local + remote), the pack importer (E1),
  the image-generation providers (D3), and the partial-rescan helpers
  (`scanSingleAsset` + `appendAssetToManifest`).
- `packages/generator` owns procedural and narrative blueprint generation,
  the cave / village / outdoor / multi-floor algorithms (C1), and the
  auto-furnishing service.
- `packages/exporters` owns raster, dd2vtt, Foundry (with journals +
  scene-note pins), dmimap, and session-pack export.
- `packages/ai-bridge` owns the provider abstraction (Anthropic / OpenAI /
  custom), prompt building, orchestration (`generateMapPlanWithAi`,
  `generateNarrativeBlueprintWithAi`, `suggestAssetsForRoomWithAi`,
  `describeMapWithAi`), semantic validation, and the local repair pass for
  the manual ChatGPT bridge.

## Cross-cutting modules in apps/web

- `apps/web/src/lib/bridge-mappers.ts` converts local
  `AssetGroupView`/`ReferenceMapView` records into bridge summaries for
  both the manual and the auto AI workspaces (F1).
- `apps/web/src/lib/worker-client.ts` wraps the FastAPI worker base URL
  (`DM_INSTAMAP_WORKER_URL`, defaults to `http://127.0.0.1:8000`) and
  exposes `fetchWorkerJob` / `postWorkerJob`.
- `apps/web/src/lib/use-job.ts` is the React hook that polls
  `/api/jobs/<id>` until the job is terminal; pair it with the
  `JobProgressBar` component (H5).

## Principles

- Generated maps must remain editable.
- Asset intelligence must work locally.
- Binary assets should stay outside Git unless they are intentionally tiny test
  fixtures.
- Export design should leave room for PNG, WEBP, dd2vtt, Foundry VTT, and a
  zip-based Session Pack.
- Web routes prefer to call the same code path as the workspace CLIs (G1–G6),
  so behaviour stays identical between UI and terminal usage.
- Heavy or long-running tasks (`assets/import-pack`, `assets/generate`,
  `ai/plan`, `exports/session-pack`) opt-in to the worker via the
  `useJob`/`JobProgressBar` pair instead of holding a Next.js request open.
