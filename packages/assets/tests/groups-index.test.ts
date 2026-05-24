import { describe, expect, it } from "vitest";
import {
  type AssetManifestItem,
  assembleManifestItem,
  buildAssetGroupsIndex,
  mapSourceTags
} from "../src/taxonomy";

function item(path: string, sourceTags: string[]): AssetManifestItem {
  return assembleManifestItem({
    path,
    mapped: mapSourceTags({ path, sourceTags })
  });
}

describe("buildAssetGroupsIndex", () => {
  it("derives semantic macro/assetGroup groups with scanner-id members", () => {
    const items = [
      item("textures/objects/table_01.png", [".Table"]),
      item("textures/objects/table_02.png", [".Table"]),
      item("textures/objects/VM_table_03.png", [".VM Table"]),
      item("textures/lights/lantern.png", [".Lighting"])
    ];

    // Resolver maps every path except table_02 (simulating a missing scanner
    // counterpart) to a scanner id.
    const scannerById: Record<string, string> = {
      "textures/objects/table_01.png": "asset_aaa_111",
      "textures/objects/VM_table_03.png": "asset_ccc_333",
      "textures/lights/lantern.png": "asset_ddd_444"
    };
    const index = buildAssetGroupsIndex(
      items,
      (assetPath) =>
        scannerById[assetPath]
          ? {
              id: scannerById[assetPath]!,
              thumbnailPath: `data/previews/assets/${scannerById[assetPath]}.webp`
            }
          : null,
      "2026-01-01T00:00:00.000Z"
    );

    expect(index.source).toBe("taxonomy");
    const table = index.groups.find((group) => group.id === "furniture/table");
    expect(table?.assetCount).toBe(3);
    // table_02 had no scanner id, so it is skipped from members.
    expect(table?.assetIds).toEqual(["asset_aaa_111", "asset_ccc_333"]);
    expect(table?.representativeAssetId).toBe("asset_aaa_111");
    expect(table?.kind).toBe("furniture");
    // VM stays a source pack, not part of the group id.
    expect(table?.id).not.toContain("vm");
    expect(table?.sourceFolders).toContain("VM");

    const light = index.groups.find((group) => group.id === "light/lighting");
    expect(light?.representativeAssetId).toBe("asset_ddd_444");
  });

  it("produces far fewer groups than assets", () => {
    const items = Array.from({ length: 500 }, (_, i) =>
      item(`textures/objects/table_${i}.png`, [".Table"])
    );
    const index = buildAssetGroupsIndex(items, () => null);
    expect(index.groupCount).toBe(1);
  });
});
