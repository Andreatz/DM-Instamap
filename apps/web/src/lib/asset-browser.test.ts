import { describe, expect, it } from "vitest";
import {
  createAssetBrowserOptions,
  filterAssets,
  formatPercent,
  normalizeManifestAssets,
  type AssetFilterState
} from "./asset-browser";

const manifestAssets = [
  {
    classification: "door",
    classificationSource: "automatic",
    confidence: 0.82,
    dominantColors: [{ hex: "#a08060", population: 24 }],
    extension: "png",
    fileHash: "hash-door",
    hasTransparency: true,
    height: 64,
    id: "asset-door",
    relativePath: "Dungeon Pack/Doors/iron-door.png",
    tags: ["door", "iron"],
    width: 200
  },
  {
    classification: "floor",
    classificationSource: "manual",
    confidence: 0.96,
    dominantColors: [],
    extension: "webp",
    fileHash: "hash-floor",
    hasTransparency: false,
    height: 512,
    id: "asset-floor",
    relativePath: "Dungeon Pack/Floors/stone-floor.webp",
    tags: ["floor", "stone"],
    width: 512
  },
  {
    extension: "png",
    fileHash: "hash-old",
    hasTransparency: null,
    height: 128,
    id: "asset-old",
    relativePath: "Old Pack/Props/skull-bowl.png",
    width: 128
  }
];

const defaultFilters: AssetFilterState = {
  confidence: 0,
  kind: "all",
  query: "",
  sourceFolder: "all",
  tag: "all"
};

describe("normalizeManifestAssets", () => {
  it("normalizes current and older manifest entries", () => {
    const assets = normalizeManifestAssets(manifestAssets);

    expect(assets).toHaveLength(3);
    expect(assets[0]).toMatchObject({
      classification: "door",
      confidence: 0.82,
      sourceFolder: "Dungeon Pack/Doors",
      thumbnailUrl: "/assets/preview/asset-door"
    });
    expect(assets[2]).toMatchObject({
      classification: "unknown",
      classificationSource: "missing",
      confidence: 0,
      tags: ["bowl", "old", "pack", "props", "skull"]
    });
  });
});

describe("filterAssets", () => {
  it("filters by kind, tag, source folder, confidence, and search", () => {
    const assets = normalizeManifestAssets(manifestAssets);

    expect(filterAssets(assets, { ...defaultFilters, kind: "door" }).map((asset) => asset.id)).toEqual([
      "asset-door"
    ]);
    expect(filterAssets(assets, { ...defaultFilters, tag: "stone" }).map((asset) => asset.id)).toEqual([
      "asset-floor"
    ]);
    expect(
      filterAssets(assets, {
        ...defaultFilters,
        sourceFolder: "Dungeon Pack/Floors"
      }).map((asset) => asset.id)
    ).toEqual(["asset-floor"]);
    expect(filterAssets(assets, { ...defaultFilters, confidence: 0.9 }).map((asset) => asset.id)).toEqual([
      "asset-floor"
    ]);
    expect(filterAssets(assets, { ...defaultFilters, query: "skull" }).map((asset) => asset.id)).toEqual([
      "asset-old"
    ]);
  });
});

describe("createAssetBrowserOptions", () => {
  it("builds sorted filter options", () => {
    const options = createAssetBrowserOptions(normalizeManifestAssets(manifestAssets));

    expect(options.kinds).toEqual(["door", "floor", "unknown"]);
    expect(options.tags).toContain("stone");
    expect(options.sourceFolders).toEqual(["Dungeon Pack/Doors", "Dungeon Pack/Floors", "Old Pack/Props"]);
  });
});

describe("formatPercent", () => {
  it("formats confidence as a percentage", () => {
    expect(formatPercent(0.824)).toBe("82%");
  });
});
