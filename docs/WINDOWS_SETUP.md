# Windows Setup

This is the short local-first setup path for a new Windows machine.

## Requirements

- Node.js 24 or newer.
- pnpm 10 or newer.
- Python 3.12 or newer when using the worker.
- Git.

## Install

```powershell
pnpm install
pnpm worker:install
```

Copy the local template only when you need machine-specific overrides:

```powershell
Copy-Item .env.local.example .env.local
```

Keep AI variables empty for local-only/manual bridge mode.

## Check The Machine

```powershell
pnpm run doctor
```

The doctor checks Node, pnpm, Python, worker requirement files, Sharp, env
templates, and whether the default web/worker ports are already occupied.

Warnings are usually recoverable. Failures should be fixed before importing a
large asset pack.

## Run

Terminal 1:

```powershell
pnpm dev
```

Terminal 2, only when using worker offload:

```powershell
pnpm worker:dev
```

Open:

```txt
http://127.0.0.1:3000
```

## First Asset Import

Place personal or licensed asset packs outside Git-tracked folders, for
example under `local-assets/`, then run:

```powershell
pnpm assets:scan .\local-assets
pnpm assets:group
pnpm assets:audit
```

Generated indexes and previews live under `data/` and are ignored by Git.
