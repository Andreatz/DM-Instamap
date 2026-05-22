# Asset Scanner

The first DM-Instamap asset scanner is local-only and runs from the monorepo
root:

```bash
pnpm assets:scan <folder>
```

It recursively scans `png`, `jpg`, `jpeg`, `webp`, and `svg` files. The scanner
extracts a stable asset id, relative path, SHA-256 file hash, image dimensions,
extension, detectable transparency, and sampled dominant colors.

Results are written to:

- `data/indexes/assets.manifest.json`
- `data/previews/assets/*.webp`

The scanner uses CPU-only local image processing and does not call paid APIs.

## Single Image Analysis

For worker jobs or quick local checks, analyze one image with:

```bash
pnpm assets:analyze-image <image>
```

The command returns JSON with format, dimensions, transparency and sampled
dominant colors. It uses Sharp locally and does not call external APIs.

## Partial Rescan API

`packages/assets` exposes two helpers used when a single new file should be
added to the manifest without re-running the entire scan:

```ts
import { scanSingleAsset, appendAssetToManifest } from "@dm-instamap/assets";

const entry = await scanSingleAsset(absolutePath, {
  outputRoot: workspaceRoot,
  sourceRoot: workspaceRoot   // or the manifest's existing sourceRoot
});
const { appended, replaced, manifest } = await appendAssetToManifest(entry, {
  outputRoot: workspaceRoot
});
```

`scanSingleAsset` inspects a single file the same way the full scanner does
(hash, dominant colors, transparency, classification, thumbnail), but it
takes the `sourceRoot` as input so the resulting `relativePath` matches the
rest of the manifest. `appendAssetToManifest` reads the existing
`assets.manifest.json`, replaces or appends the entry (matched by id or
`relativePath`), re-runs duplicate detection / audit enrichment on the
combined list, and writes the manifest back atomically.

These helpers back the partial rescan path: after `POST /api/assets/generate`
imports a generated file into `data/assets/generated/`, the route calls
`scanSingleAsset` + `appendAssetToManifest` so the new asset shows up in the
manifest (and in `/assets`) without invoking `pnpm assets:scan`. The CLI
`pnpm assets:generate` shares the same flow.
