# 3. Biome for lint and format

- Status: Accepted
- Date: 2026-05-23

## Context

The original `lint` script was only `tsc --noEmit`: there was no real linter and
no formatter for the TypeScript/JS/CSS code. The alternatives were ESLint flat
config with `typescript-eslint` plus Prettier, or Biome (a single tool for both
lint and format).

## Decision

We use Biome for TypeScript/JS/CSS linting and formatting, configured once in
`biome.json`. The Python worker uses ruff (lint + format) and mypy --strict. The
scripts are split: `lint` runs the linter, `format:check` runs the formatter,
and `typecheck` runs `tsc --noEmit`. A rule forbids reintroducing `any`.

## Consequences

- One fast tool, one config, no ESLint/Prettier coordination.
- The team must accept Biome's rule set; rules are only disabled explicitly and
  documented in [CODE_QUALITY.md](../CODE_QUALITY.md).
- CI runs `format:check`, `lint` and `typecheck` as distinct, green gates.
