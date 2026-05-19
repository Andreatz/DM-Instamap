import { describe, expect, it } from "vitest";
import {
  buildCorrectionFromDraft,
  createReviewDraft,
  filterReviewAssets,
  findOverrideForAsset,
  mergeAssetOverride,
  normalizeOverridesFile,
  parseCsvList
} from "./asset-review";
import type { AssetBrowserEntry } from "./asset-browser";

const asset: AssetBrowserEntry = {
  classification: "door",
  classificationSource: "automatic",
  confidence: 0.42,
  dominantColors: [],
  extension: "png",
  fileHash: "hash",
  hasTransparency: true,
  height: 64,
  id: "asset-door",
  relativePath: "doors/iron-door.png",
  sourceFolder: "doors",
  tags: ["door", "iron"],
  thumbnailUrl: "/assets/preview/asset-door",
  width: 200
};

describe("asset review helpers", () => {
  it("creates a review draft from an asset and applies overrides", () => {
    expect(createReviewDraft(asset)).toEqual({
      classification: "door",
      qualityScore: 42,
      tagsText: "door, iron",
      theme: "",
      usableForText: ""
    });

    expect(
      createReviewDraft(asset, {
        classification: "terrain",
        qualityScore: 88,
        tags: ["manual", "mud"],
        theme: "swamp",
        usableFor: ["river crossing"]
      })
    ).toEqual({
      classification: "terrain",
      qualityScore: 88,
      tagsText: "manual, mud",
      theme: "swamp",
      usableForText: "river crossing"
    });
  });

  it("builds a correction from draft fields", () => {
    const correction = buildCorrectionFromDraft(
      {
        classification: "wall",
        qualityScore: 101,
        tagsText: "stone, wall, stone",
        theme: " crypt ",
        usableForText: "border, cover"
      },
      asset
    );

    expect(correction).toEqual({
      classification: "wall",
      confidence: 0.42,
      qualityScore: 100,
      tags: ["stone", "wall"],
      theme: "crypt",
      usableFor: ["border", "cover"]
    });
  });

  it("finds overrides by id or relative path", () => {
    expect(
      findOverrideForAsset(
        {
          overrides: {
            "doors/iron-door.png": {
              classification: "prop"
            }
          }
        },
        asset
      )
    ).toEqual({ classification: "prop" });
  });

  it("filters low-confidence assets", () => {
    const highConfidenceAsset = { ...asset, confidence: 0.9, id: "high" };

    expect(filterReviewAssets([asset, highConfidenceAsset], true).map((candidate) => candidate.id)).toEqual([
      "asset-door"
    ]);
  });

  it("normalizes and merges override files", () => {
    const normalized = normalizeOverridesFile({
      overrides: {
        "asset-door": {
          classification: "not-real",
          qualityScore: -20,
          tags: ["door"],
          theme: "keep",
          usableFor: ["entry"]
        }
      }
    });

    expect(normalized.overrides["asset-door"]).toEqual({
      classification: "unknown",
      qualityScore: 0,
      tags: ["door"],
      theme: "keep",
      usableFor: ["entry"]
    });

    expect(
      mergeAssetOverride(normalized, asset, {
        classification: "door",
        confidence: 0.42,
        qualityScore: 60,
        tags: ["iron"],
        theme: "",
        usableFor: []
      }).overrides["asset-door"]
    ).toMatchObject({ classification: "door", qualityScore: 60 });
  });

  it("parses comma-separated lists", () => {
    expect(parseCsvList("floor, stone, floor, ")).toEqual(["floor", "stone"]);
  });
});
