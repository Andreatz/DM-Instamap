# Architecture

DM-Instamap is organized as a local-first monorepo.

## Applications

- `apps/web` contains the Next.js visual editor, asset/reference browsers,
  AI bridge, wizard, project/campaign management, generator preview, and export
  panel.
- `apps/worker` contains the FastAPI worker that runs longer local tasks as
  background jobs persisted in SQLite (`~/.dm-instamap/jobs.db`), with
  subprocess invocations of the workspace `pnpm` CLIs and cancellation support.

## Packages

- `packages/core` owns shared map document types, snapshot records (full and
  delta), migrations, and campaign schemas. Browser-safe consumers import pure
  schemas and types from `@dm-instamap/core/browser`; route handlers, CLIs and
  Node-only modules import filesystem helpers from `@dm-instamap/core/server`.
- `packages/assets` owns local asset scanning, classification, audit, reference
  Style DNA, embeddings, the pack importer, image-generation providers and
  partial-rescan helpers (`scanSingleAsset` + `appendAssetToManifest`).
- `packages/generator` owns procedural and narrative blueprint generation,
  cave/village/outdoor/multi-floor algorithms, benchmark metrics and
  auto-furnishing.
- `packages/exporters` owns raster, dd2vtt, Foundry with journals and scene
  note pins, dmimap, and Session Pack export.
- `packages/ai-bridge` owns provider abstraction, prompt building,
  orchestration (`generateMapPlanWithAi`, `generateNarrativeBlueprintWithAi`,
  `suggestAssetsForRoomWithAi`, `describeMapWithAi`), semantic validation and
  the local repair pass for the manual ChatGPT bridge.

## Cross-Cutting Modules In apps/web

- `apps/web/src/lib/bridge-mappers.ts` converts local
  `AssetGroupView`/`ReferenceMapView` records into bridge summaries for both
  manual and automatic AI workspaces.
- `apps/web/src/lib/worker-client.ts` wraps the FastAPI worker base URL
  (`DM_INSTAMAP_WORKER_URL`, default `http://127.0.0.1:8000`) and exposes
  `fetchWorkerJob` / `postWorkerJob`.
- `apps/web/src/lib/use-job.ts` polls `/api/jobs/<id>` until a job is terminal;
  pair it with the `JobProgressBar` component.
- `apps/web/src/lib/local-paths.ts` is the web-side path validation policy for
  local filesystem input.

## Principles

- Generated maps must remain editable.
- Asset intelligence must work locally.
- Binary assets should stay outside Git unless they are intentionally tiny test
  fixtures.
- Export design must keep PNG, WEBP, dd2vtt, Foundry VTT and Session Pack as
  first-class targets.
- Web routes prefer to call the same code path as workspace CLIs, so behaviour
  stays identical between UI and terminal usage.
- Client React components must not import `@dm-instamap/core` directly. Use
  `@dm-instamap/core/browser` so Node-only snapshot helpers cannot be pulled
  into browser bundles by accident.
- Heavy or long-running tasks (`assets/import-pack`, `assets/generate`,
  `ai/plan`, `exports/session-pack`) opt in to the worker via the
  `useJob`/`JobProgressBar` pair instead of holding a Next.js request open.
