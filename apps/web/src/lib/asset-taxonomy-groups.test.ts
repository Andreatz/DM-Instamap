import { describe, expect, it } from "vitest";
import {
  buildTaxonomyGroups,
  normalizeManifestItems,
  type TaxonomyManifestItem
} from "./asset-taxonomy-groups";

function item(
  overrides: Partial<TaxonomyManifestItem> & { id: string; path: string }
): TaxonomyManifestItem {
  return {
    assetGroups: [],
    canBeLightEmitter: false,
    macroCategory: "prop",
    qualityFlags: [],
    sourcePacks: [],
    status: "approved",
    themeTags: [],
    ...overrides
  };
}

describe("buildTaxonomyGroups", () => {
  it("groups 10 table assets into a single furniture/table group", () => {
    const items = Array.from({ length: 10 }, (_, index) =>
      item({
        assetGroups: ["table"],
        id: `asset_table_${index}`,
        macroCategory: "furniture",
        path: `textures/objects/table_${index}.png`,
        themeTags: ["tavern"]
      })
    );

    const { groups } = buildTaxonomyGroups(items);
    const tableGroups = groups.filter(
      (group) => group.id === "furniture/table"
    );
    expect(tableGroups).toHaveLength(1);
    expect(tableGroups[0]?.assetCount).toBe(10);
    expect(tableGroups[0]?.statusCounts.approved).toBe(10);
    expect(tableGroups[0]?.themeTags).toContain("tavern");
  });

  it("keeps VM out of the group name but exposes it in sourcePacks", () => {
    const items = [
      item({
        assetGroups: ["table"],
        id: "asset_vm_table",
        macroCategory: "furniture",
        path: "textures/objects/VM_table_01.png",
        sourcePacks: ["VM"]
      })
    ];

    const { groups, summary } = buildTaxonomyGroups(items);
    const group = groups[0];
    expect(group?.id).toBe("furniture/table");
    expect(group?.name).not.toContain("VM");
    expect(group?.assetGroup).not.toContain("vm");
    expect(group?.sourcePacks).toContain("VM");
    expect(summary.topSourcePacks[0]).toEqual({ count: 1, pack: "VM" });
  });

  it("never places carpet/rug/runner in a light group", () => {
    const items = [
      item({
        assetGroups: ["carpet"],
        id: "asset_carpet",
        macroCategory: "decoration",
        path: "textures/objects/red_carpet_01.png"
      }),
      item({
        assetGroups: ["lantern"],
        id: "asset_lantern",
        macroCategory: "light",
        path: "textures/lights/lantern_01.png"
      })
    ];

    const { groups, summary } = buildTaxonomyGroups(items);
    const lightGroups = groups.filter(
      (group) => group.macroCategory === "light"
    );
    expect(lightGroups.every((group) => group.assetGroup !== "carpet")).toBe(
      true
    );
    expect(groups.some((group) => group.id === "decoration/carpet")).toBe(true);
    expect(summary.suspiciousLight).toBe(0);
  });

  it("counts unknown assets as needs-review", () => {
    const items = [
      item({
        assetGroups: ["administration"],
        id: "asset_unknown",
        macroCategory: "unknown",
        path: "textures/objects/admin_01.png",
        status: "needs-review"
      })
    ];

    const { groups, summary } = buildTaxonomyGroups(items);
    expect(summary.unknown).toBe(1);
    expect(summary.needsReview).toBe(1);
    expect(groups[0]?.statusCounts["needs-review"]).toBe(1);
    expect(groups[0]?.macroCategory).toBe("unknown");
  });

  it("produces far fewer semantic groups than assets", () => {
    const groupsCatalog = [
      { group: "table", macro: "furniture" },
      { group: "chair", macro: "furniture" },
      { group: "barrel", macro: "furniture" },
      { group: "carpet", macro: "decoration" },
      { group: "lantern", macro: "light" },
      { group: "rock", macro: "terrain" },
      { group: "river", macro: "water" },
      { group: "ship", macro: "prop" }
    ];
    const items = Array.from({ length: 4000 }, (_, index) => {
      const spec = groupsCatalog[index % groupsCatalog.length]!;
      return item({
        assetGroups: [spec.group],
        id: `asset_${index}`,
        macroCategory: spec.macro,
        path: `textures/${spec.group}_${index}.png`
      });
    });

    const { groups, summary } = buildTaxonomyGroups(items);
    expect(summary.totalAssets).toBe(4000);
    expect(groups.length).toBe(groupsCatalog.length);
    expect(groups.length).toBeLessThan(items.length / 100);
  });
});

describe("normalizeManifestItems", () => {
  it("normalizes raw manifest entries and skips invalid ones", () => {
    const items = normalizeManifestItems([
      {
        assetGroups: ["table"],
        id: "asset_a",
        macroCategory: "furniture",
        path: "textures/objects/a.png",
        sourcePacks: ["VM"],
        status: "approved",
        themeTags: ["tavern"],
        usageRules: { canBeLightEmitter: false }
      },
      { id: "", path: "no-id.png" },
      "not-an-object"
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]?.macroCategory).toBe("furniture");
    expect(items[0]?.status).toBe("approved");
  });

  it("defaults an unknown status to needs-review", () => {
    const items = normalizeManifestItems([
      { id: "asset_b", path: "b.png", status: "bogus" }
    ]);
    expect(items[0]?.status).toBe("needs-review");
  });
});
