# Exports

The first raster export pipeline lives in `packages/exporters`.

## Supported Formats

- PNG
- WEBP
- dd2vtt / Universal VTT
- Foundry VTT module zip
- DMIMAP project payload

## Raster Options

`exportMapDocumentRaster` accepts:

- `format`: `png` or `webp`
- `includeGrid`: show or hide square grid lines
- `layers`: optional render filter for `floor`, `walls`, `doors`, `props`, and `lighting`
- `background`: `default` or `transparent`
- `scale`: output resolution multiplier from `0.5` to `4`
- `webpQuality`: WEBP quality from `1` to `100`

The current renderer draws map tiles, doors, and placed asset markers from the
editable `MapDocument`. It does not embed original asset artwork yet.

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
