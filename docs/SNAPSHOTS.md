# Snapshots

Project snapshots let you archive the current `MapDocument` state and roll back
later without leaving the local-first workflow.

## Storage layout

Snapshots are written under each project folder:

```txt
data/projects/<projectId>/snapshots/<isoTimestamp>__<contentHash>.json
```

Each file is a `SnapshotRecord` (see `packages/core/src/snapshots.ts`):

```ts
{
  contentHash: "abcd1234...",       // SHA-256 of stable JSON, truncated to 16 chars
  createdAt: "2026-05-21T09:12:33.401Z",
  documentId: "crypt-below-cathedral",
  label: "before-edit",
  projectId: "crypt-below-cathedral",
  document: { /* full MapDocument */ }
}
```

Identical content is deduplicated by `contentHash`: `writeSnapshotToDirectory`
returns `{ written: false, filePath }` when the same hash already exists.

## API

The web app exposes:

- `GET /api/projects/[id]/snapshots` - list snapshots (metadata only).
- `POST /api/projects/[id]/snapshots` - body `{ "label": "..." }`. Creates a
  snapshot of the current `project.document`.
- `GET /api/projects/[id]/snapshots/[hash]` - full record.
- `POST /api/projects/[id]/snapshots/[hash]` - restores the snapshot's
  `MapDocument` into the project.
- `GET /api/projects/[id]/snapshots/[hash]/diff?against=current|<otherHash>` -
  returns a `SnapshotDiff` listing `changedFields`. When `against=current` the
  diff is computed against the live project document.

## Diff fields

`diffSnapshots(left, right)` reports which top-level fields changed:

```
name | width | height | tiles | rooms | walls | doors | lights |
assets | gmNotes | initiative | layers
```

Equality is string-based on JSON serialization, so two equivalent structures
with different key orderings would report as changed; the snapshot factory uses
`MapDocumentSchema.parse` to stabilise order before hashing.

## CLI

```bash
pnpm snapshots:create <projectId> --label before-edit
pnpm snapshots:list <projectId>
pnpm snapshots:restore <projectId> <contentHash>
```

These commands operate on the same `data/projects/<id>/snapshots` directory.

## UI

The project page hosts a `ProjectSnapshotsPanel` with:

- inline label + "Snapshot Current State" form;
- per-snapshot "Diff vs current" button showing the list of changed
  fields;
- "Restore" button that overwrites the live document.

The Map Editor toolbar adds an inline "Snapshot" button and the
`Ctrl+Shift+S` hotkey, labelling automatic snapshots as
`editor-<timestamp>`.

## Delta snapshots

`packages/core/src/snapshots.ts` exposes a parallel delta-snapshot API for
the eventual move from "snapshot zero + full copies" to "snapshot zero +
JSON-Patch-like deltas":

```ts
import {
  computeMapDocumentDelta,
  applyMapDocumentDelta,
  createDeltaSnapshot,
  restoreDeltaSnapshot,
  DeltaSnapshotRecordSchema
} from "@dm-instamap/core";

const baseRecord = createMapSnapshot({
  document: baseDocument,
  label: "base",
  projectId: "crypt"
});
const delta = createDeltaSnapshot({
  base: baseRecord,
  document: updatedDocument,
  label: "post-edit",
  projectId: "crypt"
});

// delta.fields only contains the top-level MapDocument keys that changed.
const restored = restoreDeltaSnapshot(baseRecord, delta);
```

`DeltaSnapshotRecordSchema` is the Zod schema for the delta record, with
`parentHash`, `delta.fields`, and the usual metadata. The on-disk format
remains the full `SnapshotRecord` for now - the delta helpers are
library-ready for an opt-in migration when full snapshots start to weigh
on disk.
