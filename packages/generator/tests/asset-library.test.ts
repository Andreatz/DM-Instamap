import {
  assembleManifestItem,
  type AssetManifestItem,
  mapSourceTags
} from "@dm-instamap/assets/taxonomy";
import { describe, expect, it } from "vitest";
import {
  manifestItemToFurnishingAsset,
  selectFurnishingAssets
} from "../src/asset-library";

function item(path: string, sourceTags: string[]): AssetManifestItem {
  return assembleManifestItem({
    path,
    mapped: mapSourceTags({ path, sourceTags })
  });
}

const corpus: AssetManifestItem[] = [
  item("textures/objects/VM_tavern_table.png", [".Table", ".VM Tavern"]),
  item("textures/objects/tavern_chair.png", [".Chair", ".Tavern"]),
  item("textures/objects/dock_plank.png", [".Dock", ".Wood"]),
  item("textures/lights/lantern.png", [".Lighting"]),
  item("textures/objects/red_carpet.png", [".Carpet", ".Lighting"]),
  item("textures/objects/desert_cactus.png", [".Cacti", ".Desert"])
];

describe("asset-library bridge", () => {
  it("converts a manifest item into a furnishing asset", () => {
    const furnishing = manifestItemToFurnishingAsset(
      item("textures/objects/table_01.png", [".Table"])
    );
    expect(furnishing.kind).toBe("furniture");
    expect(furnishing.tags).toContain("table");
    expect(furnishing.assetId).toMatch(/^asset_/u);
  });

  it("never surfaces a carpet as a light emitter", () => {
    const lights = selectFurnishingAssets(corpus, { macroCategory: "light" });
    expect(lights.some((asset) => asset.assetId.includes("carpet"))).toBe(
      false
    );
    expect(lights.every((asset) => asset.kind === "light")).toBe(true);
  });

  it("tavern-on-stilts query ranks tavern/wood/dock above desert", () => {
    const furniture = selectFurnishingAssets(corpus, {
      macroCategory: "furniture",
      themeTags: ["tavern", "wood", "dock", "water"]
    });
    expect(furniture.length).toBeGreaterThan(0);
    // Desert furniture (none here) must never out-rank tavern furniture.
    expect(furniture[0]?.tags).toContain("tavern");
  });

  it("returns only approved assets by default (unknown excluded)", () => {
    const unknownItem = item("textures/objects/weird.png", [".Administration"]);
    const results = selectFurnishingAssets([unknownItem], {
      macroCategory: "prop"
    });
    expect(results).toHaveLength(0);
  });
});
