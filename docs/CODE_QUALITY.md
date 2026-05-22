# Qualita del codice, lint e CI

Questo documento descrive il gate di qualita introdotto nelle Fasi A e B della
[roadmap](ROADMAP.md): lint reale, formattazione, typecheck separato, lint
Python con ruff + mypy, soglie di coverage e CI su Linux e Windows.

## Comandi di chiusura

Da eseguire dalla root del repository:

```bash
pnpm format:check   # Biome: verifica formattazione (non scrive)
pnpm lint           # Biome: lint TypeScript/JS/CSS (fallisce anche sui warning)
pnpm typecheck      # tsc --noEmit su ogni package TS
pnpm test           # test unit/contract di tutti i package
pnpm test:coverage  # test + soglie di coverage (gate)
pnpm build          # build di tutti i package
pnpm --filter @dm-instamap/worker lint   # ruff (check + format) + mypy --strict
pnpm --filter @dm-instamap/worker test   # test del worker Python
```

Se la modifica tocca flussi UI:

```bash
pnpm test:e2e       # Playwright (avvia il server Next locale)
```

Comando unico equivalente al lint+format di Biome usato in locale:

```bash
pnpm exec biome check --error-on-warnings   # format + lint insieme
pnpm format                                 # applica la formattazione
```

## TypeScript: Biome

Lo strumento scelto e **Biome** (lint + formatter in un'unica config,
`biome.json`). Sostituisce l'uso precedente di `tsc` come finto linter: ora
`lint` e il linter vero, `typecheck` e `tsc --noEmit`, `format`/`format:check`
sono la formattazione. Non e in uso ESLint/Prettier.

Stile applicato (allineato a `.editorconfig`): indentazione a 2 spazi, fine
riga `lf`, larghezza 80 colonne, virgolette doppie, punto e virgola sempre,
nessuna trailing comma.

Regole rilevanti attive:

- `suspicious/noExplicitAny: error` — impedisce di reintrodurre `any` nel
  sorgente (gia assente oggi, ora bloccato dal linter);
- set `recommended` di Biome per il resto.

Il riordino automatico degli import (`assist organizeImports`) e **disattivato**
per mantenere i diff piccoli; puo essere riattivato in futuro.

### Regole disattivate di proposito

Disattivate esplicitamente in `biome.json` con motivazione (nessuna regola
disattivata in modo silenzioso):

| Regola | Motivazione |
| --- | --- |
| `style/noNonNullAssertion` | La codebase e `strict` + `noUncheckedIndexedAccess` e usa assertion non-null deliberate in punti controllati. Forzare guardie a runtime ovunque sarebbe churn rischioso, da valutare semmai negli split della Fase C. |
| `performance/noImgElement` | App local-first senza server di image optimization: gli `<img>` su URL/asset locali sono intenzionali. |
| `a11y/useSemanticElements` | Regola opinabile che spinge `<fieldset>`/elementi semantici per raggruppamenti UI dove non sono adatti; va in conflitto con `useAriaPropsSupportedByRole`. La semantica a11y completa e oggetto della Fase I (audit con `axe`). |

### Soppressioni per-riga

Dove un avviso e un falso positivo locale o una scelta deliberata, si usa
`// biome-ignore lint/<gruppo>/<regola>: <motivo>` sulla riga immediatamente
sopra (per gli attributi JSX multilinea, sopra la riga dell'attributo). Esempi
presenti nel codice:

- `security/noDangerouslySetInnerHtml` — SVG deterministico generato da
  geometria fidata del documento, senza input utente;
- `suspicious/noArrayIndexKey` — liste statiche di sola lettura (errori,
  suggerimenti) dove l'indice e una chiave stabile;
- `correctness/useExhaustiveDependencies` — dipendenze usate come trigger di
  reset, o closure non ancora memoizzate (stabilizzazione prevista in Fase C);
- regole CSS (`noImportantStyles`, `noDescendingSpecificity`) su override
  deliberati.

## Python (worker): ruff + mypy

Config in [apps/worker/pyproject.toml](../apps/worker/pyproject.toml). Lo script
`pnpm --filter @dm-instamap/worker lint` esegue in sequenza:

```bash
ruff check src tests
ruff format --check src tests
mypy src
```

Scelte:

- **ruff lint**: set `E, F, I, B, UP`. `E501` (lunghezza riga) e ignorato perche
  la lunghezza e gia imposta da `ruff format`; resterebbero solo stringhe non
  spezzabili.
- **ruff per-file-ignores**: `tests/**` ignora `E402` (i test impostano env e
  `sys.path` prima di importare l'app: import non in cima intenzionali).
- **flake8-bugbear `extend-immutable-calls`**: `fastapi.Depends`, `Query`,
  `Path`, ecc. non vengono segnalati da `B008` perche sono l'idioma standard di
  FastAPI nei default degli argomenti.
- **mypy**: `strict = true` su `src`.

ruff e mypy sono in `apps/worker/requirements-dev.txt` e vengono installati da
`pnpm worker:install`.

## Dimensione dei file (gate)

`pnpm audit:size` ([scripts/audit-file-size.mjs](../scripts/audit-file-size.mjs))
applica il budget della Fase C: nessun file sorgente applicativo (non di test)
deve superare **700 righe** senza un'eccezione documentata.

Funziona come ratchet: i file gia oltre il limite sono elencati in un'allowlist
con la loro baseline e una motivazione; non possono crescere oltre quella
baseline e vanno rimossi man mano che vengono spezzati. Un file nuovo oltre 700
righe, o un file allowlist che cresce, fa fallire il gate (incluso in CI).

Stato split Fase C (tutti rientrati nel budget e rimossi dall'allowlist):
`generator/src/algorithms.ts` (per-algoritmo), `ai-bridge/src/index.ts`
(types/prompt/validation) e `use-map-editor-state.ts` (1430 -> 591 righe),
decomposto nei sotto-hook `useAssetSelection`, `useAssetClipboard`,
`useNotesAndInitiative`, `useLightingTools`, `useCanvasInteraction`,
`useEditorAi`, `useEditorPersistence`, `useEditorExport`, ognuno con test
dedicati. Per rientrare nel budget si spezza il file e si rimuove/abbassa la
voce corrispondente nell'allowlist.

## Soglie di coverage

`pnpm test:coverage` usa il provider v8 di Vitest con `include` e soglia per
package (config in `vitest.config.ts` di ogni package). Le soglie sono un gate
anti-regressione tarato poco sotto la copertura attuale; il merge fallisce se la
coverage scende sotto.

| Package | Coverage righe attuale | Soglia (lines) | Note |
| --- | --- | --- | --- |
| `core` | ~75% | 72 | Il target roadmap dell'80% richiede test aggiuntivi sui rami degli schemi Zod; gap noto. |
| `generator` | ~92% | 85 | Supera il target 80%. |
| `exporters` | ~86% | 80 | Rispetta il target 80%. |
| `assets` | ~81% | 76 | — |
| `ai-bridge` | ~72% | 68 | — |
| `web` (`src/lib`) | ~66% | 63 | Solo logica `src/lib`; UI coperta dagli E2E (Fase D). Rispetta il target 65%. |

Gli output di coverage finiscono in `coverage/` (ignorato da git).

## CI

Workflow: [.github/workflows/ci.yml](../.github/workflows/ci.yml). Un solo job
`ci` in matrice su `ubuntu-latest` e `windows-latest` (il target reale e
Windows). Step separati, nell'ordine:

1. `format:check`
2. `lint` (Biome)
3. `typecheck`
4. `lint` worker (ruff + mypy)
5. `test:coverage`
6. `test` worker
7. `build`
8. `test:e2e` (Playwright, con cache dei browser per OS)

I browser Playwright sono in `PLAYWRIGHT_BROWSERS_PATH` (percorso uniforme tra
OS) e messi in cache. Il report Playwright viene caricato come artifact solo in
caso di fallimento; coverage e report stanno in cartelle ignorate da git.

## Branch protection consigliata su `main`

Su GitHub, in *Settings -> Branches -> Branch protection rules* per `main`:

- **Require a pull request before merging**.
- **Require status checks to pass before merging** con i check richiesti:
  - `ci (ubuntu-latest)`
  - `ci (windows-latest)`
- **Require branches to be up to date before merging**.
- Opzionale: **Require linear history** e blocco delle force-push.

Con questi check il merge su `main` e bloccato se format, lint, typecheck, test,
coverage, build o E2E falliscono su uno dei due sistemi operativi.
