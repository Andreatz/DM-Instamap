import { describe, expect, it } from "vitest";
import { buildAuditBatches, type LoadedAssetAudit } from "./asset-audit";

function createAudit(): LoadedAssetAudit {
  return {
    assetCount: 6,
    auditPath: "data/indexes/asset-audit.json",
    classificationWarnings: [
      { assetId: "asset-c", message: "missing width", type: "missing_metadata" }
    ],
    duplicateGroupCount: 1,
    duplicateGroups: [
      {
        assetIds: ["asset-d", "asset-e"],
        classificationConflict: true,
        confidence: 0.9,
        id: "dup-1",
        reason: "visual-hash",
        visualHash: "hash"
      }
    ],
    generatedAt: null,
    lowQualityCount: 1,
    missing: false,
    needsReviewCount: 6,
    reviewQueue: [
      {
        assetId: "asset-a",
        classification: "wall",
        confidence: 0.9,
        duplicateConfidence: null,
        duplicateGroupId: null,
        fileHash: null,
        qualityScore: 90,
        qualitySignals: {
          classificationConfidence: 0.9,
          filenameSignal: 0.9,
          resolution: 0.9,
          sharpness: 0.9,
          transparency: 0.9
        },
        reasons: [],
        relativePath: "assets/wall.png",
        reviewPriority: "low",
        tags: ["wall"],
        visualHash: "hash-a"
      },
      {
        assetId: "asset-b",
        classification: "unknown",
        confidence: 0.2,
        duplicateConfidence: null,
        duplicateGroupId: null,
        fileHash: null,
        qualityScore: 30,
        qualitySignals: {
          classificationConfidence: 0.2,
          filenameSignal: 0.1,
          resolution: 0.3,
          sharpness: 0.4,
          transparency: 0.6
        },
        reasons: ["low confidence"],
        relativePath: "assets/unknown.png",
        reviewPriority: "critical",
        tags: [],
        visualHash: "hash-b"
      },
      {
        assetId: "asset-c",
        classification: "prop",
        confidence: 0.5,
        duplicateConfidence: null,
        duplicateGroupId: null,
        fileHash: null,
        qualityScore: 40,
        qualitySignals: {
          classificationConfidence: 0.5,
          filenameSignal: 0.5,
          resolution: 0.3,
          sharpness: 0.4,
          transparency: 0.6
        },
        reasons: ["missing width"],
        relativePath: "assets/missing.png",
        reviewPriority: "high",
        tags: [],
        visualHash: "hash-c"
      },
      {
        assetId: "asset-d",
        classification: "prop",
        confidence: 0.8,
        duplicateConfidence: 0.72,
        duplicateGroupId: "dup-1",
        fileHash: null,
        qualityScore: 70,
        qualitySignals: {
          classificationConfidence: 0.8,
          filenameSignal: 0.7,
          resolution: 0.8,
          sharpness: 0.6,
          transparency: 0.5
        },
        reasons: [],
        relativePath: "assets/dup-d.png",
        reviewPriority: "medium",
        tags: ["chair"],
        visualHash: "hash"
      },
      {
        assetId: "asset-e",
        classification: "furniture",
        confidence: 0.8,
        duplicateConfidence: 0.72,
        duplicateGroupId: "dup-1",
        fileHash: null,
        qualityScore: 70,
        qualitySignals: {
          classificationConfidence: 0.8,
          filenameSignal: 0.7,
          resolution: 0.8,
          sharpness: 0.6,
          transparency: 0.5
        },
        reasons: [],
        relativePath: "assets/dup-e.png",
        reviewPriority: "medium",
        tags: ["chair"],
        visualHash: "hash"
      }
    ]
  };
}

describe("buildAuditBatches", () => {
  it("returns all expected batch ids", () => {
    const batches = buildAuditBatches(createAudit());
    expect(batches.map((batch) => batch.id)).toEqual([
      "critical",
      "high",
      "medium",
      "duplicates",
      "low-quality",
      "unknown-classification",
      "missing-metadata",
      "classification-conflict"
    ]);
  });

  it("populates batches based on priorities, duplicates, and warnings", () => {
    const batches = buildAuditBatches(createAudit());
    const find = (id: string) => batches.find((batch) => batch.id === id);

    expect(find("critical")?.entries.map((entry) => entry.assetId)).toEqual([
      "asset-b"
    ]);
    expect(find("high")?.entries.map((entry) => entry.assetId)).toEqual([
      "asset-c"
    ]);
    expect(
      find("medium")
        ?.entries.map((entry) => entry.assetId)
        .sort()
    ).toEqual(["asset-d", "asset-e"]);
    expect(
      find("duplicates")
        ?.entries.map((entry) => entry.assetId)
        .sort()
    ).toEqual(["asset-d", "asset-e"]);
    expect(
      find("low-quality")
        ?.entries.map((entry) => entry.assetId)
        .sort()
    ).toEqual(["asset-b", "asset-c"]);
    expect(
      find("unknown-classification")?.entries.map((entry) => entry.assetId)
    ).toEqual(["asset-b"]);
    expect(
      find("missing-metadata")?.entries.map((entry) => entry.assetId)
    ).toEqual(["asset-c"]);
    expect(
      find("classification-conflict")
        ?.entries.map((entry) => entry.assetId)
        .sort()
    ).toEqual(["asset-d", "asset-e"]);
  });
});
