# Testing

DM-Instamap usa test automatici per i contratti dei moduli e report manuali per
validare i flussi reali da tavolo, in particolare gli import Foundry/dd2vtt.
I test automatici catturano regressioni veloci; i report manuali restano la
prova finale con asset e VTT reali.

## Controlli Automatici Correnti

Esegui dalla root del repository:

```bash
pnpm repo:audit
pnpm lint
pnpm test
pnpm build
pnpm --filter @dm-instamap/worker test
```

Al momento `pnpm lint` esegue il controllo TypeScript dei package TS e
`compileall` sul worker. La roadmap attiva prevede di separare questo gate in
`lint`, `typecheck`, `format:check`, coverage e lint Python reale con ruff/mypy.

Controlli mirati usati durante le fasi generator/UI:

```bash
pnpm --filter @dm-instamap/generator lint
pnpm --filter @dm-instamap/generator test
pnpm --filter @dm-instamap/web lint
pnpm --filter @dm-instamap/web test
pnpm test:e2e
```

## Playwright

Playwright e configurato in `playwright.config.ts`. Avvia l'app Next.js locale
su `127.0.0.1:3000` e lancia test Chromium sotto `tests/e2e/`.

La suite include smoke test di route/pagine e un flusso editor reale: crea un
progetto, apre il canvas, dipinge una cella, salva, verifica il documento via
API ed esporta PNG. Copre anche snapshot create/diff/restore e verifica export
WEBP, dd2vtt e Session Pack.

Installa il browser una volta con:

```bash
pnpm exec playwright install chromium
```

## UI Smoke Contract

La web app mantiene un manifest leggero in
`apps/web/src/lib/ui-smoke-flows.ts`. Documenta i flussi UI local-first e i test
unit/route che li proteggono:

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

Questo non sostituisce i check manuali di import VTT: e un contratto
CI-friendly affiancato agli smoke test Playwright e agli E2E editor/export.

## Report Manuali

Usa `docs/manual-test-reports/TEMPLATE.md` per i veri run end-to-end. Una mappa
non e considerata pronta per l'uso al tavolo finche gli output rilevanti
PNG/WEBP, dd2vtt, Foundry e Session Pack non sono stati aperti o importati
manualmente.
