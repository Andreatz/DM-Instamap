# Asset Pipeline

The asset pipeline is local-first. It scans image folders, extracts metadata,
generates small previews, and applies heuristic classification without using
paid APIs or GPU processing.

## Scan Command

```bash
pnpm assets:scan <folder>
```

The scanner reads `png`, `jpg`, `jpeg`, `webp`, and `svg` files recursively.
It writes:

- `data/indexes/assets.manifest.json`
- `data/previews/assets/*.webp`

## Classification

Each manifest entry includes:

- `classification`
- `classificationSource`
- `confidence`
- `tags`

Automatic classification uses filename tokens, folder tokens, image size,
aspect ratio, and detectable transparency. Supported classes are `floor`,
`wall`, `door`, `window`, `prop`, `furniture`, `terrain`, `water`, `light`,
`roof`, `decoration`, and `unknown`.

Automatic tags are extracted from folder and filename text. For example,
`Dungeon Floors/stone-floor-01.png` produces tags like `dungeon`, `floors`,
`stone`, `floor`, and `01`.

## Group Command

```bash
pnpm assets:group
```

The grouping step reads `data/indexes/assets.manifest.json` and writes:

```text
data/indexes/asset-groups.json
```

Groups are generated from kind, automatic tags, source folder, aspect ratio,
and the first sampled dominant color when available. Each group stores:

- `id`
- `name`
- `kind`
- `tags`
- `assetCount`
- `representativeThumbnail`
- `assetIds`
- `theme`, `themes`, `usableFor`, and `qualityScore` when manual review data is available

The `/asset-groups` page shows the generated groups. Manual rename, merge, and
split are intentionally left for a later pass.

## Room Asset Matching

`packages/assets` exposes a local `AssetMatcher` service through
`matchAssetGroupsForRoom`. Given a `RoomNode`, map theme, and `AssetGroup`
records, it scores groups by:

- preferred asset kind for the room
- overlapping room and group tags
- matching theme
- matching `usableFor` values
- manual `qualityScore`

The matcher returns selected groups with debug reasons and score contributions.
It does not call external APIs.

## Local Visual Embeddings

```bash
pnpm assets:embed
```

The embedding step reads `data/indexes/assets.manifest.json`, loads generated
asset thumbnails, and writes:

```text
data/indexes/asset-embeddings.json
```

`packages/assets` exposes an `EmbeddingProvider` interface and a deterministic
local provider named `local-color-layout-v1`. The local provider uses thumbnail
pixels plus local metadata such as kind, tags, relative path, and dominant
colors. It does not call paid APIs and does not require a GPU.

Search helpers:

- `searchAssetsByText`
- `searchAssetsByImage`

Both helpers return an empty result set when the embedding index is missing, so
the rest of the application continues to work without generated vectors.

## Reference Maps

```bash
pnpm references:scan <folder>
```

The reference registry scans local `png`, `jpg`, `jpeg`, and `webp` map images.
It writes:

```text
data/indexes/references.manifest.json
data/previews/references/*.webp
```

Each reference entry stores an id, relative path, dimensions, dominant colors,
thumbnail path, guessed map type, and tags from the folder and filename. The
`/references` page displays the generated registry. dd2vtt import/export is not
implemented in this step.

## Reference Review

The reference review page is available at:

```text
/references/review
```

It shows one reference map at a time and saves manual corrections to:

```text
data/indexes/reference-overrides.json
```

Corrections include map type, theme tags, style tags, layout tags, quality
score, and notes. The review queue can be filtered to unknown references or
low-confidence map type guesses.

## Manual Overrides

Manual corrections live in:

```text
data/indexes/asset-overrides.json
```

The file is tracked with an empty default:

```json
{
  "overrides": {}
}
```

Overrides can be keyed by manifest `id` or by `relativePath`. If an override is
present, it wins over automatic classification.

```json
{
  "overrides": {
    "floors/stone-floor.png": {
      "classification": "terrain",
      "confidence": 0.87,
      "tags": ["manual", "moss"]
    }
  }
}
```

## Review UI

The manual review page is available at:

```text
/assets/review
```

It shows one asset at a time, displays the current automatic classification,
and lets a user correct:

- `classification`
- `tags`
- `theme`
- `usableFor`
- `qualityScore`

The review UI writes corrections back to `data/indexes/asset-overrides.json`.
It also includes quick classification buttons for `wall`, `floor`, `door`,
`prop`, `furniture`, `light`, `terrain`, and `unknown`, plus previous and next
navigation and a low-confidence queue filter.
