# Changelog

All notable changes to DM-Instamap are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

This cycle took the project from the ~8/10 baseline to the 9.5/10 target defined
in [docs/ROADMAP.md](docs/ROADMAP.md).

### Added

- Real quality tooling: Biome (lint + format) for TypeScript/JS/CSS and
  ruff + mypy --strict for the Python worker (Fase A).
- Full CI on `ubuntu-latest` and `windows-latest` with separate format, lint,
  typecheck, coverage and E2E steps and per-package coverage gates (Fase B).
- File-size ratchet gate (`pnpm audit:size`) keeping application files under
  ~700 lines with documented exceptions (Fase C).
- Expanded Playwright E2E coverage: undo/redo, copy/paste, all exports,
  import-pack, multi-floor, campaigns and the AI bridge in mock mode (Fase D).
- Local backup/restore (`pnpm data:backup` / `pnpm data:restore`) with a
  versioned manifest and per-file checksums (Fase E).
- Hard playability invariants verified with property-based tests (fast-check)
  over many seeds, plus a frozen set of "strong" golden maps (Fase G).
- Reference Style DNA now influences dungeon geometry, not just tags (Fase H).
- Accessibility audit (`axe` in E2E) and an Italian-UI guard
  (`pnpm audit:ui-language`) (Fase I).
- One-command onboarding: `pnpm setup`, `pnpm start`, and a synthetic demo
  dataset (`pnpm data:seed-demo`) (Fase J).
- Virtualized asset browser and an explicit editor hydration budget for very
  large libraries, with bounded-render tests (Fase K).
- Import hardening and optional LAN controls: clear errors and grid-dimension
  clamping for dd2vtt import, fuzz tests for the dd2vtt and AI-plan parsers,
  HTML sanitization of Foundry journal content, plus `DM_INSTAMAP_ALLOWED_IPS`
  and `DM_INSTAMAP_RATE_LIMIT_PER_MINUTE` (Fase L).
- Governance: this changelog, a personal-use `LICENSE`, architecture decision
  records in [docs/adr/](docs/adr/), and a dependency-update policy in
  [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) (Fase M).

### Changed

- The root `lint` script now runs a real linter (Biome) instead of `tsc`;
  `typecheck` and `format:check` are separate commands.
- Universal path validation: every file-system route shares one policy with a
  guard test (Fase F).
- Large modules split into cohesive units: the editor state hook, the AI bridge,
  and the generator algorithms (Fase C).
- Coverage thresholds consolidated as a stable gate; the exporters floor was
  raised after the Fase L tests.

### Security

- dd2vtt import rejects malformed input with clear errors and cannot be coerced
  into allocating billions of tiles.
- Foundry journal exports escape all user-controlled text to prevent HTML
  injection.
- When `DM_INSTAMAP_ALLOW_REMOTE=true`, an optional IP allowlist and per-IP
  rate limit restrict LAN clients.

## [0.1.0]

- Initial local-first monorepo: Next.js editor, FastAPI worker, shared core,
  asset intelligence, generators, exporters and the optional AI bridge. See
  [docs/LEGACY_ROADMAP.md](docs/LEGACY_ROADMAP.md) for the phases that built it.
