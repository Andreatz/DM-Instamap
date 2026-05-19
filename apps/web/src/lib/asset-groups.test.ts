import { describe, expect, it } from "vitest";
import { normalizeAssetGroups } from "./asset-groups";

describe("normalizeAssetGroups", () => {
  it("normalizes group index entries for display", () => {
    const groups = normalizeAssetGroups([
      {
        assetCount: 2,
        assetIds: ["asset-a", "asset-b"],
        id: "group-a",
        kind: "floor",
        name: "Floor - Stone",
        representativeAssetId: "asset-a",
        representativeThumbnail: "data/previews/assets/asset-a.webp",
        sourceFolders: ["Dungeon/Floors"],
        tags: ["floor", "stone"],
        theme: "crypt",
        themes: ["crypt"],
        usableFor: ["room"],
        qualityScore: 87
      }
    ]);

    expect(groups).toEqual([
      {
        assetCount: 2,
        assetIds: ["asset-a", "asset-b"],
        id: "group-a",
        kind: "floor",
        name: "Floor - Stone",
        previewUrl: "/assets/preview/asset-a",
        qualityScore: 87,
        representativeAssetId: "asset-a",
        representativeThumbnail: "data/previews/assets/asset-a.webp",
        sourceFolders: ["Dungeon/Floors"],
        tags: ["floor", "stone"],
        theme: "crypt",
        themes: ["crypt"],
        usableFor: ["room"]
      }
    ]);
  });
});
