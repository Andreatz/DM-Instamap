import { describe, expect, it } from "vitest";
import { AssetGroupSchema, createMapDocument } from "../src";

describe("createMapDocument", () => {
  it("marks maps as editable", () => {
    const map = createMapDocument({
      height: 1,
      id: "test-map",
      name: "Test Map",
      tiles: [],
      width: 1
    });

    expect(map.editable).toBe(true);
  });
});

describe("AssetGroupSchema", () => {
  it("supports generated asset group index fields", () => {
    const group = AssetGroupSchema.parse({
      assetCount: 2,
      assetIds: ["asset-a", "asset-b"],
      id: "group-floor-stone",
      kind: "floor",
      name: "Floor - Stone",
      representativeAssetId: "asset-a",
      representativeThumbnail: "data/previews/assets/asset-a.webp",
      tags: ["stone"]
    });

    expect(group.assetCount).toBe(2);
  });
});
