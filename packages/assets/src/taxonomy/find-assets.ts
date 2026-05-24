/**
 * Query layer the map generator uses to pull assets out of the final manifest.
 * The generator should consume this rather than reaching into Dungeondraft tags
 * directly. By default only `approved` assets are returned.
 */

import type { AssetManifestItem, AssetStatus, MacroCategory } from "./schema";

export type FindAssetsQuery = {
  macroCategory?: MacroCategory | MacroCategory[];
  assetGroups?: string[];
  assetSubGroups?: string[];
  themeTags?: string[];
  placementTags?: string[];
  preferredMapType?: string;
  preferredRoom?: string;
  status?: AssetStatus;
  sourcePacks?: string[];
  excludeSourcePacks?: string[];
  limit?: number;
};

export type FindAssetsResult = {
  item: AssetManifestItem;
  score: number;
};

const SCORE = {
  macroCategory: 10,
  assetGroups: 7,
  themeTags: 4,
  placementTags: 4,
  preferred: 3,
  avoid: -10,
  blockedStatus: -100,
  suspiciousLight: -100
} as const;

const ANTI_LIGHT_KEYWORDS = ["carpet", "rug", "runner", "tapestry", "banner"];

/**
 * Score and rank assets against a query. Returns the matching items sorted by
 * descending score (ties broken by id for determinism).
 */
export function findAssetsScored(
  assets: AssetManifestItem[],
  query: FindAssetsQuery
): FindAssetsResult[] {
  const wantedStatus: AssetStatus = query.status ?? "approved";
  const macroCategories = normalizeMacro(query.macroCategory);
  const excludePacks = new Set(query.excludeSourcePacks ?? []);
  const requirePacks = query.sourcePacks;

  const results: FindAssetsResult[] = [];

  for (const item of assets) {
    if (item.status !== wantedStatus) {
      continue;
    }

    if (item.sourcePacks.some((pack) => excludePacks.has(pack))) {
      continue;
    }

    if (
      requirePacks &&
      requirePacks.length > 0 &&
      !requirePacks.some((pack) => item.sourcePacks.includes(pack))
    ) {
      continue;
    }

    let score = 0;

    if (macroCategories.length > 0) {
      if (!macroCategories.includes(item.macroCategory)) {
        continue;
      }
      score += SCORE.macroCategory;
    }

    score += overlapScore(
      query.assetGroups,
      item.assetGroups,
      SCORE.assetGroups
    );
    score += overlapScore(
      query.assetSubGroups,
      item.assetSubGroups,
      SCORE.assetGroups
    );
    score += overlapScore(query.themeTags, item.themeTags, SCORE.themeTags);
    score += overlapScore(
      query.placementTags,
      item.placementTags,
      SCORE.placementTags
    );

    if (query.preferredMapType) {
      if (item.usageRules.preferredMapTypes.includes(query.preferredMapType)) {
        score += SCORE.preferred;
      }
      if (item.usageRules.avoidMapTypes.includes(query.preferredMapType)) {
        score += SCORE.avoid;
      }
    }

    if (query.preferredRoom) {
      if (item.usageRules.preferredRooms.includes(query.preferredRoom)) {
        score += SCORE.preferred;
      }
      if (item.usageRules.avoidRooms.includes(query.preferredRoom)) {
        score += SCORE.avoid;
      }
    }

    if (item.status === "rejected" || item.status === "quarantine") {
      score += SCORE.blockedStatus;
    }

    if (isSuspiciousLight(item)) {
      score += SCORE.suspiciousLight;
    }

    // Drop items that only match on negative signals.
    if (score <= 0 && hasPositiveCriteria(query)) {
      continue;
    }

    results.push({ item, score });
  }

  results.sort(
    (left, right) =>
      right.score - left.score || left.item.id.localeCompare(right.item.id)
  );

  return typeof query.limit === "number" && query.limit >= 0
    ? results.slice(0, query.limit)
    : results;
}

/** Convenience wrapper returning just the items. */
export function findAssets(
  assets: AssetManifestItem[],
  query: FindAssetsQuery
): AssetManifestItem[] {
  return findAssetsScored(assets, query).map((result) => result.item);
}

export function isSuspiciousLight(item: AssetManifestItem): boolean {
  if (item.macroCategory !== "light" && !item.usageRules.canBeLightEmitter) {
    return false;
  }
  const haystack = [item.path.toLowerCase(), ...item.assetGroups];
  return ANTI_LIGHT_KEYWORDS.some((keyword) =>
    haystack.some((value) => value.includes(keyword))
  );
}

function normalizeMacro(
  value: MacroCategory | MacroCategory[] | undefined
): MacroCategory[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function overlapScore(
  query: string[] | undefined,
  itemValues: string[],
  weight: number
): number {
  if (!query || query.length === 0) {
    return 0;
  }
  const itemSet = new Set(itemValues);
  const matches = query.filter((value) => itemSet.has(value)).length;
  return matches * weight;
}

function hasPositiveCriteria(query: FindAssetsQuery): boolean {
  return Boolean(
    query.macroCategory ||
      query.assetGroups?.length ||
      query.assetSubGroups?.length ||
      query.themeTags?.length ||
      query.placementTags?.length ||
      query.preferredMapType ||
      query.preferredRoom
  );
}
