# DM-Instamap

DM-Instamap is a **local-first modular map generator for D&D**. It scans local
art libraries, groups and audits assets, generates editable maps from narrative
blueprints, lets you edit them in a canvas, auto-furnishes rooms, and exports
maps for table or VTT use — all without requiring paid APIs.

The project completes the full ROADMAP (Phases 1-10 plus Novità 1, 2, 4, 5, 6).
The remaining work is targeted polish: real worker job execution beyond
placeholders and optional advanced ML embeddings.

## Current capabilities

### Asset intelligence

- Scan local image assets and generate lightweight previews.
- Heuristic classification, manual overrides, asset groups.
- Quality scoring, duplicate detection (file-hash + visual-hash).
- **Batch review** with prioritized queues (Critical, High, Duplicates, Low
  Quality, Unknown Classification, Missing Metadata, Classification Conflict).
- Local visual search (text and image) with optional embeddings.

### References

- Scan reference maps with previews and metadata review.
- **Reference Style DNA**: local palette/mood/layout/density/grid analysis and a
  human-readable prompt summary, reusable by the generator and the AI bridge.

### Generator

- Simple procedural dungeon generator.
- **Narrative blueprint** layer with `TacticalRole`, `NarrativeRoom`,
  `MapGenerationBlueprint`. Specialized `generateCryptBlueprint`,
  `generateBuildingBlueprint`, `generateDungeonBlueprint`.
- **Advanced auto-furnish** that places assets by room type, narrative role and
  wall/center/scatter rules, with debug output.

### Editor

- Canvas-based editor with pan/zoom, paint floor/wall/erase, doors, lights,
  asset drag-and-drop from the asset library and from local search.
- Per-project save/reopen flow backed by `MapDocument` as source of truth.

### AI Bridge (manual, no API required)

- Compact ChatGPT prompt built from local context (asset groups, style DNA,
  asset search results).
- **Prompt packet** export in Markdown for clean copy-paste sessions.
- **Semantic validation** beyond Zod: room/door/light/asset bounds, duplicate
  ids, unknown room references, asset id checks against your local library.
- **Missing-asset suggestions** ranked from local asset groups and search.
- **Local auto-repair** that removes zero-length walls, out-of-bounds elements,
  invalid lights and substitutes missing assets.
- **Import plan** into a new project or update an existing one via API.

### Export

- PNG, WEBP, dd2vtt (Universal VTT), Foundry VTT module zip, and a proprietary
  editable `.dmimap.json` format.
- **Visibility modes**: `player` (hides secret rooms, traps, GM notes,
  annotation layer), `gm` (full visibility) and `clean` (player-safe and
  stripped of notes/lighting).
- Per-project export route plus a global export API.

### UX

- Guided home page with status pills, recent projects, and quick actions.
- **New Map Wizard** in 5 steps: Describe, Map Kind, Style, Assets, Generate.
- Global navigation header across all routes.

## Workspace

- `apps/web` - Next.js visual editor, browsers, AI bridge, wizard, export UI.
- `apps/worker` - Python FastAPI worker for local heavy asset processing.
- `packages/core` - Shared Zod schemas (`MapDocument`, `MapPlan`, `AssetMetadata`).
- `packages/assets` - Asset scanning, classification, audit, reference Style
  DNA, local search helpers.
- `packages/generator` - Procedural and narrative blueprint generation, auto-furnish.
- `packages/exporters` - Raster, dd2vtt, Foundry, dmimap exporters and visibility filters.
- `packages/ai-bridge` - Prompt building, semantic validation, repair, asset suggestions.
- `docs` - Architecture notes, roadmap, and per-module manuals.

## Requirements

- Node.js 24 or newer.
- pnpm 10 or newer.
- Python 3.12 or newer (only when running the worker).

## Setup

```bash
pnpm install
```

Create a local environment file when you want to customize paths:

```bash
cp .env.example .env
```

Install Python worker runtime dependencies when you want to run the worker API:

```bash
pnpm worker:install
```

## Scripts

```bash
pnpm lint
pnpm test
pnpm build
pnpm dev
pnpm worker:dev
```

Asset and reference commands:

```bash
pnpm assets:scan <folder>
pnpm assets:group
pnpm assets:audit
pnpm assets:embed
pnpm references:scan <folder>
pnpm references:style
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
`exports/` and `thumbnails/` folders.

## Web routes

### Guided UX

- `/` - guided home with hero, status, recent projects, workflows.
- `/projects/new` - **5-step wizard** (Describe → Map Kind → Style → Assets →
  Generate). Creates a project and redirects to the editor.

### Projects

- `/projects` - local saved project list.
- `/projects/[projectId]` - project details and local delete action.
- `/projects/[projectId]/editor` - canvas editor with save.
- `/projects/[projectId]/export` - format + mode + grid + scale export panel.

### Assets

- `/assets` - asset browser with filters and visual/text search.
- `/assets/review` - single-asset correction workflow.
- `/assets/review/batches` - **batched review queue** (Critical, High,
  Duplicates, Low Quality, Unknown, Missing Metadata, Conflict).
- `/asset-groups` and `/asset-groups/review` - grouped browser and batch review.

### References

- `/references` - reference map browser with Style DNA summary cards.
- `/references/review` - reference metadata correction workflow.

### Tools

- `/ai-bridge` - manual ChatGPT bridge with prompt packet download, semantic
  validation, missing-asset suggestions, auto-repair preview, and import to a
  new or existing project.
- `/generate` - simple/narrative procedural dungeon preview.
- `/editor` - standalone scratch editor.

### APIs

- `GET /api/assets/search?q=...` - local text-to-asset search.
- `POST /api/assets/search-by-image` - local image-to-image search.
- `POST /api/projects` and `GET/PUT/DELETE /api/projects/[projectId]`.
- `POST /api/projects/[projectId]/export` - per-project export with mode.
- `POST /api/export` - global export of any `MapDocument`.
- `POST /api/ai-bridge/import-plan` - import a validated `MapPlan` from
  ChatGPT into a new project or an existing one, with optional auto-repair.

## Local worker

The FastAPI worker exposes `/health`, `/jobs`, `/jobs/{job_id}`,
`/jobs/{job_id}/cancel`, and placeholder job endpoints for asset scanning,
reference scanning, and image analysis. The in-memory job store keeps `id`,
`type`, `status`, `progress`, `message`, `createdAt`, `updatedAt`, `result`,
and `error`. Real execution beyond the placeholder is the next step. See
[docs/WORKER.md](docs/WORKER.md).

## Exports

Five formats, three visibility modes. The exporter package ships:

- **PNG / WEBP** raster export from the current `MapDocument`.
- **dd2vtt** Universal VTT JSON with embedded image, walls, doors, lights.
- **Foundry VTT** installable module zip with scene, walls, doors, lights.
- **dmimap** proprietary editable JSON snapshot with mode and version.

Visibility modes:

- `player` - hides secret rooms, secret/trap doors, annotation layer,
  GM/spoiler notes. Hidden-room floor tiles become `empty`.
- `gm` - everything visible. Default.
- `clean` - like `player` but also strips notes and lighting.

## Troubleshooting

- If `pnpm install --frozen-lockfile` fails, update dependencies locally with
  `pnpm install` and commit the lockfile intentionally.
- If the worker cannot import FastAPI, run `pnpm worker:install`.
- If asset previews are missing, rerun `pnpm assets:scan <folder>`.
- If `/assets/review/batches` shows an empty state, run `pnpm assets:audit`
  to create `data/indexes/asset-audit.json`.
- If JSON override files fail to parse, remove a UTF-8 BOM or validate the
  file with a JSON formatter.
- If a large asset pack appears in Git status, move it to an ignored local
  folder before committing.
