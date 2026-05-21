# Exports

The first raster export pipeline lives in `packages/exporters`.

## Supported Formats

- PNG
- WEBP
- dd2vtt / Universal VTT
- Foundry VTT module zip (with optional journals + scene notes pin)
- DMIMAP project payload
- Session Pack zip (full / GM / player PNGs + GM notes + initiative)

## Raster Options

`exportMapDocumentRaster` accepts:

- `format`: `png` or `webp`
- `includeGrid`: show or hide square grid lines
- `layers`: optional render filter for `floor`, `walls`, `doors`, `props`, and `lighting`
- `background`: `default` or `transparent`
- `scale`: output resolution multiplier from `0.5` to `4`
- `webpQuality`: WEBP quality from `1` to `100`
- `assetResolver`: optional local resolver that maps placed `assetId` values
  to absolute image paths for Sharp compositing

The renderer draws map tiles and doors from the editable `MapDocument`. When an
`assetResolver` is provided, placed assets are rendered from their original PNG
or WEBP artwork with scale, rotation, `flipX`, `flipY`, transparency, and layer
filtering. Missing assets do not crash the export: the renderer keeps a marker
fallback and returns `warnings`, `usedAssets`, and `missingAssets` in the raster
result.

`createAssetManifestResolver` reads `data/indexes/assets.manifest.json` and
resolves each manifest `relativePath` against its `sourceRoot`. The web export
routes use it for local PNG/WEBP exports so generated files can contain real
local asset artwork instead of symbolic circles.

`exportMapDocumentRasterLayers` exports VTT-friendly transparent layer images
for floor, walls, doors, props, and lighting. This is the current basis for
future split-layer PNG/WEBP export in the web UI.

`exportMapDocumentRasterLayerBundle` writes those separated layers into a zip
with a small `manifest.json`. The project export UI can return this bundle for
PNG or WEBP when split-layer export is enabled.

## Editor

The `/editor` export panel sends the current `MapDocument` to the local Next.js
API route at `/api/export` and downloads the returned image.

## dd2vtt Import

Universal VTT / dd2vtt import is available from `packages/exporters` through
`importDd2Vtt` and `importDd2VttFile`. The importer converts local dd2vtt JSON
into an editable `MapDocument` and extracts embedded map image bytes when they
are available.

## dd2vtt Export

`exportMapDocumentDd2Vtt` converts a `MapDocument` into dd2vtt-compatible JSON.
It embeds a rendered map image by default and includes grid resolution, walls,
doors, and lights. Door portals include both center/rotation data and explicit
`bounds` coordinates for VTT importers. If a document has no explicit plan
walls, the exporter derives line-of-sight segments from wall tiles.

## Foundry VTT Module Export

`exportFoundryModule` creates a zip module with `module.json`, scene data, a
scene pack file, and the rendered map image. Walls, doors, lights, and grid
settings are converted from the editable `MapDocument`.

When `includeJournals` is enabled (default), the zip also contains a journal
pack with one entry per `RoomNode`, one per `MapNote`, and one for plan-level
notes. The scene then carries a `notes` array where each GM note is a pin
linking to the matching journal page via `entryId`/`pageId`. See
[FOUNDRY_EXPORT.md](FOUNDRY_EXPORT.md) for the manual-verification checklist.

## Session Pack

`exportSessionPack` produces a zip with:

- `maps/<slug>-full.png`
- `maps/<slug>-gm.png`
- `maps/<slug>-player.png`
- `notes/gm-notes.json`
- `notes/plan-notes.txt`
- `notes/description.txt`
- `initiative/initiative.json` (when `includeInitiative` is true)
- `manifest.json`

Trigger it from:

- `POST /api/projects/[id]/export` with `{ "format": "session-pack", ... }`
- the editor toolbar "Session Pack" button (I2)
- the CLI:

```bash
pnpm exports:session-pack <projectId> --scale 2 --include-initiative --description "Session notes"
```

The command reads `data/projects/<projectId>/map.dmimap.json` and writes a zip
under `data/projects/<projectId>/exports/` by default. Use `--output <path>` to
choose a file or directory. Supported image formats are `png` and `webp`.

The same job is also exposed as a fire-and-forget worker task at
`POST /jobs/exports/session-pack` for scales that would otherwise tie up a
Next.js request (see [WORKER.md](WORKER.md) H4).
