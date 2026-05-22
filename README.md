# DM-Instamap

DM-Instamap e un generatore modulare local-first di mappe per D&D. Il suo
obiettivo e aiutare un DM a importare asset locali, generare mappe giocabili,
modificarle in un editor visuale e riesportarle per il tavolo o per VTT.

Il progetto non richiede cloud, login o API a pagamento. Il bridge AI e
opzionale: il flusso manuale funziona via copia/incolla, il provider mock e
locale e i provider remoti si attivano solo tramite variabili d'ambiente.

## Stato Attuale

Il progetto e una monorepo pnpm con:

- editor web Next.js in `apps/web`;
- worker Python/FastAPI locale in `apps/worker` per job lunghi;
- schemi e tipi condivisi in `packages/core`;
- scanner, classificazione, gruppi, audit e reference Style DNA in
  `packages/assets`;
- generatori dungeon, cave, village, outdoor e multi-floor in
  `packages/generator`;
- export PNG, WEBP, dd2vtt, Foundry VTT, dmimap e Session Pack in
  `packages/exporters`;
- bridge AI manuale/opzionale in `packages/ai-bridge`;
- documentazione operativa in `docs/`.

La roadmap attiva e [docs/ROADMAP.md](docs/ROADMAP.md), dedicata al percorso
verso 9.5/10. Le roadmap precedenti sono archiviate in
[docs/LEGACY_ROADMAP.md](docs/LEGACY_ROADMAP.md).

## Requisiti

- Node.js 24 o superiore.
- pnpm 10 o superiore.
- Python 3.12 o superiore per il worker.
- Git.

Su Windows, la guida rapida e in [docs/WINDOWS_SETUP.md](docs/WINDOWS_SETUP.md).

## Setup Rapido

```bash
pnpm install
pnpm worker:install
pnpm doctor
```

Se servono override locali:

```bash
cp .env.local.example .env.local
```

Lascia le variabili AI vuote per lavorare in modalita local-first/manuale.

## Avvio Locale

Terminale 1:

```bash
pnpm dev
```

Terminale 2, solo per job lunghi tramite worker:

```bash
pnpm worker:dev
```

Apri:

```txt
http://127.0.0.1:3000
```

Il worker risponde su:

```txt
http://127.0.0.1:8000
```

## Primo Flusso Utile

1. Metti asset personali o con licenza in una cartella locale non versionata,
   ad esempio `local-assets/`.
2. Scansiona e organizza la libreria:

```bash
pnpm assets:scan ./local-assets
pnpm assets:group
pnpm assets:audit
```

3. Apri l'app web e crea un progetto dal wizard.
4. Modifica la mappa nell'editor: celle, asset, layer, luci, note GM,
   iniziativa, snapshot.
5. Esporta in PNG/WEBP, dd2vtt, Foundry o Session Pack.

I dati generati vivono sotto `data/` e sono ignorati da Git.

## Comandi Principali

```bash
pnpm dev                         # app web Next.js
pnpm worker:dev                  # worker locale FastAPI
pnpm doctor                      # diagnosi ambiente locale
pnpm repo:audit                  # blocca dati/binari locali tracciati

pnpm assets:scan <folder>        # scanner asset locale
pnpm assets:group                # gruppi asset
pnpm assets:audit                # duplicati/qualita/review
pnpm references:scan <folder>    # scanner mappe reference
pnpm references:style            # Reference Style DNA

pnpm generator:benchmark         # benchmark qualita generatore
pnpm exports:session-pack <id>   # export pacchetto sessione

pnpm ai:blueprint "..."          # smoke CLI bridge AI opzionale
pnpm ai:plan "..."               # piano AI opzionale o mock
```

## Qualita E Test

Comandi di base oggi disponibili:

```bash
pnpm repo:audit
pnpm lint
pnpm test
pnpm build
pnpm --filter @dm-instamap/worker test
```

Per i flussi UI:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Nota: al momento `pnpm lint` e ancora il gate TypeScript/compileall dei package.
La Fase A della roadmap introduce lint reale, format check, typecheck separato,
coverage e lint Python con ruff/mypy.

Dettagli in [docs/TESTING.md](docs/TESTING.md).

## Dati Locali

Non committare asset pesanti, mappe personali o output generati. I percorsi
locali previsti sono:

```txt
data/assets/
data/indexes/
data/previews/
data/projects/
data/exports/
data/campaigns/
```

Vedi [docs/LOCAL_DATA.md](docs/LOCAL_DATA.md) per rigenerazione, audit e policy
di validazione path.

## Documentazione

- [docs/architecture.md](docs/architecture.md): architettura monorepo.
- [docs/ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md): scan, import, audit,
  gruppi e reference.
- [docs/EDITOR.md](docs/EDITOR.md): editor visuale e hotkey.
- [docs/GENERATOR.md](docs/GENERATOR.md): generatori e benchmark.
- [docs/EXPORTS.md](docs/EXPORTS.md): PNG, WEBP, dd2vtt, Foundry, Session Pack.
- [docs/WORKER.md](docs/WORKER.md): worker locale e job lunghi.
- [docs/AI_BRIDGE.md](docs/AI_BRIDGE.md): bridge AI manuale, mock e provider
  opzionali.
- [docs/PROJECTS.md](docs/PROJECTS.md): progetti locali e multi-floor.
- [docs/CAMPAIGNS.md](docs/CAMPAIGNS.md): campagne locali.
- [docs/SNAPSHOTS.md](docs/SNAPSHOTS.md): snapshot, diff e restore.
- [docs/VTT_EXPORT.md](docs/VTT_EXPORT.md): fidelity export VTT.
- [docs/manual-test-reports/](docs/manual-test-reports/): report manuali.

## Regole Di Progetto

- Local-first sempre.
- Niente API a pagamento obbligatorie.
- Asset intelligence locale prima di tutto.
- Ogni feature deve avere test.
- Ogni mappa generata deve restare editabile.
- Gli export devono rimanere compatibili con PNG, WEBP, dd2vtt e Foundry VTT.
- I task restano piccoli e la documentazione va aggiornata con le modifiche
  importanti.
