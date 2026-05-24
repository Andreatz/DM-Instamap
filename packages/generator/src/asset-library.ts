/**
 * Bridge between the asset taxonomy manifest and the map generator.
 *
 * The generator consumes the FINAL `asset-manifest.json` via `findAssets`
 * (status: approved by default) and converts the multi-level taxonomy items
 * into the flat {@link FurnishingAsset} shape the furnishing engine expects.
 * It never reads Dungeondraft tags directly.
 *
 * This module is intentionally pure (no fs/sharp) so it stays usable in both
 * Node and browser contexts; callers load the manifest JSON and pass the items.
 */

import {
  type AssetManifestItem,
  findAssetsScored,
  type FindAssetsQuery
} from "@dm-instamap/assets/taxonomy";
import type { FurnishingAsset } from "./furnishing";

export type { AssetManifestItem, FindAssetsQuery };

/**
 * Convert a taxonomy manifest item into a furnishing asset. The macroCategory
 * becomes the `kind`, and the normalized groups/themes/placement tags feed the
 * furnishing scorer.
 */
export function manifestItemToFurnishingAsset(
  item: AssetManifestItem
): FurnishingAsset {
  const tags = unique([
    ...item.assetGroups,
    ...item.assetSubGroups,
    ...item.themeTags,
    ...item.placementTags
  ]);

  const usableFor = unique([
    ...item.placementTags,
    ...item.usageRules.preferredRooms,
    ...item.usageRules.preferredMapTypes
  ]);

  return {
    assetId: item.id,
    kind: item.macroCategory === "unknown" ? "prop" : item.macroCategory,
    layer: item.macroCategory === "light" ? "lighting" : "object",
    qualityScore: deriveQualityScore(item),
    tags,
    usableFor
  };
}

/**
 * Query the manifest and return ready-to-place furnishing assets. Defaults to
 * `status: approved`; pass `status: "needs-review"` only for debug tooling.
 */
export function selectFurnishingAssets(
  items: AssetManifestItem[],
  query: FindAssetsQuery
): FurnishingAsset[] {
  return findAssetsScored(items, query).map((result) =>
    manifestItemToFurnishingAsset(result.item)
  );
}

function deriveQualityScore(item: AssetManifestItem): number {
  let score = 70;
  if (item.status === "needs-review") {
    score -= 25;
  }
  if (item.qualityFlags.includes("tiny")) {
    score -= 15;
  }
  if (item.qualityFlags.includes("multi-category-conflict")) {
    score -= 10;
  }
  if (item.metadata.hasTransparency === true) {
    score += 5;
  }
  return Math.max(0, Math.min(100, score));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
