# Local Data

DM-Instamap is local-first: asset libraries, generated previews, indexes,
projects and exports live on the local machine. These files are runtime data,
not source code.

## Ignored local folders

The following folders must stay out of Git:

```txt
data/indexes/
data/previews/
data/projects/
data/exports/
data/raw-assets/
local-assets/
local-references/
assets-local/
reference-maps-local/
```

`data/indexes/` stores generated manifests, overrides, audits, groups and
embedding indexes.

`data/previews/` stores generated WEBP thumbnails for assets and reference
maps.

`data/projects/` stores local maps, snapshots and project metadata.

`data/exports/` stores generated export artifacts.

## Regenerating data

Indexes and previews can be rebuilt from local source folders:

```bash
pnpm assets:scan <folder>
pnpm assets:group
pnpm assets:audit
pnpm assets:embed
pnpm references:scan <folder>
pnpm references:style
```

Pack import can rebuild asset manifests from a supported pack folder:

```bash
pnpm assets:import-pack --root <path> --preset generic
```

## Backup e restore

I dati locali (progetti, campagne, indici opzionali) si salvano e ripristinano
con due comandi:

```bash
pnpm data:backup                          # in ./backups (ignorato da Git)
pnpm data:backup --out /percorso/esterno  # es. una chiavetta USB
pnpm data:backup --include-indexes        # include anche data/indexes
pnpm data:restore <cartella-backup> --dry-run   # mostra cosa farebbe
pnpm data:restore <cartella-backup>             # ripristina senza sovrascrivere
pnpm data:restore <cartella-backup> --force     # sovrascrive i conflitti
```

Cosa includere/escludere:

- **Incluso**: `data/projects/` e `data/campaigns/` (i dati insostituibili).
- **Opzionale** (`--include-indexes`): `data/indexes/` (rigenerabile dagli asset).
- **Escluso**: `data/previews/` e `data/exports/`, rigenerabili.

Formato del backup:

- una cartella versionata `dm-instamap-backup-<timestamp>/` con i file copiati e
  un `backup-manifest.json` (`version`, `createdAt`, `sections`, e per ogni file
  `path` + checksum `sha256` + dimensione);
- il restore verifica i checksum prima di scrivere e si interrompe se un file e
  mancante o alterato;
- senza `--force` i file esistenti non vengono sovrascritti e sono elencati come
  conflitti; con `--dry-run` non viene scritto nulla;
- le destinazioni broad o di sistema (home, root del disco, cartelle di sistema)
  sono rifiutate riusando `validateLocalPath`.

Rotazione e conservazione: tieni piu backup datati (il nome include il
timestamp) e conserva almeno una copia su un supporto separato dalla macchina di
gioco. I backup in `./backups/` sono ignorati da Git.

## Repository audit

Run this before committing:

```bash
pnpm repo:audit
```

The audit fails if generated local data or unexpected binary assets are tracked
by Git. Tiny intentional test fixtures should live under package or app test
fixtures, not under `data/`.

## Path validation policy

Web routes that accept file-system paths must validate them before reading,
writing or forwarding them to the worker.

Current rules:

- empty paths are rejected;
- relative paths must stay inside the DM-Instamap workspace;
- absolute paths outside the workspace are allowed only when the route
  explicitly opts in, for example local asset-pack import;
- home roots, drive roots and system folders are rejected;
- routes can require the target to exist before starting long-running work.

The web helper is:

```txt
apps/web/src/lib/local-paths.ts
```

The worker keeps its own FastAPI-side guard in:

```txt
apps/worker/src/dm_instamap_worker/security.py
```

These two policies should stay aligned when new routes are added.
