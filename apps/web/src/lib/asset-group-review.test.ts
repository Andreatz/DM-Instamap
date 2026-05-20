import { describe, expect, it } from "vitest";
import type { AssetBrowserEntry } from "./asset-browser";
import type { AssetGroupView } from "./asset-groups";
import {
  applyGroupReviewAction,
  buildAssetCorrectionsForGroup,
  buildGroupCorrectionFromDraft,
  buildGroupReviewItems,
  calculateGroupReviewStats,
  createGroupReviewDraft,
  normalizeGroupReviewsFile,
  selectReviewQueue
} from "./asset-group-review";

const assets: AssetBrowserEntry[] = [
  createAsset("asset-a", "floor", 0.9),
  createAsset("asset-b", "floor", 0.3),
  createAsset("asset-c", "unknown", 0.2)
];

const groups: AssetGroupView[] = [
  createGroup("group-floor", ["asset-a", "asset-b"], "floor"),
  createGroup("group-unknown", ["asset-c"], "unknown")
];

describe("asset group review helpers", () => {
  it("builds group review items with confidence, preview assets and queue counters", () => {
    const items = buildGroupReviewItems(groups, assets, normalizeGroupReviewsFile({}));

    expect(items[0]).toMatchObject({
      assetCount: 2,
      lowConfidenceCount: 1,
      unknownCount: 0
    });
    expect(items[0]?.confidenceAverage).toBeCloseTo(0.6);
    expect(items[0]?.previewAssets.map((asset) => asset.id)).toEqual(["asset-a", "asset-b"]);
    expect(items[1]).toMatchObject({
      assetCount: 1,
      lowConfidenceCount: 1,
      unknownCount: 1
    });
  });

  it("selects review queues without forcing one-by-one review", () => {
    const items = buildGroupReviewItems(groups, assets, normalizeGroupReviewsFile({}));

    expect(selectReviewQueue(items, "low-confidence").map((item) => item.group.id)).toEqual([
      "group-unknown",
      "group-floor"
    ]);
    expect(selectReviewQueue(items, "unknown").map((item) => item.group.id)).toEqual(["group-unknown"]);
    expect(selectReviewQueue(items, "largest-unreviewed").map((item) => item.group.id)).toEqual([
      "group-floor",
      "group-unknown"
    ]);
  });

  it("tracks progress stats for reviewed groups and assets", () => {
    const reviews = applyGroupReviewAction(normalizeGroupReviewsFile({}), {
      action: "confirm",
      groupId: "group-floor"
    }, "2026-05-20T00:00:00.000Z");
    const items = buildGroupReviewItems(groups, assets, reviews);

    expect(calculateGroupReviewStats(items)).toEqual({
      lowConfidenceRemaining: 1,
      reviewedAssets: 2,
      reviewedGroups: 1,
      totalAssets: 3,
      unknownRemaining: 1
    });
  });

  it("builds group corrections and per-asset override payloads", () => {
    const item = buildGroupReviewItems(groups, assets, normalizeGroupReviewsFile({}))[0]!;
    const draft = createGroupReviewDraft(item);
    const correction = buildGroupCorrectionFromDraft({
      ...draft,
      kind: "terrain",
      tagsText: "moss, floor, moss",
      theme: "swamp",
      usableForText: "wet room"
    });
    const assetCorrections = buildAssetCorrectionsForGroup(item, correction);

    expect(correction).toEqual({
      kind: "terrain",
      qualityScore: 87,
      tags: ["moss", "floor"],
      theme: "swamp",
      usableFor: ["wet room"]
    });
    expect(assetCorrections).toHaveLength(2);
    expect(assetCorrections[0]?.correction).toMatchObject({
      classification: "terrain",
      theme: "swamp"
    });
  });

  it("records remove, split and merge operations locally", () => {
    let reviews = normalizeGroupReviewsFile({});
    reviews = applyGroupReviewAction(reviews, {
      action: "remove-asset",
      assetId: "asset-b",
      groupId: "group-floor"
    }, "2026-05-20T00:00:00.000Z");
    reviews = applyGroupReviewAction(reviews, {
      action: "split",
      assetIds: ["asset-a"],
      groupId: "group-floor",
      name: "Stone Floors"
    }, "2026-05-20T00:01:00.000Z");
    reviews = applyGroupReviewAction(reviews, {
      action: "merge",
      groupIds: ["group-floor", "group-unknown"],
      name: "Manual Merge"
    }, "2026-05-20T00:02:00.000Z");

    expect(reviews.removedAssets["group-floor"]).toEqual(["asset-b"]);
    expect(reviews.splits[0]).toMatchObject({ assetIds: ["asset-a"], name: "Stone Floors" });
    expect(reviews.merges[0]).toMatchObject({ groupIds: ["group-floor", "group-unknown"] });
  });
});

function createAsset(id: string, classification: string, confidence: number): AssetBrowserEntry {
  return {
    classification,
    classificationSource: "automatic",
    confidence,
    dominantColors: [],
    extension: "png",
    fileHash: id,
    hasTransparency: false,
    height: 64,
    id,
    relativePath: `assets/${id}.png`,
    sourceFolder: "assets",
    tags: [classification],
    thumbnailUrl: `/assets/preview/${id}`,
    width: 64
  };
}

function createGroup(id: string, assetIds: string[], kind: string): AssetGroupView {
  return {
    assetCount: assetIds.length,
    assetIds,
    id,
    kind,
    name: id,
    previewUrl: `/assets/preview/${assetIds[0]}`,
    qualityScore: 87,
    representativeAssetId: assetIds[0] ?? null,
    representativeThumbnail: null,
    sourceFolders: ["assets"],
    tags: [kind],
    theme: "",
    themes: [],
    usableFor: []
  };
}
