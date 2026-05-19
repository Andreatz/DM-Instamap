# Architecture

DM-Instamap is organized as a local-first monorepo.

## Applications

- `apps/web` contains the Next.js visual editor.
- `apps/worker` contains the FastAPI worker for local asset processing.

## Packages

- `packages/core` owns shared map document types.
- `packages/assets` owns local asset scanning and classification helpers.
- `packages/generator` owns procedural map generation.
- `packages/exporters` owns export format support.
- `packages/ai-bridge` owns the optional manual ChatGPT prompt workflow and
  local Zod validation. It does not call paid APIs.

## Principles

- Generated maps must remain editable.
- Asset intelligence must work locally.
- Binary assets should stay outside Git unless they are intentionally tiny test
  fixtures.
- Export design should leave room for PNG, WEBP, dd2vtt, and Foundry VTT.
