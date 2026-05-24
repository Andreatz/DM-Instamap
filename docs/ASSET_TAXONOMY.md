# Asset Taxonomy

DM-Instamap classifies its ~34k Dungeondraft assets into a **multi-level
taxonomy** that the map generator can query precisely. The Dungeondraft tags are
the *primary source of truth*: nothing is reclassified from scratch. Instead the
pipeline imports the tags, normalizes them, enriches them with real file
metadata, validates anomalies, and emits a single `asset-manifest.json` consumed
by the generator.

```
sourceTags -> sourcePacks -> macroCategory -> assetGroups -> assetSubGroups -> themeTags -> placementTags -> usageRules
```

Core code lives in [`packages/assets/src/taxonomy/`](../packages/assets/src/taxonomy)
and is exported as `@dm-instamap/assets/taxonomy`.

## sourceTags vs assetGroups

- **`sourceTags`** — the original Dungeondraft tags, preserved verbatim (e.g.
  `".VM Table"`, `".Lighting"`). Kept for traceability, dedupe and debugging.
- **`assetGroups`** — the *normalized object type* extracted from the tags (e.g.
  `["table"]`, `["lighting"]`). This is what the generator searches on.
- **`themeTags`** — style/place descriptors (e.g. `tavern`, `wood`, `dock`).
- **`placementTags`** — placement constraints (e.g. `floor`, `wall`).

A `sourceTag` may map to several normalized fields. For example `".VM Tavern"`
becomes `sourcePacks: ["VM"]`, `themeTags: ["tavern"]` — `tavern` is a theme, not
an object group, so it is *not* put in `assetGroups`.

## Why `VM` is preserved as a sourcePack

`VM` (Venatus Maps Megapack) is a **vendor/pack prefix, not a gameplay
category**. If `VM` leaked into `assetGroups`, the generator would search for
groups like `vm-table` or `vm-rocks` instead of `table` / `rock`.

Decision:

- `VM` stays in the original `sourceTags` and asset paths (untouched).
- `VM` is exposed as `sourcePacks: ["VM"]` for filtering / provenance / debug.
- `VM` is **removed** from the normalized `assetGroups` and `themeTags`.

```jsonc
// VM_Table   -> { "sourcePacks": ["VM"], "assetGroups": ["table"] }
// VM Rocks   -> { "sourcePacks": ["VM"], "assetGroups": ["rock"] }
// VM_Tavern  -> { "sourcePacks": ["VM"], "themeTags": ["tavern"] }
```

`sourcePacks` is queryable via `findAssets({ sourcePacks: ["VM"] })` and
`excludeSourcePacks`.

## Why macroCategory does not replace specific groups

`macroCategory` is the coarse bucket the engine uses for broad placement intent
(`furniture`, `light`, `decoration`, …). It must **not** flatten the specific
groups: a query for `assetGroups: ["table", "dining"]` is far more useful than
just `macroCategory: "furniture"`. Both levels coexist.

The 13 macro categories: `floor`, `wall`, `door`, `window`, `furniture`,
`prop`, `decoration`, `light`, `terrain`, `water`, `roof`, `token`, `unknown`.

## Anti-light rules (carpet / rug / runner / tapestry / banner)

These keywords have the **highest priority** and override any generic mapping:

- `carpet`, `rug`, `runner`, `tapestry`, `banner` -> `decoration`, never `light`.
- Applies even when the asset carries a light-related sourceTag such as
  `.Lighting`, and even for paths like `red_carpet_01.png`.

When triggered, the item is forced to:

```jsonc
{
  "macroCategory": "decoration",
  "assetGroups": ["carpet"],          // light-ish groups are stripped
  "usageRules": { "canBeLightEmitter": false, "canBeFloorOverlay": true }
}
```

`validateManifest` fails the build if any `light` asset still has a carpet-family
keyword in its path or groups.

## Manifest schema

```ts
type AssetManifestItem = {
  id: string;                  // asset_<sha1[0..12]> of the path
  path: string;                // original Dungeondraft-relative path
  sourceTags: string[];        // preserved verbatim
  sourcePacks: string[];       // e.g. ["VM"]

  macroCategory: MacroCategory;

  assetGroups: string[];
  assetSubGroups: string[];
  themeTags: string[];
  placementTags: string[];

  usageRules: {
    preferredMapTypes: string[];
    preferredRooms: string[];
    avoidMapTypes: string[];
    avoidRooms: string[];
    canBeLightEmitter: boolean;
    canBeFloorOverlay: boolean;
    canBeWallMounted: boolean;
    canBeCenterpiece: boolean;
  };

  metadata: {
    width?: number | null;
    height?: number | null;
    aspectRatio?: number | null;
    hasTransparency?: boolean | null;
    fileSize?: number | null;
    extension?: string | null;
    hash?: string | null;
    perceptualHash?: string | null;
  };

  qualityFlags: string[];
  status: "approved" | "needs-review" | "quarantine" | "rejected";
};
```

`status` rules:

- `approved` — clear mapping.
- `needs-review` — `unknown` macroCategory, missing sourceTags, conflicts.
- `quarantine` — corrupt / suspicious file (set by audit/metadata).
- `rejected` — only via manual override.

## Querying with `findAssets`

```ts
import { findAssets } from "@dm-instamap/assets/taxonomy";

findAssets(manifest.assets, {
  macroCategory: "furniture",
  assetGroups: ["table", "dining"],
  themeTags: ["tavern", "wood"],
  status: "approved" // default; only debug tooling should pass needs-review
});
```

`FindAssetsQuery` supports: `macroCategory` (string | string[]), `assetGroups`,
`assetSubGroups`, `themeTags`, `placementTags`, `preferredMapType`,
`preferredRoom`, `status`, `sourcePacks`, `excludeSourcePacks`, `limit`.

Scoring (`findAssetsScored`):

```
+10 macroCategory match
 +7 assetGroups / assetSubGroups match (per match)
 +4 themeTags match
 +4 placementTags match
 +3 preferredMapTypes / preferredRooms match
-10 avoidMapTypes / avoidRooms match
-100 status rejected / quarantine
-100 suspicious light (carpet-family as light)
```

By default only `approved` assets are returned.

## Generator integration

The generator imports the taxonomy via
[`packages/generator/src/asset-library.ts`](../packages/generator/src/asset-library.ts):

- `selectFurnishingAssets(items, query)` — runs `findAssets` and converts the
  results into the flat `FurnishingAsset` shape used by `autoFurnishMap`.
- `manifestItemToFurnishingAsset(item)` — single-item conversion
  (`macroCategory` -> `kind`, groups/themes/placement -> `tags`/`usableFor`).

The generator never reads Dungeondraft tags directly — it only consumes
`data/assets/asset-manifest.json`.

## Example: tavern on stilts

For the prompt *"a fantasy tavern on stilts over the water, two wooden halls
joined by docks, tables, chairs, barrels, rugs, lanterns and tavern detail"* the
generator queries:

```ts
selectFurnishingAssets(assets, { macroCategory: "furniture",
  assetGroups: ["table", "chair", "bench", "barrel", "crate"],
  themeTags: ["tavern", "wood", "dock", "water"] });
selectFurnishingAssets(assets, { macroCategory: "decoration",
  assetGroups: ["carpet", "rug", "banner"], themeTags: ["tavern"] });
selectFurnishingAssets(assets, { macroCategory: "light",
  assetGroups: ["lantern", "torch", "candle"] });
selectFurnishingAssets(assets, { macroCategory: "water",
  assetGroups: ["bridge", "dock", "river"] });
```

Carpets/rugs never come back as lights, `VM` is never an assetGroup, and
`unknown` assets are excluded from production queries.

See [ASSET_TAG_IMPORT.md](ASSET_TAG_IMPORT.md) for the import workflow.
