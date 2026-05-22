import { describe, expect, it } from "vitest";
import {
  AssetGroupSchema,
  classifyPlacedAssetUsage,
  createMapDocument,
  MapDocumentSchema,
  validateMapDocumentAssetReferences
} from "../src";

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
    expect(map.layers.map((layer) => layer.kind)).toEqual([
      "background",
      "terrain",
      "walls",
      "props",
      "lighting",
      "gm-only",
      "notes"
    ]);
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

describe("asset reference validation", () => {
  it("reports missing asset ids with usage categories", () => {
    const map = createMapDocument({
      height: 4,
      id: "asset-ref-map",
      name: "Asset Ref Map",
      width: 4
    });
    const document = MapDocumentSchema.parse({
      ...map,
      assets: [
        {
          assetId: "texture-stone",
          id: "placed-floor",
          layer: "floor" as const,
          position: { x: 0, y: 0 },
          tags: []
        },
        {
          assetId: "prop-table",
          id: "placed-table",
          layer: "object" as const,
          position: { x: 1, y: 1 },
          tags: []
        }
      ]
    });

    const result = validateMapDocumentAssetReferences(document, [
      "texture-stone"
    ]);

    expect(result.ok).toBe(false);
    expect(result.missingAssetIds).toEqual(["prop-table"]);
    expect(result.issues[0]).toMatchObject({
      assetId: "prop-table",
      path: "assets[1].assetId",
      usage: "semantic-object"
    });
    const firstAsset = document.assets[0];
    expect(firstAsset).toBeDefined();
    expect(firstAsset ? classifyPlacedAssetUsage(firstAsset) : null).toBe(
      "tile-texture"
    );
  });
});
