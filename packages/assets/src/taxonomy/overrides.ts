/**
 * Manual overrides applied AFTER automatic mapping and BEFORE validation.
 *
 * Three layers, applied in order of increasing specificity:
 *   1. `packs`   — vendor pack handling (e.g. keep VM as sourcePack only).
 *   2. `groups`  — per sourceTag defaults (matched if the asset carries the tag).
 *   3. `assets`  — per exact asset path; highest precedence.
 */

import {
  type AssetManifestItem,
  type AssetStatus,
  type AssetUsageRules,
  isAssetStatus,
  isMacroCategory,
  type MacroCategory
} from "./schema";

export type AssetOverrideEntry = Partial<{
  macroCategory: MacroCategory;
  assetGroups: string[];
  assetSubGroups: string[];
  themeTags: string[];
  placementTags: string[];
  sourcePacks: string[];
  usageRules: Partial<AssetUsageRules>;
  qualityFlags: string[];
  status: AssetStatus;
}>;

export type GroupOverrideEntry = Partial<{
  macroCategory: MacroCategory;
  assetGroups: string[];
  themeTags: string[];
  placementTags: string[];
  usageRules: Partial<AssetUsageRules>;
}>;

export type PackOverrideEntry = {
  preserveAsSourcePack?: boolean;
  stripFromNormalizedGroups?: boolean;
};

export type AssetOverridesFile = {
  assets?: Record<string, AssetOverrideEntry>;
  groups?: Record<string, GroupOverrideEntry>;
  packs?: Record<string, PackOverrideEntry>;
};

export type ApplyOverridesResult = {
  item: AssetManifestItem;
  applied: string[];
};

export function applyOverrides(
  item: AssetManifestItem,
  overrides: AssetOverridesFile
): ApplyOverridesResult {
  const applied: string[] = [];
  let result: AssetManifestItem = item;

  // 1. Pack-level handling.
  for (const pack of result.sourcePacks) {
    const packRule = overrides.packs?.[pack];
    if (!packRule) {
      continue;
    }

    if (packRule.stripFromNormalizedGroups) {
      const stripped = result.assetGroups.filter(
        (group) => group.toLowerCase() !== pack.toLowerCase()
      );
      if (stripped.length !== result.assetGroups.length) {
        result = { ...result, assetGroups: stripped };
        applied.push(`pack:${pack}:strip-groups`);
      }
    }
  }

  // 2. Group-level overrides (any matching sourceTag).
  for (const tag of result.sourceTags) {
    const groupRule = overrides.groups?.[tag];
    if (!groupRule) {
      continue;
    }
    result = mergeGroupOverride(result, groupRule);
    applied.push(`group:${tag}`);
  }

  // 3. Asset-level override (exact path).
  const assetRule = overrides.assets?.[result.path];
  if (assetRule) {
    result = mergeAssetOverride(result, assetRule);
    applied.push(`asset:${result.path}`);
  }

  if (applied.length > 0) {
    result = {
      ...result,
      taxonomyNotes: [
        ...(result.taxonomyNotes ?? []),
        `overrides applied: ${applied.join(", ")}`
      ]
    };
  }

  return { item: result, applied };
}

function mergeGroupOverride(
  item: AssetManifestItem,
  rule: GroupOverrideEntry
): AssetManifestItem {
  return {
    ...item,
    macroCategory:
      rule.macroCategory && isMacroCategory(rule.macroCategory)
        ? rule.macroCategory
        : item.macroCategory,
    assetGroups: unionSorted(item.assetGroups, rule.assetGroups),
    themeTags: unionSorted(item.themeTags, rule.themeTags),
    placementTags: unionSorted(item.placementTags, rule.placementTags),
    usageRules: rule.usageRules
      ? { ...item.usageRules, ...rule.usageRules }
      : item.usageRules
  };
}

function mergeAssetOverride(
  item: AssetManifestItem,
  rule: AssetOverrideEntry
): AssetManifestItem {
  return {
    ...item,
    macroCategory:
      rule.macroCategory && isMacroCategory(rule.macroCategory)
        ? rule.macroCategory
        : item.macroCategory,
    // Asset-level lists replace rather than union so a manual fix can fully
    // correct a mis-tagged asset.
    assetGroups: rule.assetGroups ?? item.assetGroups,
    assetSubGroups: rule.assetSubGroups ?? item.assetSubGroups,
    themeTags: rule.themeTags ?? item.themeTags,
    placementTags: rule.placementTags ?? item.placementTags,
    sourcePacks: rule.sourcePacks ?? item.sourcePacks,
    usageRules: rule.usageRules
      ? { ...item.usageRules, ...rule.usageRules }
      : item.usageRules,
    qualityFlags: rule.qualityFlags
      ? [...new Set([...item.qualityFlags, ...rule.qualityFlags])]
      : item.qualityFlags,
    status:
      rule.status && isAssetStatus(rule.status) ? rule.status : item.status
  };
}

function unionSorted(base: string[], extra: string[] | undefined): string[] {
  if (!extra || extra.length === 0) {
    return base;
  }
  return [...new Set([...base, ...extra])].sort((a, b) => a.localeCompare(b));
}
