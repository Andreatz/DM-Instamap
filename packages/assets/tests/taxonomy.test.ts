import { describe, expect, it } from "vitest";
import {
  applyOverrides,
  assembleManifestItem,
  type AssetManifestItem,
  type AssetOverridesFile,
  createImportedTagsAccumulator,
  finalizeImportedTags,
  findAssets,
  mapSourceTags,
  mergeTagFileIntoImport,
  parseDungeondraftTags
} from "../src/taxonomy";

function manifestItem(
  mappedPath: string,
  sourceTags: string[]
): AssetManifestItem {
  return assembleManifestItem({
    path: mappedPath,
    mapped: mapSourceTags({ path: mappedPath, sourceTags })
  });
}

describe("parseDungeondraftTags", () => {
  it("1. parses a file even with trailing commas", () => {
    const content = `{
      "tags": {
        ".Table": [
          "textures/objects/table_01.png",
          "textures/objects/table_02.png",
        ],
        ".Chair": [
          "textures/objects/chair_01.png",
        ],
      },
    }`;

    const parsed = parseDungeondraftTags(content);
    expect(parsed.tags[".Table"]).toEqual([
      "textures/objects/table_01.png",
      "textures/objects/table_02.png"
    ]);
    expect(parsed.tags[".Chair"]).toEqual(["textures/objects/chair_01.png"]);
  });
});

describe("imported tags dedupe", () => {
  it("2. deduplicates by sourceTag + path across files", () => {
    const accumulator = createImportedTagsAccumulator();
    mergeTagFileIntoImport(accumulator, "pack-a.dungeondraft_tags", {
      tags: {
        ".Table": [
          "textures/objects/table_01.png",
          "textures/objects/table_01.png"
        ]
      }
    });
    mergeTagFileIntoImport(accumulator, "pack-b.dungeondraft_tags", {
      tags: {
        ".Table": ["textures/objects/table_01.png"],
        ".Wood": ["textures/objects/table_01.png"]
      }
    });
    finalizeImportedTags(accumulator);

    expect(accumulator.tags[".Table"]).toEqual([
      "textures/objects/table_01.png"
    ]);
    expect(
      accumulator.assets["textures/objects/table_01.png"]?.sourceTags
    ).toEqual([".Table", ".Wood"]);
    expect(accumulator.stats.uniqueAssetPaths).toBe(1);
  });
});

describe("mapSourceTags", () => {
  it("3. maps .Table -> furniture / table", () => {
    const mapped = mapSourceTags({
      path: "textures/objects/table_01.png",
      sourceTags: [".Table"]
    });
    expect(mapped.macroCategory).toBe("furniture");
    expect(mapped.assetGroups).toContain("table");
    expect(mapped.status).toBe("approved");
  });

  it("4. maps .Lighting -> light / lighting", () => {
    const mapped = mapSourceTags({
      path: "textures/lights/torch_01.png",
      sourceTags: [".Lighting"]
    });
    expect(mapped.macroCategory).toBe("light");
    expect(mapped.assetGroups).toContain("lighting");
    expect(mapped.usageRules.canBeLightEmitter).toBe(true);
  });

  it("5. forces carpet/rug/runner to decoration even with .Lighting", () => {
    for (const keyword of ["carpet", "rug", "runner", "tapestry", "banner"]) {
      const mapped = mapSourceTags({
        path: `textures/objects/red_${keyword}_01.png`,
        sourceTags: [".Lighting"]
      });
      expect(mapped.macroCategory).toBe("decoration");
      expect(mapped.usageRules.canBeLightEmitter).toBe(false);
      expect(mapped.assetGroups).not.toContain("lighting");
    }
  });

  it("6. maps VM_Table -> sourcePacks VM + assetGroups table (no vm group)", () => {
    const mapped = mapSourceTags({
      path: "Venatus Maps/textures/objects/VM_Table_01.png",
      sourceTags: [".VM Table"]
    });
    expect(mapped.sourcePacks).toEqual(["VM"]);
    expect(mapped.assetGroups).toContain("table");
    expect(mapped.assetGroups).not.toContain("vm");
    expect(mapped.macroCategory).toBe("furniture");
  });

  it("6b. keeps VM tavern as themeTag, not assetGroup", () => {
    const mapped = mapSourceTags({
      path: "textures/objects/VM_tavern_sign.png",
      sourceTags: [".VM Tavern"]
    });
    expect(mapped.sourcePacks).toEqual(["VM"]);
    expect(mapped.themeTags).toContain("tavern");
    expect(mapped.assetGroups).not.toContain("tavern");
  });

  it("7. flags unknown tags as needs-review", () => {
    const mapped = mapSourceTags({
      path: "textures/objects/strange_thing.png",
      sourceTags: [".Administration"]
    });
    expect(mapped.macroCategory).toBe("unknown");
    expect(mapped.status).toBe("needs-review");
  });
});

describe("overrides", () => {
  it("applies group and asset overrides after mapping", () => {
    const item = manifestItem("textures/objects/red_carpet_01.png", [
      ".Lighting"
    ]);
    const overrides: AssetOverridesFile = {
      assets: {
        "textures/objects/red_carpet_01.png": {
          assetGroups: ["carpet", "runner"],
          themeTags: ["tavern", "noble"],
          status: "approved"
        }
      }
    };
    const { item: result, applied } = applyOverrides(item, overrides);
    expect(result.assetGroups).toEqual(["carpet", "runner"]);
    expect(result.themeTags).toEqual(["tavern", "noble"]);
    expect(applied).toContain("asset:textures/objects/red_carpet_01.png");
  });
});

describe("findAssets", () => {
  const corpus: AssetManifestItem[] = [
    manifestItem("textures/objects/table_01.png", [".Table"]),
    manifestItem("textures/lights/torch_01.png", [".Lighting"]),
    manifestItem("textures/objects/red_carpet_01.png", [".Lighting"]),
    {
      ...manifestItem("textures/objects/odd.png", [".Administration"])
    }
  ];

  it("9. returns only approved assets by default", () => {
    const results = findAssets(corpus, { macroCategory: "furniture" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.status === "approved")).toBe(true);
  });

  it("8. never surfaces a carpet as a light", () => {
    const lights = findAssets(corpus, { macroCategory: "light" });
    expect(lights.some((item) => item.path.includes("carpet"))).toBe(false);
  });

  it("10. tavern-on-stilts query pulls coherent tavern/wood/dock assets", () => {
    const tavernCorpus: AssetManifestItem[] = [
      manifestItem("textures/objects/VM_tavern_table.png", [
        ".Table",
        ".VM Tavern"
      ]),
      manifestItem("textures/objects/dock_plank.png", [".Dock", ".Wood"]),
      manifestItem("textures/objects/desert_cactus.png", [".Cacti", ".Desert"])
    ];
    const results = findAssets(tavernCorpus, {
      themeTags: ["tavern", "wood", "dock", "water"]
    });
    expect(results[0]?.path).not.toContain("desert");
    expect(results.some((item) => item.themeTags.includes("tavern"))).toBe(
      true
    );
  });
});
