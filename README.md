# DM-Instamap

DM-Instamap is a **local-first modular map generator for D&D**. It scans local
art libraries, groups and audits assets, generates editable maps from narrative
blueprints or procedural algorithms, lets you edit them in a canvas,
auto-furnishes rooms, and exports maps for table or VTT use. AI integration is
optional: the manual ChatGPT bridge still works, but provider-backed automation
(Anthropic / OpenAI / Replicate / Automatic1111) is wired up when you supply
keys via environment variables.

## Local-only security

DM-Instamap does not include authentication. Do not expose the web app or the
worker on the public internet. Use `localhost`, `127.0.0.1`, or a trusted local
network only. By default, web and worker requests with non-local host headers
are rejected unless `DM_INSTAMAP_ALLOW_REMOTE=true` is set deliberately.

The unified [docs/ROADMAP.md](docs/ROADMAP.md) now consolidates the historical
roadmap, phases A-E, and the post-E consolidation phases F-L. Those phases are
closed at the repo/test-automatic level (integration fixes F, CLI surface G,
worker offload H, editor canvas integration I, documentation J, web tests K,
polish L1/L4/L5).
Remaining work is manual verification with real VTT imports, real provider
keys, and large asset packs.

## Current capabilities

### Asset intelligence

- Scan local image assets and generate lightweight previews.
- Heuristic classification, manual overrides, asset groups.
- Quality scoring, duplicate detection (file-hash + visual-hash).
- **Batch review** with prioritized queues (Critical, High, Duplicates, Low
  Quality, Unknown Classification, Missing Metadata, Classification Conflict).
- Local visual search (text and image) with optional embeddings.
- **Pack importer** (E1): preset auto-tagging for Forgotten Adventures,
  2-Minute Tabletop, Czepeku, and a generic fallback. Reuses the scanner under
  the hood and only reclassifies automatic/unknown entries.

### References

- Scan reference maps with previews and metadata review.
- **Reference Style DNA**: local palette/mood/layout/density/grid analysis and
  a human-readable prompt summary, reusable by the generator and the AI bridge.

### Generator

- Simple procedural dungeon generator with rectangular rooms and corridors.
- **Narrative blueprint** layer (`TacticalRole`, `NarrativeRoom`,
  `MapGenerationBlueprint`) with `structure`, `scale`, `mood`, `hasWater`,
  `hasVegetation`, `ruinLevel`. Specialized `generateCryptBlueprint`,
  `generateBuildingBlueprint`, `generateDungeonBlueprint`,
  `generateCaveBlueprint`, `generateVillageBlueprint`,
  `generateOutdoorBlueprint`.
- **New algorithms (C1)** — all deterministic via seed:
  - `generateCaveDungeon` — cellular automata + flood-fill on the largest floor
    region.
  - `generateVillageMap` — recursive block subdivision with auto-placed doors.
  - `generateMultiFloorDungeon` — N floors with bidirectional stairs links.
  - `generateOutdoorMap` — poisson-disc trees + optional river with bridges.
- **Advanced auto-furnish** that places assets by room type, narrative role and
  wall/center/scatter rules, with debug output. Room-type vocabulary extended
  with `cave`, `village_building`, `tavern`, `smithy`, `shrine`, `clearing`.
- **Generator quality scoring** via `scoreMapQuality`, shown in `/generate`
  with connectivity, dead-end, cover, line-of-sight, POI, and debug-tile
  warnings.

### Editor

- Canvas-based editor with pan/zoom, paint floor/wall/erase, doors, lights,
  multi-select, rotate/scale/flip, undo/redo, copy/paste, group/ungroup,
  layer visibility/lock/opacity, fog-of-war preview, initiative tracker, and
  GM-only notes anchored to cells.
- Per-project save/reopen flow backed by `MapDocument` as source of truth.
- **Snapshots panel (E2)** in `/projects/[id]`: create labelled snapshots,
  dedupe by content hash, restore at any time. Files in
  `data/projects/<id>/snapshots/`.
- **Snapshot diff vs current (F4)**: per-snapshot button that calls
  `/api/projects/[id]/snapshots/[hash]/diff?against=current` and shows the
  list of changed top-level fields.
- **Editor toolbar quick actions (I1–I4)**: Snapshot button + `Ctrl+Shift+S`
  hotkey, one-click Session Pack export, AI Assist drawer (describe map /
  suggest assets / generate asset from prompt), and a "Recently Generated"
  palette section persisted in `localStorage`.

### AI Bridge

The bridge has two modes that coexist:

- **Auto (D1)** — talks to a configured provider via `fetch`. Configure with
  `AI_PROVIDER=anthropic|openai`, `AI_API_KEY=...`, optional `AI_MODEL`,
  `AI_BASE_URL`, `AI_MAX_TOKENS`. Orchestration functions:
  `generateMapPlanWithAi` (with auto retry via repair prompt),
  `generateNarrativeBlueprintWithAi`, `suggestAssetsForRoomWithAi`,
  `describeMapWithAi`.
- **Manual** — the original copy/paste ChatGPT flow remains available with
  prompt-packet export, semantic validation, missing-asset suggestions, local
  auto-repair, and import to a new or existing project.

### Embeddings & image generation

- **Local embeddings** (color + layout) for text-to-asset and image-to-image
  search, available without setup.
- **Remote embedding provider (D2)** — point at any HTTP endpoint that returns
  `{ data: [{ embedding: [...] }] }` or `{ embedding: [...] }`. Configure with
  `EMBEDDINGS_PROVIDER=remote|local`, `EMBEDDINGS_ENDPOINT`,
  `EMBEDDINGS_API_KEY`, `EMBEDDINGS_MODEL`, `EMBEDDINGS_DIMENSIONS`. Falls back
  to the local provider if the remote config is incomplete.
- **Image generation (D3)** — Replicate, local Automatic1111, or a custom
  provider. `/assets/generate` sends a prompt, saves the result under
  `data/assets/generated/`, and returns metadata ready for the scanner.
  Configure with `IMAGE_GEN_PROVIDER=replicate|automatic1111`,
  `IMAGE_GEN_API_KEY`, `IMAGE_GEN_MODEL`, `IMAGE_GEN_VERSION`,
  `IMAGE_GEN_BASE_URL`.

### Export

- PNG, WEBP, dd2vtt (Universal VTT), Foundry VTT module zip, the proprietary
  editable `.dmimap.json` format, and **Session Pack (E3)** — a zip with full
  / GM / player PNGs, GM notes, plan notes, initiative tracker, and manifest.
- **Foundry journals (E4)** — the Foundry module zip now bundles journal
  entries for rooms, GM notes, and plan notes. Toggle with `includeJournals`
  in the export UI.
- **Visibility modes**: `player` (hides secret rooms, traps, GM notes,
  annotation layer), `gm` (full visibility) and `clean` (player-safe and
  stripped of notes/lighting).
- Per-project export route plus a global export API.

### Campaigns (E5)

- `data/campaigns/<id>/campaign.json` holds a campaign with linked maps and
  session timeline.
- `/campaigns` lists campaigns; `/campaigns/[id]` lets you link local projects
  and append session entries (date, title, optional summary). Pure local
  aggregation — no sync.

### UX

- Guided home page with status pills, recent projects, and quick actions.
- **New Map Wizard** in 5 steps: Describe, Map Kind, Style, Assets, Generate.
- Global navigation header across all routes.
- Generator preview (`/generate`) exposes `simple`, `narrative`, `cave`,
  `village`, `outdoor`, and `multi-floor` modes with on-demand fields (seed,
  building count, river/tree density, floor count).

## Workspace

- `apps/web` — Next.js visual editor, browsers, AI bridge, wizard, export UI.
- `apps/worker` — Python FastAPI worker that runs real scan / analyze jobs via
  subprocess against the workspace CLIs, with SQLite persistence under
  `~/.dm-instamap/jobs.db` and cancellation support.
- `packages/core` — Shared Zod schemas (`MapDocument`, `MapPlan`,
  `AssetMetadata`, snapshots, campaign).
- `packages/assets` — Asset scanning, classification, audit, reference Style
  DNA, local search helpers, pack importer, image generation.
- `packages/generator` — Procedural and narrative blueprint generation,
  auto-furnish, cave / village / outdoor / multi-floor algorithms.
- `packages/exporters` — Raster, dd2vtt, Foundry (with journals), dmimap,
  session pack, visibility filters.
- `packages/ai-bridge` — Provider abstraction (Anthropic / OpenAI / custom),
  prompt building, orchestration, semantic validation, repair, asset
  suggestions.
- `docs` — Architecture notes, roadmap, and per-module manuals.

## Requirements

- Node.js 24 or newer.
- pnpm 10 or newer.
- Python 3.12 or newer (only when running the worker).

## Setup

```bash
pnpm install
```

Create a local environment file when you want to customize paths or wire up AI
providers:

```bash
cp .env.example .env
```

Useful environment variables (all optional, all local-only):

```bash
# AI bridge (D1)
AI_PROVIDER=anthropic        # or openai
AI_API_KEY=...
AI_MODEL=claude-sonnet-4-6   # or gpt-4o-mini, etc.
AI_BASE_URL=                 # override base URL
AI_MAX_TOKENS=4096

# Remote embeddings (D2)
EMBEDDINGS_PROVIDER=remote   # or local (default)
EMBEDDINGS_ENDPOINT=https://...
EMBEDDINGS_API_KEY=...
EMBEDDINGS_MODEL=clip-vit
EMBEDDINGS_DIMENSIONS=64

# Image generation (D3)
IMAGE_GEN_PROVIDER=replicate # or automatic1111
IMAGE_GEN_API_KEY=...
IMAGE_GEN_MODEL=stability-ai/sdxl
IMAGE_GEN_VERSION=...
IMAGE_GEN_BASE_URL=http://127.0.0.1:7860

# Worker offload (H5)
DM_INSTAMAP_WORKER_URL=http://127.0.0.1:8000
DM_INSTAMAP_JOBS_DB=                   # override worker SQLite path
DM_INSTAMAP_ALLOW_REMOTE=false         # keep false unless you knowingly allow trusted LAN access
```

Install Python worker runtime dependencies when you want to run the worker:

```bash
pnpm worker:install
```

## Scripts

```bash
pnpm lint
pnpm test
pnpm build
pnpm dev          # binds Next.js to 127.0.0.1
pnpm worker:dev   # binds FastAPI to 127.0.0.1
```

Testing details and the lightweight UI smoke-flow contract live in
[docs/TESTING.md](docs/TESTING.md).

Asset and reference commands:

```bash
pnpm assets:scan <folder>
pnpm assets:group
pnpm assets:audit
pnpm assets:embed
pnpm assets:import-pack --root <path> --preset forgotten-adventures
pnpm assets:generate --prompt "ornate iron door" --classification door --seed 42
pnpm references:scan <folder>
pnpm references:style
```

Project, AI, exports, and campaigns CLIs:

```bash
pnpm snapshots:create <projectId> --label "before-edit"
pnpm snapshots:list <projectId>
pnpm snapshots:restore <projectId> <contentHash>
pnpm ai:blueprint "crypt below cathedral"
pnpm ai:plan "three rooms with a hidden study"
pnpm exports:session-pack <projectId> --scale 2 --include-initiative
pnpm campaigns:list
pnpm campaigns:create --name "Whispering Woods" --tags hex-crawl,wilderness
```

The scanner writes lightweight metadata to `data/indexes/` and thumbnails to
`data/previews/`. Keep original asset libraries in ignored folders such as
`local-assets/`, `assets-local/`, `local-references/`, or external storage.

- `pnpm assets:audit` writes `data/indexes/asset-audit.json` with duplicate,
  quality, and review-priority signals. Feed it to `/assets/review/batches`
  for prioritized triage.
- `pnpm references:style` writes `data/indexes/reference-style-dna.json` with
  palette, mood, layout, density, grid detection, and a prompt summary used by
  the wizard and the AI bridge.
- `pnpm assets:embed` powers local text and image asset search. The asset
  browser and editor keep working without embeddings by falling back to local
  metadata where possible.

Projects are saved locally in `data/projects/<project-id>/` with a lightweight
`project.json`, the editable source-of-truth `map.dmimap.json`, plus local
`exports/`, `snapshots/`, and `thumbnails/` folders.

## Web routes

### Guided UX

- `/` — guided home with hero, status, recent projects, workflows.
- `/projects/new` — **5-step wizard** (Describe → Map Kind → Style → Assets →
  Generate). Creates a project and redirects to the editor.

### Projects

- `/projects` — local saved project list.
- `/projects/[projectId]` — project details, snapshot panel (with diff vs
  current), AI describe button, linked floors list, delete action.
- `/projects/[projectId]/floors` — multi-floor overview tab grid with
  per-floor minimap stats and Open/Editor/Export shortcuts (L5).
- `/projects/[projectId]/editor` — canvas editor with save, snapshot quick
  action, session pack quick export, AI assist drawer, Recently Generated
  palette section.
- `/projects/[projectId]/export` — format + mode + grid + scale export panel
  including Session Pack and Foundry journals toggle.

### Assets

- `/assets` — asset browser with filters and visual/text search.
- `/assets/review` — single-asset correction workflow.
- `/assets/review/batches` — **batched review queue** (Critical, High,
  Duplicates, Low Quality, Unknown, Missing Metadata, Conflict).
- `/assets/import-pack` — **pack importer** with preset dropdown.
- `/assets/generate` — **prompt-driven asset generation** that saves to the
  local library.
- `/asset-groups` and `/asset-groups/review` — grouped browser and batch
  review.

### References

- `/references` — reference map browser with Style DNA summary cards.
- `/references/review` — reference metadata correction workflow.

### Campaigns

- `/campaigns` — campaign list and creation form.
- `/campaigns/[campaignId]` — linked maps + sessions timeline editor.

### Tools

- `/ai-bridge` — **AI Bridge** combining the auto provider workflow (D1) with
  the manual ChatGPT bridge (prompt packet, validation, repair, import).
- `/generate` — generator preview with `simple`, `narrative`, `cave`,
  `village`, `outdoor`, and `multi-floor` modes.
- `/editor` — standalone scratch editor.

### APIs

- `GET /api/assets/search?q=...` — text-to-asset search (env-configured
  embedding provider).
- `POST /api/assets/search-by-image` — image-to-image search.
- `POST /api/assets/import-pack` — preset-driven import.
- `GET /api/assets/generate` — provider status; `POST` to generate.
- `POST /api/projects` and `GET/PUT/DELETE /api/projects/[projectId]`.
- `POST /api/projects/multi-floor` — saves N linked projects in one shot for
  a multi-floor dungeon (F2). Cross-floor links stored in
  `project.json#relatedProjectIds`.
- `GET/POST /api/projects/[projectId]/snapshots` and
  `GET/POST /api/projects/[projectId]/snapshots/[contentHash]` for create /
  list / restore.
- `GET /api/projects/[projectId]/snapshots/[contentHash]/diff?against=current|<hash>` —
  returns `SnapshotDiff` with the list of changed fields (F4).
- `POST /api/projects/[projectId]/export` — per-project export with mode,
  Session Pack, and Foundry journals toggle.
- `POST /api/export` — global export of any `MapDocument`.
- `POST /api/ai-bridge/import-plan` — import a validated `MapPlan` from
  ChatGPT (manual flow) into a new project or an existing one.
- `GET /api/ai/status`, `POST /api/ai/plan`, `POST /api/ai/blueprint`,
  `POST /api/ai/describe` — auto AI bridge endpoints (the last one calls
  `describeMapWithAi` for the project page).
- `GET /api/campaigns`, `POST /api/campaigns`, `GET/PUT/DELETE
  /api/campaigns/[campaignId]` — campaign CRUD.
- `GET /api/jobs/[jobId]` — proxy to the local FastAPI worker for polling
  long-running jobs.
- `POST /api/jobs/assets/import-pack` — fire-and-forget worker job for asset
  pack import (reference integration for H1–H5; other forms can opt-in by
  flipping the same hook).

## Local worker

The FastAPI worker persists jobs in SQLite (`~/.dm-instamap/jobs.db`), runs
real CLI subprocesses for asset scan, reference scan / style, and Sharp-based
image analysis, supports cancellation, and exposes `/health`, `/jobs`,
`/jobs/{job_id}`, `/jobs/{job_id}/cancel`. The worker also accepts longer
fire-and-forget jobs introduced in FASE H:

- `POST /jobs/assets/import-pack` (H1)
- `POST /jobs/assets/generate` (H2)
- `POST /jobs/ai/plan` (H3)
- `POST /jobs/exports/session-pack` (H4)

On the web side, configure `DM_INSTAMAP_WORKER_URL` (defaults to
`http://127.0.0.1:8000`); the `useJob` React hook and `JobProgressBar`
component poll job status via `/api/jobs/[jobId]`. See
[docs/WORKER.md](docs/WORKER.md).

Worker job payloads that contain paths are validated before subprocesses start:
relative paths must stay inside the workspace, and broad/system folders are
rejected.

## Exports

Six formats, three visibility modes. The exporter package ships:

- **PNG / WEBP** raster export from the current `MapDocument`.
- **dd2vtt** Universal VTT JSON with embedded image, walls, doors, lights.
- **Foundry VTT** installable module zip with scene, walls, doors, lights, and
  optional journal entries for rooms / GM notes / plan notes.
- **dmimap** proprietary editable JSON snapshot with mode and version.
- **Session Pack** zip with full / GM / player maps, GM notes, plan notes,
  initiative tracker, manifest, and optional narrative description.

Visibility modes:

- `player` — hides secret rooms, secret/trap doors, annotation layer,
  GM/spoiler notes. Hidden-room floor tiles become `empty`.
- `gm` — everything visible. Default.
- `clean` — like `player` but also strips notes and lighting.

## Troubleshooting

- If `pnpm install --frozen-lockfile` fails, update dependencies locally with
  `pnpm install` and commit the lockfile intentionally.
- If the worker cannot import FastAPI, run `pnpm worker:install`.
- If asset previews are missing, rerun `pnpm assets:scan <folder>`.
- If `/assets/review/batches` shows an empty state, run `pnpm assets:audit`
  to create `data/indexes/asset-audit.json`.
- If the AI auto panel says "disabled", set `AI_PROVIDER` and `AI_API_KEY`
  before starting `pnpm dev`. The manual bridge keeps working without keys.
- If `/assets/generate` shows "provider not configured", set
  `IMAGE_GEN_PROVIDER` plus the matching env vars (for Replicate, also set
  `IMAGE_GEN_API_KEY` and `IMAGE_GEN_MODEL`).
- If JSON override files fail to parse, remove a UTF-8 BOM or validate the
  file with a JSON formatter.
- If a large asset pack appears in Git status, move it to an ignored local
  folder before committing.
