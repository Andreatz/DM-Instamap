import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetBrowserEntry, ReviewAssetKind } from "./asset-browser";
import { ASSET_REVIEW_KINDS } from "./asset-browser";
import type { AssetGroupView } from "./asset-groups";
import { findWorkspaceRoot } from "./assets-manifest";
import { parseCsvList, type AssetCorrection } from "./asset-review";
import { parseJsonFileContent } from "./json-file";

export const GROUP_REVIEW_QUEUES = [
  "largest-unreviewed",
  "low-confidence",
  "unknown",
  "most-used",
  "random-sample"
] as const;

export type GroupReviewQueue = (typeof GROUP_REVIEW_QUEUES)[number];

export type AssetGroupCorrection = {
  kind: ReviewAssetKind;
  qualityScore: number;
  tags: string[];
  theme: string;
  usableFor: string[];
};

export type AssetGroupReviewRecord = {
  confirmedAt?: string;
  correction?: AssetGroupCorrection;
  reviewedAt?: string;
};

export type AssetGroupSplitRecord = {
  assetIds: string[];
  createdAt: string;
  groupId: string;
  id: string;
  name: string;
};

export type AssetGroupMergeRecord = {
  createdAt: string;
  groupIds: string[];
  id: string;
  name: string;
};

export type AssetGroupReviewsFile = {
  merges: AssetGroupMergeRecord[];
  removedAssets: Record<string, string[]>;
  reviewedGroups: Record<string, AssetGroupReviewRecord>;
  splits: AssetGroupSplitRecord[];
  usage: Record<string, number>;
};

export type AssetGroupReviewDraft = {
  kind: ReviewAssetKind;
  qualityScore: number;
  tagsText: string;
  theme: string;
  usableForText: string;
};

export type AssetGroupReviewItem = {
  assetCount: number;
  assets: AssetBrowserEntry[];
  confidenceAverage: number | null;
  group: AssetGroupView;
  lowConfidenceCount: number;
  previewAssets: AssetBrowserEntry[];
  reviewed: boolean;
  review?: AssetGroupReviewRecord;
  unknownCount: number;
  usageCount: number;
  visibleAssetIds: string[];
};

export type AssetGroupReviewStats = {
  lowConfidenceRemaining: number;
  reviewedAssets: number;
  reviewedGroups: number;
  totalAssets: number;
  unknownRemaining: number;
};

export type BatchGroupAction =
  | {
      action: "confirm";
      groupId: string;
    }
  | {
      action: "correct";
      draft: AssetGroupReviewDraft;
      groupId: string;
    }
  | {
      action: "add-tags";
      groupId: string;
      tagsText: string;
    }
  | {
      action: "remove-asset";
      assetId: string;
      groupId: string;
    }
  | {
      action: "split";
      assetIds: string[];
      groupId: string;
      name: string;
    }
  | {
      action: "merge";
      groupIds: string[];
      name: string;
    };

export function buildGroupReviewItems(
  groups: AssetGroupView[],
  assets: AssetBrowserEntry[],
  reviews: AssetGroupReviewsFile
): AssetGroupReviewItem[] {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  return groups.map((group) => {
    const removed = new Set(reviews.removedAssets[group.id] ?? []);
    const groupAssets = group.assetIds
      .filter((assetId) => !removed.has(assetId))
      .map((assetId) => assetsById.get(assetId))
      .filter((asset): asset is AssetBrowserEntry => asset !== undefined);
    const confidenceAverage =
      groupAssets.length > 0
        ? groupAssets.reduce((sum, asset) => sum + asset.confidence, 0) / groupAssets.length
        : null;
    const review = reviews.reviewedGroups[group.id];

    return {
      assetCount: groupAssets.length,
      assets: groupAssets,
      confidenceAverage,
      group,
      lowConfidenceCount: groupAssets.filter((asset) => asset.confidence <= 0.5).length,
      previewAssets: groupAssets.slice(0, 24),
      reviewed: Boolean(review?.reviewedAt || review?.confirmedAt || review?.correction),
      review,
      unknownCount:
        group.kind === "unknown"
          ? groupAssets.length
          : groupAssets.filter((asset) => asset.classification === "unknown").length,
      usageCount: reviews.usage[group.id] ?? 0,
      visibleAssetIds: groupAssets.map((asset) => asset.id)
    };
  });
}

export function selectReviewQueue(
  items: AssetGroupReviewItem[],
  queue: GroupReviewQueue
): AssetGroupReviewItem[] {
  const unreviewed = items.filter((item) => !item.reviewed);

  switch (queue) {
    case "low-confidence":
      return unreviewed
        .filter((item) => item.lowConfidenceCount > 0)
        .sort(
          (left, right) =>
            (left.confidenceAverage ?? 1) - (right.confidenceAverage ?? 1) ||
            right.lowConfidenceCount - left.lowConfidenceCount
        );
    case "unknown":
      return unreviewed
        .filter((item) => item.unknownCount > 0)
        .sort((left, right) => right.unknownCount - left.unknownCount || right.assetCount - left.assetCount);
    case "most-used":
      return unreviewed.sort(
        (left, right) => right.usageCount - left.usageCount || right.assetCount - left.assetCount
      );
    case "random-sample":
      return [...unreviewed].sort((left, right) => stableRandomScore(left.group.id) - stableRandomScore(right.group.id));
    case "largest-unreviewed":
    default:
      return unreviewed.sort((left, right) => right.assetCount - left.assetCount || left.group.name.localeCompare(right.group.name));
  }
}

export function calculateGroupReviewStats(items: AssetGroupReviewItem[]): AssetGroupReviewStats {
  const reviewedAssets = new Set<string>();

  for (const item of items) {
    if (item.reviewed) {
      for (const assetId of item.visibleAssetIds) {
        reviewedAssets.add(assetId);
      }
    }
  }

  return {
    lowConfidenceRemaining: items.reduce((sum, item) => sum + (item.reviewed ? 0 : item.lowConfidenceCount), 0),
    reviewedAssets: reviewedAssets.size,
    reviewedGroups: items.filter((item) => item.reviewed).length,
    totalAssets: new Set(items.flatMap((item) => item.visibleAssetIds)).size,
    unknownRemaining: items.reduce((sum, item) => sum + (item.reviewed ? 0 : item.unknownCount), 0)
  };
}

export function createGroupReviewDraft(item: AssetGroupReviewItem): AssetGroupReviewDraft {
  const correction = item.review?.correction;

  return {
    kind: normalizeReviewKind(correction?.kind ?? item.group.kind),
    qualityScore: clampScore(correction?.qualityScore ?? item.group.qualityScore ?? qualityFromConfidence(item.confidenceAverage)),
    tagsText: (correction?.tags ?? item.group.tags).join(", "),
    theme: correction?.theme ?? item.group.theme ?? "",
    usableForText: (correction?.usableFor ?? item.group.usableFor).join(", ")
  };
}

export function buildGroupCorrectionFromDraft(draft: AssetGroupReviewDraft): AssetGroupCorrection {
  return {
    kind: normalizeReviewKind(draft.kind),
    qualityScore: clampScore(draft.qualityScore),
    tags: parseCsvList(draft.tagsText),
    theme: draft.theme.trim(),
    usableFor: parseCsvList(draft.usableForText)
  };
}

export function buildAssetCorrectionsForGroup(
  item: AssetGroupReviewItem,
  correction: AssetGroupCorrection
): Array<{
  asset: AssetBrowserEntry;
  correction: AssetCorrection;
}> {
  return item.assets.map((asset) => ({
    asset,
    correction: {
      classification: correction.kind,
      confidence: asset.confidence,
      qualityScore: correction.qualityScore,
      tags: correction.tags,
      theme: correction.theme,
      usableFor: correction.usableFor
    }
  }));
}

export function normalizeGroupReviewsFile(input: unknown): AssetGroupReviewsFile {
  if (!input || typeof input !== "object") {
    return createEmptyGroupReviews();
  }

  const value = input as Partial<AssetGroupReviewsFile>;

  return {
    merges: Array.isArray(value.merges)
      ? value.merges.map(normalizeMerge).filter((merge): merge is AssetGroupMergeRecord => merge !== null)
      : [],
    removedAssets: normalizeStringArrayRecord(value.removedAssets),
    reviewedGroups: normalizeReviewedGroups(value.reviewedGroups),
    splits: Array.isArray(value.splits)
      ? value.splits.map(normalizeSplit).filter((split): split is AssetGroupSplitRecord => split !== null)
      : [],
    usage: normalizeNumberRecord(value.usage)
  };
}

export async function loadAssetGroupReviews(): Promise<AssetGroupReviewsFile> {
  const reviewsPath = await getAssetGroupReviewsPath();

  try {
    return normalizeGroupReviewsFile(parseJsonFileContent(await readFile(reviewsPath, "utf8")));
  } catch (error) {
    if (isMissingFileError(error)) {
      return createEmptyGroupReviews();
    }

    throw error;
  }
}

export async function saveAssetGroupReviews(reviews: AssetGroupReviewsFile): Promise<AssetGroupReviewsFile> {
  const reviewsPath = await getAssetGroupReviewsPath();
  const normalized = normalizeGroupReviewsFile(reviews);

  await mkdir(path.dirname(reviewsPath), { recursive: true });
  await writeFile(reviewsPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  return normalized;
}

export function applyGroupReviewAction(
  reviews: AssetGroupReviewsFile,
  action: BatchGroupAction,
  now = new Date().toISOString()
): AssetGroupReviewsFile {
  const next = normalizeGroupReviewsFile(reviews);

  if (action.action === "confirm") {
    next.reviewedGroups[action.groupId] = {
      ...next.reviewedGroups[action.groupId],
      confirmedAt: now,
      reviewedAt: now
    };
  }

  if (action.action === "correct") {
    next.reviewedGroups[action.groupId] = {
      correction: buildGroupCorrectionFromDraft(action.draft),
      reviewedAt: now
    };
  }

  if (action.action === "add-tags") {
    const existing = next.reviewedGroups[action.groupId]?.correction;
    const tags = [...new Set([...(existing?.tags ?? []), ...parseCsvList(action.tagsText)])];
    next.reviewedGroups[action.groupId] = {
      ...next.reviewedGroups[action.groupId],
      correction: {
        kind: existing?.kind ?? "unknown",
        qualityScore: existing?.qualityScore ?? 50,
        tags,
        theme: existing?.theme ?? "",
        usableFor: existing?.usableFor ?? []
      },
      reviewedAt: now
    };
  }

  if (action.action === "remove-asset") {
    next.removedAssets[action.groupId] = [
      ...new Set([...(next.removedAssets[action.groupId] ?? []), action.assetId])
    ];
  }

  if (action.action === "split") {
    next.splits.push({
      assetIds: [...new Set(action.assetIds)],
      createdAt: now,
      groupId: action.groupId,
      id: `split-${stableRandomScore(`${action.groupId}-${now}`).toString(16).slice(2, 10)}`,
      name: action.name.trim() || "Manual Split"
    });
  }

  if (action.action === "merge") {
    next.merges.push({
      createdAt: now,
      groupIds: [...new Set(action.groupIds)],
      id: `merge-${stableRandomScore(`${action.groupIds.join("-")}-${now}`).toString(16).slice(2, 10)}`,
      name: action.name.trim() || "Manual Merge"
    });
  }

  return next;
}

function createEmptyGroupReviews(): AssetGroupReviewsFile {
  return {
    merges: [],
    removedAssets: {},
    reviewedGroups: {},
    splits: [],
    usage: {}
  };
}

function normalizeReviewedGroups(value: unknown): AssetGroupReviewsFile["reviewedGroups"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const reviewedGroups: AssetGroupReviewsFile["reviewedGroups"] = {};

  for (const [groupId, rawReview] of Object.entries(value as Record<string, unknown>)) {
    if (!rawReview || typeof rawReview !== "object" || Array.isArray(rawReview)) {
      continue;
    }

    const input = rawReview as AssetGroupReviewRecord;
    reviewedGroups[groupId] = {
      confirmedAt: typeof input.confirmedAt === "string" ? input.confirmedAt : undefined,
      correction: normalizeCorrection(input.correction),
      reviewedAt: typeof input.reviewedAt === "string" ? input.reviewedAt : undefined
    };
  }

  return reviewedGroups;
}

function normalizeCorrection(value: unknown): AssetGroupCorrection | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const input = value as Partial<AssetGroupCorrection>;

  return {
    kind: normalizeReviewKind(typeof input.kind === "string" ? input.kind : "unknown"),
    qualityScore: clampScore(typeof input.qualityScore === "number" ? input.qualityScore : 50),
    tags: Array.isArray(input.tags) ? input.tags.filter((tag): tag is string => typeof tag === "string") : [],
    theme: typeof input.theme === "string" ? input.theme : "",
    usableFor: Array.isArray(input.usableFor)
      ? input.usableFor.filter((item): item is string => typeof item === "string")
      : []
  };
}

function normalizeSplit(value: unknown): AssetGroupSplitRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const input = value as Partial<AssetGroupSplitRecord>;
  const groupId = typeof input.groupId === "string" ? input.groupId : "";
  const assetIds = Array.isArray(input.assetIds) ? input.assetIds.filter((item): item is string => typeof item === "string") : [];

  if (!groupId || assetIds.length === 0) {
    return null;
  }

  return {
    assetIds,
    createdAt: typeof input.createdAt === "string" ? input.createdAt : "",
    groupId,
    id: typeof input.id === "string" ? input.id : `split-${groupId}`,
    name: typeof input.name === "string" ? input.name : "Manual Split"
  };
}

function normalizeMerge(value: unknown): AssetGroupMergeRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const input = value as Partial<AssetGroupMergeRecord>;
  const groupIds = Array.isArray(input.groupIds) ? input.groupIds.filter((item): item is string => typeof item === "string") : [];

  if (groupIds.length < 2) {
    return null;
  }

  return {
    createdAt: typeof input.createdAt === "string" ? input.createdAt : "",
    groupIds,
    id: typeof input.id === "string" ? input.id : `merge-${groupIds.join("-")}`,
    name: typeof input.name === "string" ? input.name : "Manual Merge"
  };
}

function normalizeStringArrayRecord(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, raw]) => [
      key,
      Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : []
    ])
  );
}

function normalizeNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, raw]) =>
      typeof raw === "number" && Number.isFinite(raw) ? [[key, raw]] : []
    )
  );
}

function normalizeReviewKind(value: string): ReviewAssetKind {
  return ASSET_REVIEW_KINDS.includes(value as ReviewAssetKind) ? (value as ReviewAssetKind) : "unknown";
}

function qualityFromConfidence(value: number | null): number {
  return value === null ? 50 : clampScore(value * 100);
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function stableRandomScore(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 0xffffffff;
}

async function getAssetGroupReviewsPath(): Promise<string> {
  const workspaceRoot = await findWorkspaceRoot(process.cwd());
  return path.join(workspaceRoot, "data", "indexes", "asset-group-reviews.json");
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
