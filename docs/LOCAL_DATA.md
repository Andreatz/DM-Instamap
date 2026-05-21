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
