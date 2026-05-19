# DM-Instamap

DM-Instamap is a local-first modular map generator for D&D. The MVP focuses on
asset scanning, asset browsing, manual correction, a simple dungeon generator,
an editable map editor, and PNG export. Optional AI bridge work comes later and
must not be required for local use.

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

The current worker tests use Python's standard library so the full root
`pnpm test` command works after `pnpm install`. Running the FastAPI server
requires `pnpm worker:install`.
