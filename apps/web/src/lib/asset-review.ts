import { ASSET_REVIEW_KINDS, type AssetBrowserEntry, type ReviewAssetKind } from "./asset-browser";

export type AssetCorrection = {
  classification: ReviewAssetKind;
  confidence?: number;
  qualityScore: number;
  tags: string[];
  theme: string;
  usableFor: string[];
};

export type AssetOverridesFile = {
  overrides: Record<string, Partial<AssetCorrection>>;
};

export type AssetReviewDraft = {
  classification: ReviewAssetKind;
  qualityScore: number;
  tagsText: string;
  theme: string;
  usableForText: string;
};

export function createReviewDraft(
  asset: AssetBrowserEntry,
  override?: Partial<AssetCorrection>
): AssetReviewDraft {
  return {
    classification: normalizeReviewKind(override?.classification ?? asset.classification),
    qualityScore: clampScore(override?.qualityScore ?? Math.round(asset.confidence * 100)),
    tagsText: (override?.tags ?? asset.tags).join(", "),
    theme: override?.theme ?? "",
    usableForText: (override?.usableFor ?? []).join(", ")
  };
}

export function buildCorrectionFromDraft(
  draft: AssetReviewDraft,
  asset: AssetBrowserEntry
): AssetCorrection {
  return {
    classification: normalizeReviewKind(draft.classification),
    confidence: asset.confidence,
    qualityScore: clampScore(draft.qualityScore),
    tags: parseCsvList(draft.tagsText),
    theme: draft.theme.trim(),
    usableFor: parseCsvList(draft.usableForText)
  };
}

export function findOverrideForAsset(
  overrides: AssetOverridesFile,
  asset: AssetBrowserEntry
): Partial<AssetCorrection> | undefined {
  return overrides.overrides[asset.id] ?? overrides.overrides[asset.relativePath];
}

export function filterReviewAssets(
  assets: AssetBrowserEntry[],
  lowConfidenceOnly: boolean,
  threshold = 0.5
): AssetBrowserEntry[] {
  if (!lowConfidenceOnly) {
    return assets;
  }

  return assets.filter((asset) => asset.confidence <= threshold);
}

export function normalizeOverridesFile(input: unknown): AssetOverridesFile {
  if (!input || typeof input !== "object") {
    return { overrides: {} };
  }

  const candidate = input as { overrides?: unknown };
  const rawOverrides =
    candidate.overrides && typeof candidate.overrides === "object" ? candidate.overrides : {};
  const overrides: AssetOverridesFile["overrides"] = {};

  for (const [key, value] of Object.entries(rawOverrides as Record<string, unknown>)) {
    const correction = normalizeCorrection(value);

    if (correction) {
      overrides[key] = correction;
    }
  }

  return { overrides };
}

export function mergeAssetOverride(
  existing: AssetOverridesFile,
  asset: Pick<AssetBrowserEntry, "id" | "relativePath">,
  correction: AssetCorrection
): AssetOverridesFile {
  const overrides = { ...existing.overrides };
  delete overrides[asset.relativePath];
  overrides[asset.id] = correction;

  return { overrides };
}

export function parseCsvList(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function normalizeCorrection(value: unknown): Partial<AssetCorrection> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const input = value as {
    classification?: unknown;
    confidence?: unknown;
    qualityScore?: unknown;
    tags?: unknown;
    theme?: unknown;
    usableFor?: unknown;
  };
  const correction: Partial<AssetCorrection> = {};

  if (typeof input.classification === "string") {
    correction.classification = normalizeReviewKind(input.classification);
  }

  if (typeof input.confidence === "number" && Number.isFinite(input.confidence)) {
    correction.confidence = Math.min(1, Math.max(0, input.confidence));
  }

  if (typeof input.qualityScore === "number" && Number.isFinite(input.qualityScore)) {
    correction.qualityScore = clampScore(input.qualityScore);
  }

  if (Array.isArray(input.tags)) {
    correction.tags = input.tags.filter((tag): tag is string => typeof tag === "string");
  }

  if (typeof input.theme === "string") {
    correction.theme = input.theme;
  }

  if (Array.isArray(input.usableFor)) {
    correction.usableFor = input.usableFor.filter((item): item is string => typeof item === "string");
  }

  return Object.keys(correction).length > 0 ? correction : null;
}

function normalizeReviewKind(value: string): ReviewAssetKind {
  if (ASSET_REVIEW_KINDS.includes(value as ReviewAssetKind)) {
    return value as ReviewAssetKind;
  }

  return "unknown";
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}
