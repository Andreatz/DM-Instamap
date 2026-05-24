/**
 * Derives the `data/indexes/asset-groups.json` integration file from the
 * semantic taxonomy manifest. This replaces the old folder/aspect/colour
 * grouping (which produced ~one group per asset) with a small set of semantic
 * `macroCategory / assetGroup` groups, while keeping the exact file shape that
 * the exporter resolver, editor and AI bridge already consume.
 *
 * Group members are emitted as *scanner* asset ids (from the legacy
 * `assets.manifest.json`) so the exporter can resolve a group id -> a
 * representative member -> a real image file. Taxonomy assets without a scanner
 * counterpart are simply skipped from a group's member list.
 */

import type { AssetManifestItem } from "./schema";

/** Maps a taxonomy asset path to its scanner-manifest entry, when present. */
export type ScannerAssetResolver = (assetPath: string) => {
  id: string;
  thumbnailPath: string | null;
} | null;

export type AssetGroupIndexEntry = {
  assetCount: number;
  assetIds: string[];
  id: string;
  kind: string;
  name: string;
  qualityScore: number;
  representativeAssetId: string | null;
  representativeThumbnail: string | null;
  sourceFolders: string[];
  tags: string[];
  theme: string | null;
  themes: string[];
  usableFor: string[];
};

export type AssetGroupsIndexFile = {
  generatedAt: string;
  groupCount: number;
  source: "taxonomy";
  groups: AssetGroupIndexEntry[];
};

type MutableGroup = {
  assetGroup: string;
  ids: string[];
  macroCategory: string;
  placementTags: Set<string>;
  representative: {
    id: string;
    approved: boolean;
    thumbnail: string | null;
  } | null;
  sourcePacks: Set<string>;
  themeCounts: Map<string, number>;
  totalAssets: number;
};

export function buildAssetGroupsIndex(
  items: AssetManifestItem[],
  resolveScanner: ScannerAssetResolver,
  now: string = new Date().toISOString()
): AssetGroupsIndexFile {
  const groups = new Map<string, MutableGroup>();

  for (const item of items) {
    const assetGroup = item.assetGroups[0] ?? item.macroCategory;
    const key = `${item.macroCategory}/${assetGroup}`;
    const group = groups.get(key) ?? createMutableGroup(item, assetGroup);
    groups.set(key, group);

    group.totalAssets += 1;
    for (const theme of item.themeTags) {
      group.themeCounts.set(theme, (group.themeCounts.get(theme) ?? 0) + 1);
    }
    for (const placement of item.placementTags) {
      group.placementTags.add(placement);
    }
    for (const pack of item.sourcePacks) {
      group.sourcePacks.add(pack);
    }

    const scanner = resolveScanner(item.path);
    if (scanner) {
      group.ids.push(scanner.id);
      const approved = item.status === "approved";
      if (
        !group.representative ||
        (approved && !group.representative.approved)
      ) {
        group.representative = {
          approved,
          id: scanner.id,
          thumbnail: scanner.thumbnailPath
        };
      }
    }
  }

  const entries = [...groups.values()]
    .map((group) => finalizeGroup(group))
    .sort(
      (left, right) =>
        right.assetCount - left.assetCount || left.id.localeCompare(right.id)
    );

  return {
    generatedAt: now,
    groupCount: entries.length,
    source: "taxonomy",
    groups: entries
  };
}

function createMutableGroup(
  item: AssetManifestItem,
  assetGroup: string
): MutableGroup {
  return {
    assetGroup,
    ids: [],
    macroCategory: item.macroCategory,
    placementTags: new Set<string>(),
    representative: null,
    sourcePacks: new Set<string>(),
    themeCounts: new Map<string, number>(),
    totalAssets: 0
  };
}

function finalizeGroup(group: MutableGroup): AssetGroupIndexEntry {
  const themes = [...group.themeCounts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )
    .map(([theme]) => theme);
  const assetIds = [...new Set(group.ids)];

  return {
    assetCount: group.totalAssets,
    assetIds,
    id: `${group.macroCategory}/${group.assetGroup}`,
    kind: group.macroCategory,
    name: `${group.macroCategory} / ${group.assetGroup}`,
    qualityScore: 70,
    representativeAssetId: group.representative?.id ?? assetIds[0] ?? null,
    representativeThumbnail: group.representative?.thumbnail ?? null,
    sourceFolders: [...group.sourcePacks].sort((a, b) => a.localeCompare(b)),
    tags: [...new Set([group.assetGroup, ...themes])],
    theme: themes[0] ?? null,
    themes,
    usableFor: [...group.placementTags].sort((a, b) => a.localeCompare(b))
  };
}
