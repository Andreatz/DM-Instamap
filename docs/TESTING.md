# Testing

DM-Instamap uses automated tests for module contracts and manual reports for
real VTT confidence. The corrective roadmap still requires full manual E2E
reports with real assets and Foundry/dd2vtt imports; the automated layer exists
to catch regressions before those slower checks.

## Automated checks

Run from the repository root:

```bash
pnpm lint
pnpm test
pnpm build
pnpm --filter @dm-instamap/worker test
```

Targeted checks used by the generator/UI phases:

```bash
pnpm --filter @dm-instamap/generator lint
pnpm --filter @dm-instamap/generator test
pnpm --filter @dm-instamap/web lint
pnpm --filter @dm-instamap/web test
```

## UI smoke contract

The web app keeps a lightweight smoke-flow manifest in
`apps/web/src/lib/ui-smoke-flows.ts`. It documents at least eight local-first UI
flows and the unit/route tests that currently guard each one:

- home;
- project wizard;
- generator preview;
- editor save/reopen;
- snapshots and diff;
- project export / session pack;
- campaigns;
- asset browser without a manifest;
- references review;
- manual AI bridge.

This is not a browser E2E replacement. It is a small CI-friendly contract that
prevents fragile flows from becoming undocumented while Playwright/manual
coverage is expanded.

## Manual reports

Use `docs/manual-test-reports/TEMPLATE.md` for real end-to-end runs. A map is
not considered proven for table use until the relevant PNG/WEBP, dd2vtt,
Foundry, and Session Pack outputs have been opened or imported manually.
