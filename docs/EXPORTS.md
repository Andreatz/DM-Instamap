# Exports

The first raster export pipeline lives in `packages/exporters`.

## Supported Formats

- PNG
- WEBP

The package still lists `dd2vtt` and `foundry` as planned formats, but those are
not implemented yet.

## Raster Options

`exportMapDocumentRaster` accepts:

- `format`: `png` or `webp`
- `includeGrid`: show or hide square grid lines
- `scale`: output resolution multiplier from `0.5` to `4`

The current renderer draws map tiles, doors, and placed asset markers from the
editable `MapDocument`. It does not embed original asset artwork yet.

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
doors, and lights.

## Foundry VTT Module Export

`exportFoundryModule` creates a zip module with `module.json`, scene data, a
scene pack file, and the rendered map image. Walls, doors, lights, and grid
settings are converted from the editable `MapDocument`.
