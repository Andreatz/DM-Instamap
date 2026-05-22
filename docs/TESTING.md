# Testing

DM-Instamap usa test automatici per i contratti dei moduli e report manuali per
validare i flussi reali da tavolo, in particolare gli import Foundry/dd2vtt.
I test automatici catturano regressioni veloci; i report manuali restano la
prova finale con asset e VTT reali.

## Controlli Automatici Correnti

Esegui dalla root del repository:

```bash
pnpm repo:audit
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
pnpm --filter @dm-instamap/worker lint
pnpm --filter @dm-instamap/worker test
```

`lint` (Biome), `typecheck` (`tsc --noEmit`) e `format:check` sono comandi
distinti; il worker usa `ruff` + `mypy --strict`; `test:coverage` applica le
soglie di coverage. Dettagli, regole disattivate, soglie e CI in
[docs/CODE_QUALITY.md](CODE_QUALITY.md).

Controlli mirati usati durante le fasi generator/UI:

```bash
pnpm --filter @dm-instamap/generator typecheck
pnpm --filter @dm-instamap/generator test
pnpm --filter @dm-instamap/web typecheck
pnpm --filter @dm-instamap/web test
pnpm test:e2e
```

## Playwright

Playwright e configurato in `playwright.config.ts`. Avvia l'app Next.js locale
su `127.0.0.1:3000` (con `AI_PROVIDER=mock`, nessuna chiamata esterna) e lancia
test Chromium sotto `tests/e2e/`. Gli helper condivisi sono in
`tests/e2e/helpers.ts`; ogni test crea e ripulisce i propri dati temporanei.

Copertura E2E (Fase D):

- `core-flows`: home, wizard, generator preview, editor save + PNG, snapshot
  diff/restore, export WEBP/dd2vtt/Session Pack, session-ready;
- `editor-interactions`: undo/redo e copia/incolla + raggruppa/separa asset
  nell'editor reale;
- `foundry-export`: zip Foundry valido e toggle dei journal;
- `import-pack`: indicizzazione di una fixture asset versionata
  (`tests/fixtures/asset-pack/`, due PNG sintetici) con backup/restore del
  manifest locale;
- `multi-floor`: creazione di piani collegati e pagina `/projects/[id]/floors`;
- `campaigns`: crea campagna, collega un progetto, aggiungi una sessione;
- `ai-bridge`: provider mock locale (`AI_PROVIDER=mock`), nessuna chiave.

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
