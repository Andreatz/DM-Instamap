# DM-Instamap

DM-Instamap is a local-first modular map generator for D&D. It scans local art
libraries, groups and reviews assets, generates editable maps, and exports maps
for table or VTT use without requiring paid APIs.

The project is still an MVP. The strongest parts today are the local asset
pipeline, reference registry, simple generator, editor foundations, raster
export, dd2vtt/Foundry exporter foundations, and the manual ChatGPT bridge.
Advanced AI remains optional and copy/paste based.

## Current capabilities

- Scan local image assets and generate lightweight previews.
- Classify assets heuristically and correct them with local override files.
- Review assets individually or by group for large libraries.
- Scan reference maps and review metadata.
- Generate a simple editable dungeon `MapDocument`.
- Edit maps in the web app and drag local assets onto a grid.
- Export PNG and WEBP from the current map document.
- Import and export dd2vtt-compatible data.
- Generate a Foundry VTT module zip.
- Build manual ChatGPT prompts and validate pasted JSON locally.

## MVP limits

- No paid API is required or called.
- Local visual embeddings are simple heuristics, not a heavy ML model.
- The editor is intentionally minimal and still evolving toward a full canvas
  project workflow.
- Raw asset packs and generated project/export output should stay outside Git.

## Workspace

- `apps/web` - Next.js visual editor and UI.
- `apps/worker` - Python FastAPI worker for local heavy asset processing.
- `packages/core` - Shared TypeScript types and map document helpers.
- `packages/assets` - Local asset scanning and classification helpers.
- `packages/generator` - Dungeon/building/city generation foundations.
- `packages/exporters` - Future PNG, WEBP, dd2vtt, and Foundry exporters.
- `packages/ai-bridge` - Optional manual ChatGPT bridge placeholder.
- `docs` - Architecture notes, roadmap, and manuals.

## Requirements

- Node.js 24 or newer.
- pnpm 10 or newer.
- Python 3.12 or newer.

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
pnpm assets:embed
pnpm references:scan <folder>
```

The scanner writes lightweight metadata to `data/indexes/` and thumbnails to
`data/previews/`. Keep original asset libraries in ignored folders such as
`local-assets/`, `assets-local/`, `local-references/`, or external storage.

## Web routes

- `/assets` - asset browser with filters and search.
- `/assets/review` - single asset correction workflow.
- `/asset-groups` - grouped asset browser.
- `/asset-groups/review` - batch-oriented group review.
- `/references` - reference map browser.
- `/references/review` - reference correction workflow.
- `/generate` - simple procedural dungeon preview.
- `/editor` - first map editor.
- `/ai-bridge` - manual ChatGPT bridge, no API calls.

## Local worker

The FastAPI worker exposes `/health`, `/jobs`, and placeholder job endpoints for
asset scanning, reference scanning, and image analysis. See `docs/WORKER.md`.

## Exports

The exporter package contains foundations for:

- PNG
- WEBP
- dd2vtt
- Foundry VTT module zip

Raster export is available from the editor API. dd2vtt and Foundry support are
kept in `packages/exporters` with tests and docs.

## Troubleshooting

- If `pnpm install --frozen-lockfile` fails, update dependencies locally with
  `pnpm install` and commit the lockfile intentionally.
- If the worker cannot import FastAPI, run `pnpm worker:install`.
- If asset previews are missing, rerun `pnpm assets:scan <folder>`.
- If JSON override files fail to parse, remove a UTF-8 BOM or validate the file
  with a JSON formatter.
- If a large asset pack appears in Git status, move it to an ignored local
  folder before committing.
