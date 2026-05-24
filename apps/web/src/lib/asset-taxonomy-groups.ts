import { readFile } from "node:fs/promises";
import path from "node:path";
import { findWorkspaceRoot } from "./assets-manifest";
import { parseJsonFileContent } from "./json-file";

/**
 * Loader for the semantic asset-groups page. It reads the NEW multi-level
 * taxonomy manifest (`data/assets/asset-manifest.json`) and rolls assets up
 * into semantic groups keyed by `macroCategory / assetGroup` — never the legacy
 * `data/indexes/asset-groups.json`, and never aspect/color buckets or source
 * folders. The result is a few hundred meaningful groups instead of ~one group
 * per asset.
 */

const STATUS_KEYS = [
  "approved",
  "needs-review",
  "quarantine",
  "rejected"
] as const;

type StatusKey = (typeof STATUS_KEYS)[number];

const ANTI_LIGHT_KEYWORDS = ["carpet", "rug", "runner", "tapestry", "banner"];

export type TaxonomyManifestItem = {
  id: string;
  path: string;
  macroCategory: string;
  assetGroups: string[];
  themeTags: string[];
  sourcePacks: string[];
  status: StatusKey;
  qualityFlags: string[];
  canBeLightEmitter: boolean;
};

export type TaxonomyStatusCounts = Record<StatusKey, number>;

export type TaxonomyGroupView = {
  id: string;
  name: string;
  macroCategory: string;
  assetGroup: string;
  assetCount: number;
  representativeAssetId: string | null;
  previewUrl: string | null;
  themeTags: string[];
  sourcePacks: string[];
  statusCounts: TaxonomyStatusCounts;
  assetIds: string[];
};

export type TaxonomyGroupsSummary = {
  totalAssets: number;
  groupCount: number;
  unknown: number;
  needsReview: number;
  suspiciousLight: number;
  topSourcePacks: Array<{ pack: string; count: number }>;
  macroCategories: string[];
  assetGroups: string[];
  themeTags: string[];
  sourcePacks: string[];
  statuses: StatusKey[];
};

export type TaxonomyGroups = {
  groups: TaxonomyGroupView[];
  summary: TaxonomyGroupsSummary;
};

export type LoadedTaxonomyGroups = TaxonomyGroups & {
  generatedAt: string | null;
  manifestPath: string;
  missing: boolean;
};

/** Resolves a manifest asset path to a preview-capable asset id, when known. */
export type PreviewIdResolver = (assetPath: string) => string | null;

/**
 * Load and normalize the raw taxonomy manifest items (used by the review API to
 * resolve a semantic group to its member assets). Returns [] when missing.
 */
export async function loadTaxonomyManifestItems(): Promise<
  TaxonomyManifestItem[]
> {
  const workspaceRoot = await findWorkspaceRoot(process.cwd());
  const manifestPath = path.join(
    workspaceRoot,
    "data",
    "assets",
    "asset-manifest.json"
  );

  try {
    const raw = await readFile(manifestPath, "utf8");
    const file = parseJsonFileContent(raw) as { assets?: unknown };
    return normalizeManifestItems(
      Array.isArray(file.assets) ? file.assets : []
    );
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }
}

export async function loadTaxonomyGroups(): Promise<LoadedTaxonomyGroups> {
  const workspaceRoot = await findWorkspaceRoot(process.cwd());
  const manifestPath = path.join(
    workspaceRoot,
    "data",
    "assets",
    "asset-manifest.json"
  );

  try {
    const raw = await readFile(manifestPath, "utf8");
    const file = parseJsonFileContent(raw) as {
      generatedAt?: unknown;
      stats?: { generatedAt?: unknown };
      assets?: unknown;
    };
    const items = normalizeManifestItems(
      Array.isArray(file.assets) ? file.assets : []
    );
    const previewResolver = await buildPreviewResolver(workspaceRoot);
    const { groups, summary } = buildTaxonomyGroups(items, previewResolver);

    return {
      generatedAt: readGeneratedAt(file),
      groups,
      manifestPath,
      missing: false,
      summary
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        generatedAt: null,
        groups: [],
        manifestPath,
        missing: true,
        summary: emptySummary()
      };
    }

    throw error;
  }
}

/**
 * Pure grouping: rolls manifest items up into `macroCategory / assetGroup`
 * semantic groups. Each asset is assigned to exactly one group (its first,
 * alphabetically-sorted, assetGroup) so counts never inflate.
 */
export function buildTaxonomyGroups(
  items: TaxonomyManifestItem[],
  previewResolver?: PreviewIdResolver
): TaxonomyGroups {
  const groups = new Map<string, MutableGroup>();
  const themeTagSet = new Set<string>();
  const assetGroupSet = new Set<string>();
  const macroCategorySet = new Set<string>();
  const sourcePackCounts = new Map<string, number>();

  let unknown = 0;
  let needsReview = 0;
  let suspiciousLight = 0;

  for (const item of items) {
    const assetGroup = primaryAssetGroup(item);
    const key = `${item.macroCategory}/${assetGroup}`;
    const group = groups.get(key) ?? createMutableGroup(item, assetGroup);
    groups.set(key, group);

    group.assetCount += 1;
    group.statusCounts[item.status] += 1;
    if (group.assetIds.length < 60) {
      group.assetIds.push(item.id);
    }
    for (const theme of item.themeTags) {
      group.themeCounts.set(theme, (group.themeCounts.get(theme) ?? 0) + 1);
      themeTagSet.add(theme);
    }
    for (const pack of item.sourcePacks) {
      group.sourcePacks.add(pack);
      sourcePackCounts.set(pack, (sourcePackCounts.get(pack) ?? 0) + 1);
    }
    chooseRepresentative(group, item);

    macroCategorySet.add(item.macroCategory);
    assetGroupSet.add(assetGroup);
    if (item.macroCategory === "unknown") {
      unknown += 1;
    }
    if (item.status === "needs-review") {
      needsReview += 1;
    }
    if (isSuspiciousLight(item)) {
      suspiciousLight += 1;
    }
  }

  const groupViews = [...groups.values()]
    .map((group) => finalizeGroup(group, previewResolver))
    .sort(
      (left, right) =>
        right.assetCount - left.assetCount || left.id.localeCompare(right.id)
    );

  return {
    groups: groupViews,
    summary: {
      totalAssets: items.length,
      groupCount: groupViews.length,
      unknown,
      needsReview,
      suspiciousLight,
      topSourcePacks: [...sourcePackCounts.entries()]
        .map(([pack, count]) => ({ count, pack }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 8),
      macroCategories: [...macroCategorySet].sort((a, b) => a.localeCompare(b)),
      assetGroups: [...assetGroupSet].sort((a, b) => a.localeCompare(b)),
      themeTags: [...themeTagSet].sort((a, b) => a.localeCompare(b)),
      sourcePacks: [...sourcePackCounts.keys()].sort((a, b) =>
        a.localeCompare(b)
      ),
      statuses: [...STATUS_KEYS]
    }
  };
}

export function normalizeManifestItems(raw: unknown[]): TaxonomyManifestItem[] {
  const items: TaxonomyManifestItem[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const input = entry as Record<string, unknown>;
    const id = readString(input.id);
    const assetPath = readString(input.path);
    if (!id || !assetPath) {
      continue;
    }

    items.push({
      assetGroups: readStringArray(input.assetGroups),
      canBeLightEmitter: readLightEmitter(input.usageRules),
      id,
      macroCategory: readString(input.macroCategory) || "unknown",
      path: assetPath,
      qualityFlags: readStringArray(input.qualityFlags),
      sourcePacks: readStringArray(input.sourcePacks),
      status: readStatus(input.status),
      themeTags: readStringArray(input.themeTags)
    });
  }

  return items;
}

type MutableGroup = {
  assetCount: number;
  assetGroup: string;
  assetIds: string[];
  macroCategory: string;
  representative: { id: string; path: string; approved: boolean } | null;
  sourcePacks: Set<string>;
  statusCounts: TaxonomyStatusCounts;
  themeCounts: Map<string, number>;
};

function createMutableGroup(
  item: TaxonomyManifestItem,
  assetGroup: string
): MutableGroup {
  return {
    assetCount: 0,
    assetGroup,
    assetIds: [],
    macroCategory: item.macroCategory,
    representative: null,
    sourcePacks: new Set<string>(),
    statusCounts: {
      approved: 0,
      "needs-review": 0,
      quarantine: 0,
      rejected: 0
    },
    themeCounts: new Map<string, number>()
  };
}

function chooseRepresentative(
  group: MutableGroup,
  item: TaxonomyManifestItem
): void {
  const approved = item.status === "approved";
  if (
    !group.representative ||
    (approved && !group.representative.approved) ||
    (approved === group.representative.approved &&
      item.id.localeCompare(group.representative.id) < 0)
  ) {
    group.representative = { approved, id: item.id, path: item.path };
  }
}

function finalizeGroup(
  group: MutableGroup,
  previewResolver?: PreviewIdResolver
): TaxonomyGroupView {
  const themeTags = [...group.themeCounts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )
    .slice(0, 6)
    .map(([theme]) => theme);

  const representativeAssetId = group.representative?.id ?? null;
  const previewId = group.representative
    ? (previewResolver?.(group.representative.path) ?? null)
    : null;

  return {
    assetCount: group.assetCount,
    assetGroup: group.assetGroup,
    assetIds: group.assetIds,
    id: `${group.macroCategory}/${group.assetGroup}`,
    macroCategory: group.macroCategory,
    name: `${group.macroCategory} / ${group.assetGroup}`,
    previewUrl: previewId
      ? `/assets/preview/${encodeURIComponent(previewId)}`
      : null,
    representativeAssetId,
    sourcePacks: [...group.sourcePacks].sort((a, b) => a.localeCompare(b)),
    statusCounts: group.statusCounts,
    themeTags
  };
}

function primaryAssetGroup(item: TaxonomyManifestItem): string {
  return item.assetGroups[0] ?? item.macroCategory;
}

function isSuspiciousLight(item: TaxonomyManifestItem): boolean {
  if (item.macroCategory !== "light" && !item.canBeLightEmitter) {
    return false;
  }
  const haystack = [item.path.toLowerCase(), ...item.assetGroups];
  return ANTI_LIGHT_KEYWORDS.some((keyword) =>
    haystack.some((value) => value.includes(keyword))
  );
}

/**
 * Builds a path -> preview-capable id resolver from the legacy scanner manifest
 * (whose ids name the generated preview files). Best-effort: if the file is
 * missing the page still renders, just without representative thumbnails.
 */
async function buildPreviewResolver(
  workspaceRoot: string
): Promise<PreviewIdResolver | undefined> {
  const scannerPath = path.join(
    workspaceRoot,
    "data",
    "indexes",
    "assets.manifest.json"
  );

  try {
    const raw = await readFile(scannerPath, "utf8");
    const file = parseJsonFileContent(raw) as { assets?: unknown };
    if (!Array.isArray(file.assets)) {
      return undefined;
    }

    const index = new Map<string, string>();
    for (const entry of file.assets) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const input = entry as Record<string, unknown>;
      const id = readString(input.id);
      const relativePath = readString(input.relativePath);
      if (!id || !relativePath) {
        continue;
      }
      const key = normalizePathKey(relativePath);
      if (key && !index.has(key)) {
        index.set(key, id);
      }
    }

    return (assetPath: string) =>
      index.get(normalizePathKey(assetPath)) ?? null;
  } catch {
    return undefined;
  }
}

function normalizePathKey(value: string): string {
  const lower = value.replaceAll("\\", "/").toLowerCase();
  const texturesAt = lower.indexOf("textures/");
  return texturesAt >= 0 ? lower.slice(texturesAt) : lower;
}

function emptySummary(): TaxonomyGroupsSummary {
  return {
    assetGroups: [],
    groupCount: 0,
    macroCategories: [],
    needsReview: 0,
    sourcePacks: [],
    statuses: [...STATUS_KEYS],
    suspiciousLight: 0,
    themeTags: [],
    topSourcePacks: [],
    totalAssets: 0,
    unknown: 0
  };
}

function readGeneratedAt(file: {
  generatedAt?: unknown;
  stats?: { generatedAt?: unknown };
}): string | null {
  if (typeof file.generatedAt === "string") {
    return file.generatedAt;
  }
  if (file.stats && typeof file.stats.generatedAt === "string") {
    return file.stats.generatedAt;
  }
  return null;
}

function readStatus(value: unknown): StatusKey {
  return STATUS_KEYS.includes(value as StatusKey)
    ? (value as StatusKey)
    : "needs-review";
}

function readLightEmitter(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  return (value as Record<string, unknown>).canBeLightEmitter === true;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
