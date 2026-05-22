import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetClassification } from "./classifier";

export type ReviewPriority = "low" | "medium" | "high" | "critical";

export type AssetQualitySignals = {
  classificationConfidence: number;
  filenameSignal: number;
  resolution: number;
  sharpness: number;
  transparency: number;
};

export type AuditableAsset = {
  classification?: unknown;
  classificationSource?: unknown;
  confidence?: unknown;
  dominantColors?: unknown;
  fileHash?: unknown;
  hasTransparency?: unknown;
  height?: unknown;
  id?: unknown;
  relativePath?: unknown;
  tags?: unknown;
  thumbnailPath?: unknown;
  width?: unknown;
};

export type AssetAuditEntry = {
  assetId: string;
  classification: AssetClassification | "unknown";
  confidence: number;
  duplicateConfidence: number | null;
  duplicateGroupId: string | null;
  fileHash: string | null;
  qualityScore: number;
  qualitySignals: AssetQualitySignals;
  reasons: string[];
  relativePath: string;
  reviewPriority: ReviewPriority;
  tags: string[];
  visualHash: string;
};

export type AssetDuplicateGroup = {
  assetIds: string[];
  classificationConflict: boolean;
  confidence: number;
  id: string;
  reason: "file-hash" | "visual-hash";
  visualHash: string;
};

export type AssetAuditWarning = {
  assetId?: string;
  message: string;
  type:
    | "classification_conflict"
    | "missing_metadata"
    | "low_confidence"
    | "low_quality";
};

export type AssetAuditFile = {
  assetCount: number;
  classificationWarnings: AssetAuditWarning[];
  duplicateGroupCount: number;
  duplicateGroups: AssetDuplicateGroup[];
  generatedAt: string;
  lowQualityCount: number;
  needsReviewCount: number;
  reviewQueue: AssetAuditEntry[];
  version: 1;
};

export type AssetAuditOptions = {
  auditPath?: string;
  manifestPath?: string;
  outputRoot?: string;
};

const DEFAULT_DATA_DIRECTORY = "data";
const DEFAULT_INDEX_DIRECTORY = "indexes";
const DEFAULT_AUDIT_FILE = "asset-audit.json";
const DEFAULT_MANIFEST_FILE = "assets.manifest.json";
const LOW_QUALITY_THRESHOLD = 35;
const REVIEW_QUEUE_LIMIT = 500;

export function createVisualHash(asset: AuditableAsset): string {
  const width = readNullableNumber(asset.width);
  const height = readNullableNumber(asset.height);
  const aspectBucket = createAspectBucket(width, height);
  const colors =
    readDominantColorHexes(asset.dominantColors).slice(0, 3).join("+") ||
    "no-colors";
  const transparency =
    typeof asset.hasTransparency === "boolean"
      ? asset.hasTransparency
        ? "alpha"
        : "opaque"
      : "alpha-unknown";

  return [aspectBucket, transparency, colors].join("|");
}

export function calculateAssetQualityScore(asset: AuditableAsset): {
  qualityScore: number;
  qualitySignals: AssetQualitySignals;
} {
  const width = readNullableNumber(asset.width);
  const height = readNullableNumber(asset.height);
  const confidence = readConfidence(asset.confidence);
  const relativePath = readString(asset.relativePath);
  const tags = readStringArray(asset.tags);

  const resolution = calculateResolutionSignal(width, height);
  const transparency = calculateTransparencySignal(asset);
  const sharpness = calculateSharpnessSignal(asset.dominantColors);
  const classificationConfidence = confidence;
  const filenameSignal = calculateFilenameSignal(relativePath, tags);
  const weighted =
    resolution * 0.28 +
    transparency * 0.12 +
    sharpness * 0.16 +
    classificationConfidence * 0.28 +
    filenameSignal * 0.16;

  return {
    qualityScore: clampScore(Math.round(weighted * 100)),
    qualitySignals: {
      classificationConfidence: roundSignal(classificationConfidence),
      filenameSignal: roundSignal(filenameSignal),
      resolution: roundSignal(resolution),
      sharpness: roundSignal(sharpness),
      transparency: roundSignal(transparency)
    }
  };
}

export function findDuplicateGroups(
  assets: AuditableAsset[]
): AssetDuplicateGroup[] {
  const exactGroups = groupByKey(assets, (asset) => readString(asset.fileHash));
  const visualGroups = groupByKey(assets, (asset) => createVisualHash(asset));
  const groups: AssetDuplicateGroup[] = [];
  const seenIds = new Set<string>();

  for (const [fileHash, group] of exactGroups) {
    if (!fileHash || group.length < 2) {
      continue;
    }

    const assetIds = readAssetIds(group);
    const groupId = createDuplicateGroupId("file", fileHash);
    groups.push({
      assetIds,
      classificationConflict: hasClassificationConflict(group),
      confidence: 1,
      id: groupId,
      reason: "file-hash",
      visualHash: createVisualHash(group[0] as AuditableAsset)
    });
    for (const assetId of assetIds) {
      seenIds.add(assetId);
    }
  }

  for (const [visualHash, group] of visualGroups) {
    const groupAssetIds = readAssetIds(group).filter(
      (assetId) => !seenIds.has(assetId)
    );

    if (
      visualHash === "unknown-aspect|alpha-unknown|no-colors" ||
      groupAssetIds.length < 2
    ) {
      continue;
    }

    groups.push({
      assetIds: groupAssetIds,
      classificationConflict: hasClassificationConflict(group),
      confidence: 0.72,
      id: createDuplicateGroupId("visual", visualHash),
      reason: "visual-hash",
      visualHash
    });
  }

  return groups.sort(
    (left, right) =>
      right.assetIds.length - left.assetIds.length ||
      left.id.localeCompare(right.id)
  );
}

export function buildAssetReviewQueue(
  assets: AuditableAsset[],
  duplicateGroups: AssetDuplicateGroup[] = findDuplicateGroups(assets)
): AssetAuditEntry[] {
  const duplicateLookup = createDuplicateLookup(duplicateGroups);

  return assets
    .map((asset) => createAuditEntry(asset, duplicateLookup))
    .filter((entry) => entry.reviewPriority !== "low")
    .sort(compareAuditEntries)
    .slice(0, REVIEW_QUEUE_LIMIT);
}

export async function auditAssets(
  options: AssetAuditOptions = {}
): Promise<AssetAuditFile> {
  const outputRoot = options.outputRoot
    ? path.resolve(options.outputRoot)
    : path.join(process.cwd(), DEFAULT_DATA_DIRECTORY);
  const indexRoot = options.outputRoot
    ? path.resolve(outputRoot, DEFAULT_DATA_DIRECTORY, DEFAULT_INDEX_DIRECTORY)
    : path.resolve(outputRoot, DEFAULT_INDEX_DIRECTORY);
  const manifestPath = options.manifestPath
    ? path.resolve(outputRoot, options.manifestPath)
    : path.join(indexRoot, DEFAULT_MANIFEST_FILE);
  const auditPath = options.auditPath
    ? path.resolve(outputRoot, options.auditPath)
    : path.join(indexRoot, DEFAULT_AUDIT_FILE);
  const manifest = parseJsonFile(await readFile(manifestPath, "utf8")) as {
    assets?: unknown;
  };
  const assets = Array.isArray(manifest.assets)
    ? (manifest.assets as AuditableAsset[])
    : [];
  const duplicateGroups = findDuplicateGroups(assets);
  const duplicateLookup = createDuplicateLookup(duplicateGroups);
  const entries = assets.map((asset) =>
    createAuditEntry(asset, duplicateLookup)
  );
  const reviewQueue = entries
    .filter((entry) => entry.reviewPriority !== "low")
    .sort(compareAuditEntries)
    .slice(0, REVIEW_QUEUE_LIMIT);
  const audit: AssetAuditFile = {
    assetCount: assets.length,
    classificationWarnings: buildClassificationWarnings(
      entries,
      duplicateGroups
    ),
    duplicateGroupCount: duplicateGroups.length,
    duplicateGroups,
    generatedAt: new Date().toISOString(),
    lowQualityCount: entries.filter(
      (entry) => entry.qualityScore < LOW_QUALITY_THRESHOLD
    ).length,
    needsReviewCount: entries.filter((entry) => entry.reviewPriority !== "low")
      .length,
    reviewQueue,
    version: 1
  };

  await mkdir(path.dirname(auditPath), { recursive: true });
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  return audit;
}

export function enrichAssetWithAuditFields(
  asset: AuditableAsset,
  duplicateLookup: Map<string, { confidence: number; id: string }>
): AuditableAsset & {
  duplicateConfidence: number | null;
  duplicateGroupId: string | null;
  qualityScore: number;
  qualitySignals: AssetQualitySignals;
  reviewPriority: ReviewPriority;
  visualHash: string;
} {
  const entry = createAuditEntry(asset, duplicateLookup);

  return {
    ...asset,
    duplicateConfidence: entry.duplicateConfidence,
    duplicateGroupId: entry.duplicateGroupId,
    qualityScore: entry.qualityScore,
    qualitySignals: entry.qualitySignals,
    reviewPriority: entry.reviewPriority,
    visualHash: entry.visualHash
  };
}

function createAuditEntry(
  asset: AuditableAsset,
  duplicateLookup: Map<string, { confidence: number; id: string }>
): AssetAuditEntry {
  const id = readString(asset.id);
  const relativePath = readString(asset.relativePath);
  const classification = normalizeClassification(
    readString(asset.classification)
  );
  const confidence = readConfidence(asset.confidence);
  const visualHash = createVisualHash(asset);
  const duplicate = duplicateLookup.get(id) ?? null;
  const { qualityScore, qualitySignals } = calculateAssetQualityScore(asset);
  const reasons = buildReviewReasons(asset, qualityScore, duplicate);
  const reviewPriority = calculateReviewPriority({
    asset,
    duplicate,
    qualityScore,
    reasons
  });

  return {
    assetId: id,
    classification,
    confidence,
    duplicateConfidence: duplicate?.confidence ?? null,
    duplicateGroupId: duplicate?.id ?? null,
    fileHash: readString(asset.fileHash) || null,
    qualityScore,
    qualitySignals,
    reasons,
    relativePath,
    reviewPriority,
    tags: readStringArray(asset.tags),
    visualHash
  };
}

function buildReviewReasons(
  asset: AuditableAsset,
  qualityScore: number,
  duplicate: { confidence: number; id: string } | null
): string[] {
  const reasons: string[] = [];
  const classification = normalizeClassification(
    readString(asset.classification)
  );
  const confidence = readConfidence(asset.confidence);
  const tags = readStringArray(asset.tags);

  if (classification === "unknown") {
    reasons.push("classification_unknown");
  }

  if (confidence < 0.35) {
    reasons.push("confidence_below_0_35");
  } else if (confidence < 0.6) {
    reasons.push("confidence_below_0_60");
  }

  if (qualityScore < LOW_QUALITY_THRESHOLD) {
    reasons.push("quality_below_35");
  } else if (qualityScore < 55) {
    reasons.push("quality_below_55");
  }

  if (tags.length === 0) {
    reasons.push("missing_tags");
  }

  if (!readNullableNumber(asset.width) || !readNullableNumber(asset.height)) {
    reasons.push("missing_dimensions");
  }

  if (duplicate) {
    reasons.push("possible_duplicate");
  }

  return reasons;
}

function calculateReviewPriority(input: {
  asset: AuditableAsset;
  duplicate: { confidence: number; id: string } | null;
  qualityScore: number;
  reasons: string[];
}): ReviewPriority {
  const classification = normalizeClassification(
    readString(input.asset.classification)
  );
  const confidence = readConfidence(input.asset.confidence);

  if (
    classification === "unknown" ||
    input.reasons.includes("missing_dimensions") ||
    (input.duplicate && input.reasons.includes("classification_conflict"))
  ) {
    return "critical";
  }

  if (
    confidence < 0.35 ||
    input.qualityScore < LOW_QUALITY_THRESHOLD ||
    input.reasons.includes("missing_tags")
  ) {
    return "high";
  }

  if (confidence < 0.6 || input.qualityScore < 55) {
    return "medium";
  }

  return "low";
}

function buildClassificationWarnings(
  entries: AssetAuditEntry[],
  duplicateGroups: AssetDuplicateGroup[]
): AssetAuditWarning[] {
  const warnings: AssetAuditWarning[] = [];

  for (const entry of entries) {
    if (!entry.relativePath || !entry.assetId) {
      warnings.push({
        assetId: entry.assetId || undefined,
        message: "Asset is missing an id or relative path.",
        type: "missing_metadata"
      });
    }

    if (entry.confidence < 0.35) {
      warnings.push({
        assetId: entry.assetId,
        message: "Classification confidence is below 0.35.",
        type: "low_confidence"
      });
    }

    if (entry.qualityScore < LOW_QUALITY_THRESHOLD) {
      warnings.push({
        assetId: entry.assetId,
        message: "Automatic quality score is below 35.",
        type: "low_quality"
      });
    }
  }

  for (const group of duplicateGroups) {
    if (group.classificationConflict) {
      warnings.push({
        message: `Duplicate group ${group.id} contains conflicting classifications.`,
        type: "classification_conflict"
      });
    }
  }

  return warnings;
}

function calculateResolutionSignal(
  width: number | null,
  height: number | null
): number {
  if (!width || !height) {
    return 0;
  }

  const pixels = width * height;

  if (pixels >= 1024 * 1024) {
    return 1;
  }

  if (pixels >= 512 * 512) {
    return 0.85;
  }

  if (pixels >= 256 * 256) {
    return 0.68;
  }

  if (pixels >= 128 * 128) {
    return 0.48;
  }

  return 0.22;
}

function calculateTransparencySignal(asset: AuditableAsset): number {
  const classification = normalizeClassification(
    readString(asset.classification)
  );
  const hasTransparency =
    typeof asset.hasTransparency === "boolean" ? asset.hasTransparency : null;

  if (hasTransparency === null) {
    return 0.5;
  }

  if (
    ["prop", "furniture", "door", "window", "light", "decoration"].includes(
      classification
    )
  ) {
    return hasTransparency ? 0.9 : 0.55;
  }

  if (["floor", "terrain", "water", "roof"].includes(classification)) {
    return hasTransparency ? 0.55 : 0.88;
  }

  return hasTransparency ? 0.72 : 0.7;
}

function calculateSharpnessSignal(value: unknown): number {
  const colors = readDominantColorHexes(value);

  if (colors.length === 0) {
    return 0.45;
  }

  const uniqueColors = new Set(colors).size;
  const spread = Math.min(1, uniqueColors / 5);

  return 0.45 + spread * 0.45;
}

function calculateFilenameSignal(relativePath: string, tags: string[]): number {
  if (!relativePath) {
    return 0;
  }

  const meaningfulTags = tags.filter(
    (tag) => !["asset", "assets", "pack", "creator", "with"].includes(tag)
  );

  if (meaningfulTags.length >= 3) {
    return 0.95;
  }

  if (meaningfulTags.length > 0) {
    return 0.72;
  }

  return /[a-z]/iu.test(relativePath) ? 0.48 : 0.2;
}

function createDuplicateLookup(
  duplicateGroups: AssetDuplicateGroup[]
): Map<string, { confidence: number; id: string }> {
  const lookup = new Map<string, { confidence: number; id: string }>();

  for (const group of duplicateGroups) {
    for (const assetId of group.assetIds) {
      lookup.set(assetId, { confidence: group.confidence, id: group.id });
    }
  }

  return lookup;
}

function groupByKey<T>(
  items: T[],
  getKey: (item: T) => string
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  return groups;
}

function hasClassificationConflict(assets: AuditableAsset[]): boolean {
  return (
    new Set(
      assets.map((asset) =>
        normalizeClassification(readString(asset.classification))
      )
    ).size > 1
  );
}

function readAssetIds(assets: AuditableAsset[]): string[] {
  return assets
    .map((asset) => readString(asset.id))
    .filter(Boolean)
    .sort();
}

function compareAuditEntries(
  left: AssetAuditEntry,
  right: AssetAuditEntry
): number {
  const priorityRank: Record<ReviewPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  return (
    priorityRank[right.reviewPriority] - priorityRank[left.reviewPriority] ||
    left.qualityScore - right.qualityScore ||
    left.confidence - right.confidence ||
    left.relativePath.localeCompare(right.relativePath)
  );
}

function createDuplicateGroupId(prefix: string, key: string): string {
  return `dup_${prefix}_${stableHash(key).slice(0, 14)}`;
}

function stableHash(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createAspectBucket(
  width: number | null,
  height: number | null
): string {
  if (!width || !height) {
    return "unknown-aspect";
  }

  const ratio = Math.max(width, height) / Math.min(width, height);

  if (ratio <= 1.15) {
    return "square";
  }

  if (ratio >= 3) {
    return "long";
  }

  return width > height ? "wide" : "tall";
}

function readDominantColorHexes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((color) => {
      if (!color || typeof color !== "object") {
        return "";
      }

      const hex = (color as { hex?: unknown }).hex;
      return typeof hex === "string" ? hex.toLowerCase() : "";
    })
    .filter(Boolean);
}

function normalizeClassification(
  value: string
): AssetClassification | "unknown" {
  const known = [
    "floor",
    "wall",
    "door",
    "window",
    "prop",
    "furniture",
    "terrain",
    "water",
    "light",
    "roof",
    "decoration",
    "unknown"
  ];

  return known.includes(value) ? (value as AssetClassification) : "unknown";
}

function readConfidence(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0;
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function roundSignal(value: number): number {
  return Number(value.toFixed(2));
}

function parseJsonFile(content: string): unknown {
  return JSON.parse(
    content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
  );
}
