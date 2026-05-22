# Data Model

DM-Instamap stores maps as editable local documents. The TypeScript types in
`packages/core` are inferred from Zod schemas, so runtime validation and compile
time types stay aligned.

## Core entrypoint rule

Browser code must import map and campaign types from
`@dm-instamap/core/browser`. Node-only code such as route handlers, CLIs, and
snapshot/project persistence can import from `@dm-instamap/core/server`.
The server entrypoint includes filesystem-backed snapshot helpers; the browser
entrypoint intentionally does not.

## MapDocument migrations

Read/import paths must use `migrateMapDocument(input)` instead of parsing
unknown JSON with `MapDocumentSchema.parse` directly. The current schema version
is `version: 1`; legacy documents without a version are treated as v0 and
upgraded with default editable fields, grid defaults, layers, tiles, and asset
arrays before validation. `.dmimap.json` export payloads are unwrapped and then
migrated through the same path.

Future schema changes require a new incremental migration and fixture before
saved projects are considered compatible.

## v2 preparation

`packages/core` now includes `MapDocumentV2Schema` and
`upgradeMapDocumentToV2(input)` as an explicit preparation path. The app still
persists current project maps as `version: 1`, but tests cover automatic v1 to
v2 upgrade so a future bump can be introduced without breaking older saves.

The v2 preparation schema adds `metadata` for:

- `exportHistory` entries (`png`, `webp`, `dd2vtt`, `foundry`, `dmimap`,
  `session-pack`);
- `thumbnailPath`;
- `schemaChangelog`, currently seeded with `v1-to-v2`.

`validateMapDocumentAssetReferences(document, knownAssetIds)` reports missing
asset references from both document-level placements and plan placements. Each
issue includes a usage category:

- `tile-texture` for floor/wall texture placements;
- `semantic-object` for object and lighting placements;
- `asset-placement` for generic annotation or fallback placements.

## AssetMetadata

Describes one local asset discovered by the scanner, such as a tile, prop, wall,
door, light, texture, or reference image. Assets always use `source: "local"`.

## AssetGroup

Groups local asset ids into a reusable set, for example a stone dungeon pack or
a tavern furniture set. Generated groups can also include kind, asset count,
representative asset id, representative thumbnail, and tags for browsing.
Manual review can add `theme`, `themes`, `usableFor`, and `qualityScore`
signals for local room matching.

## ReferenceMapMetadata

Stores metadata for a local reference map image. It can include grid information
when the reference image has already been aligned. The reference registry also
tracks map type guesses, dominant colors, generated thumbnails, and filename or
folder tags.

## MapRequest

Captures the user's non-AI map request: map kind, theme, grid, required rooms,
reference maps, asset groups, and requested export formats.

## MapPlan

Represents the generated or manually adjusted plan before final editing. It
contains rooms, walls, doors, light sources, GM notes, initiative entries, and
asset placements.

## MapDocument

The editable map document. It includes grid settings, dimensions, optional plan
data, placed assets, and simple tile data used by the current starter generator.
Every valid document has `editable: true`.

## RoomNode

Defines a room, corridor, entrance, stairs, secret area, or service space with
bounds and room connections.

## WallSegment

Defines a wall line with start/end points, thickness, optional material, and
movement blocking behavior.

## DoorSegment

Defines a door position, width, rotation, lock/open state, and optional wall or
room associations.

## LightSource

Defines local lighting metadata such as type, position, color, radius, and
intensity. Editor lights can also store a `flicker` flag for local preview and
future VTT exports.

## MapNote

Defines a GM-only note anchored to a map coordinate. Notes have a title, body
text, and position so they can be edited with the map and hidden with the Notes
layer.

## InitiativeEntry

Defines a lightweight combat tracker row stored inside the map plan. Entries
include name, side, initiative value, optional hit points, optional armor class,
and optional notes.

## PlacedAsset

Defines a concrete asset placement on the editable map, including position,
layer, rotation, scale, lock state, optional group id, and tags.

Placed assets are also classified by usage for future migrations: floor/wall
placements behave as tile textures, object/lighting placements behave as
semantic objects, and annotations remain generic asset placements.

## GridConfig

Defines the square grid used by map generation and editing: cell size, unit,
pixel density, dimensions, and origin.

## ExportJob

Tracks a requested export to PNG, WEBP, dd2vtt, or Foundry. Completed jobs must
include an output path, and failed jobs must include an error message.

## DmInstamapProjectMetadata

Stored at `data/projects/<id>/project.json`, this metadata describes the
project around the editable `MapDocument`. Fields:

- `id`, `name`, `createdAt`, `updatedAt`
- `sourceRequest` — narrative request used to seed the map
- `selectedAssetGroupIds`, `selectedReferenceIds`, `styleDnaIds`
- `relatedProjectIds` — ids of other projects linked to this one, used by
  multi-floor dungeons. The `POST /api/projects/multi-floor` route fills
  this list during multi-floor save (F2); the project page surfaces the
  links and routes the "Open Floors Overview" button to
  `/projects/[id]/floors` (L5).

## SnapshotRecord and DeltaSnapshotRecord

Snapshots are stored at `data/projects/<id>/snapshots/<iso>__<hash>.json`.
Each `SnapshotRecord` carries the full `MapDocument` and a stable
`contentHash` for dedup.

`DeltaSnapshotRecord` (added in L1) carries only the fields that changed
versus a `parentHash`, plus the same metadata. `computeMapDocumentDelta`,
`applyMapDocumentDelta`, `createDeltaSnapshot`, and `restoreDeltaSnapshot`
in `packages/core/src/snapshots.ts` provide the API for it. The on-disk
storage still uses the full `SnapshotRecord` format; the delta API is
library-ready for an incremental migration.
