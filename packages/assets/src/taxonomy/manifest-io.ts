/**
 * Assembly + IO helpers for the taxonomy pipeline. Path constants are relative
 * to the repository root; CLIs resolve them against the actual workspace root.
 */

import { createHash } from "node:crypto";
import {
  type AssetManifest,
  type AssetManifestItem,
  type AssetManifestStats,
  type AssetMetadata,
  type AssetStatus,
  createEmptyMetadata,
  MANIFEST_VERSION,
  type MacroCategory
} from "./schema";
import type { MappedAsset } from "./mapping";

/** Pipeline file locations, relative to the repository root. */
export const TAXONOMY_PATHS = {
  imports: "data/assets/imports",
  taxonomy: "data/assets/taxonomy",
  manifests: "data/assets/manifests",
  reports: "data/assets/reports",
  overrides: "data/assets/overrides",
  contactSheets: "data/assets/contact-sheets",
  importedTags: "data/assets/imports/imported-tags.json",
  assetTaxonomy: "data/assets/taxonomy/asset-taxonomy.json",
  mappedAssets: "data/assets/manifests/mapped-assets.json",
  mappedWithMetadata: "data/assets/manifests/mapped-assets.with-metadata.json",
  overridesFile: "data/assets/overrides/asset-overrides.json",
  auditJson: "data/assets/reports/audit-report.json",
  auditMarkdown: "data/assets/reports/audit-report.md",
  finalManifest: "data/assets/asset-manifest.json"
} as const;

/** Deterministic id derived from the asset path. */
export function createAssetId(path: string): string {
  const hash = createHash("sha1")
    .update(path.replaceAll("\\", "/"))
    .digest("hex")
    .slice(0, 12);
  return `asset_${hash}`;
}

export function assembleManifestItem(input: {
  path: string;
  mapped: MappedAsset;
  metadata?: AssetMetadata;
}): AssetManifestItem {
  const metadata = input.metadata ?? createEmptyMetadata();
  if (!metadata.extension) {
    metadata.extension = extractExtension(input.path);
  }

  return {
    id: createAssetId(input.path),
    path: input.path,
    sourceTags: input.mapped.sourceTags,
    sourcePacks: input.mapped.sourcePacks,
    macroCategory: input.mapped.macroCategory,
    assetGroups: input.mapped.assetGroups,
    assetSubGroups: input.mapped.assetSubGroups,
    themeTags: input.mapped.themeTags,
    placementTags: input.mapped.placementTags,
    usageRules: input.mapped.usageRules,
    metadata,
    qualityFlags: input.mapped.qualityFlags,
    status: input.mapped.status,
    taxonomyNotes: input.mapped.taxonomyNotes
  };
}

export function buildManifest(items: AssetManifestItem[]): AssetManifest {
  return {
    version: MANIFEST_VERSION,
    stats: computeStats(items),
    assets: [...items].sort((a, b) => a.path.localeCompare(b.path))
  };
}

export function computeStats(items: AssetManifestItem[]): AssetManifestStats {
  const macroCategoryCounts: Partial<Record<MacroCategory, number>> = {};
  const statusCounts: Partial<Record<AssetStatus, number>> = {};
  let vmTaggedAssets = 0;

  for (const item of items) {
    macroCategoryCounts[item.macroCategory] =
      (macroCategoryCounts[item.macroCategory] ?? 0) + 1;
    statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
    if (item.sourcePacks.includes("VM")) {
      vmTaggedAssets += 1;
    }
  }

  return {
    totalAssets: items.length,
    macroCategoryCounts,
    statusCounts,
    vmTaggedAssets,
    generatedAt: new Date().toISOString()
  };
}

function extractExtension(path: string): string | null {
  const match = /\.([a-z0-9]+)$/iu.exec(path);
  return match ? match[1]!.toLowerCase() : null;
}
