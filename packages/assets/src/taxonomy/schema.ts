/**
 * Multi-level asset taxonomy schema shared by the import pipeline and the map
 * generator. The Dungeondraft tags remain the primary source of truth: the
 * pipeline preserves the original `sourceTags`, extracts vendor packs (such as
 * `VM`) into `sourcePacks`, and normalizes everything else into a queryable
 * multi-level taxonomy (macroCategory -> assetGroups -> assetSubGroups ->
 * themeTags -> placementTags -> usageRules).
 */

export const MANIFEST_VERSION = 1;

export const MACRO_CATEGORIES = [
  "floor",
  "wall",
  "door",
  "window",
  "furniture",
  "prop",
  "decoration",
  "light",
  "terrain",
  "water",
  "roof",
  "token",
  "unknown"
] as const;

export type MacroCategory = (typeof MACRO_CATEGORIES)[number];

export const ASSET_STATUSES = [
  "approved",
  "needs-review",
  "quarantine",
  "rejected"
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

export type AssetUsageRules = {
  preferredMapTypes: string[];
  preferredRooms: string[];
  avoidMapTypes: string[];
  avoidRooms: string[];
  canBeLightEmitter: boolean;
  canBeFloorOverlay: boolean;
  canBeWallMounted: boolean;
  canBeCenterpiece: boolean;
};

export type AssetMetadata = {
  width?: number | null;
  height?: number | null;
  aspectRatio?: number | null;
  hasTransparency?: boolean | null;
  fileSize?: number | null;
  extension?: string | null;
  hash?: string | null;
  perceptualHash?: string | null;
};

export type AssetManifestItem = {
  id: string;
  path: string;
  sourceTags: string[];
  sourcePacks: string[];

  macroCategory: MacroCategory;

  assetGroups: string[];
  assetSubGroups: string[];
  themeTags: string[];
  placementTags: string[];

  usageRules: AssetUsageRules;

  metadata: AssetMetadata;

  qualityFlags: string[];
  status: AssetStatus;

  /** Free-form notes left by the mapping/override steps for debugging. */
  taxonomyNotes?: string[];
};

export type AssetManifest = {
  version: number;
  stats: AssetManifestStats;
  assets: AssetManifestItem[];
};

export type AssetManifestStats = {
  totalAssets: number;
  macroCategoryCounts: Partial<Record<MacroCategory, number>>;
  statusCounts: Partial<Record<AssetStatus, number>>;
  vmTaggedAssets: number;
  generatedAt: string;
};

export function createDefaultUsageRules(): AssetUsageRules {
  return {
    preferredMapTypes: [],
    preferredRooms: [],
    avoidMapTypes: [],
    avoidRooms: [],
    canBeLightEmitter: false,
    canBeFloorOverlay: false,
    canBeWallMounted: false,
    canBeCenterpiece: false
  };
}

export function createEmptyMetadata(): AssetMetadata {
  return {
    width: null,
    height: null,
    aspectRatio: null,
    hasTransparency: null,
    fileSize: null,
    extension: null,
    hash: null,
    perceptualHash: null
  };
}

export function isMacroCategory(value: unknown): value is MacroCategory {
  return (
    typeof value === "string" &&
    (MACRO_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isAssetStatus(value: unknown): value is AssetStatus {
  return (
    typeof value === "string" &&
    (ASSET_STATUSES as readonly string[]).includes(value)
  );
}
