import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  applyOverrides,
  assembleManifestItem,
  type AssetManifestItem,
  auditManifest,
  buildManifest,
  computeStats,
  createAssetId,
  createDefaultUsageRules,
  createEmptyMetadata,
  extractSourcePacks,
  findAssetsScored,
  isSuspiciousLight,
  mapSourceTags,
  renderAuditMarkdown,
  TAXONOMY_PATHS,
  validateManifest
} from "../src/taxonomy";
import { enrichAssetMetadata } from "../src/taxonomy/metadata";

function makeItem(overrides: Partial<AssetManifestItem>): AssetManifestItem {
  return {
    id: overrides.id ?? createAssetId(overrides.path ?? "x.png"),
    path: overrides.path ?? "x.png",
    sourceTags: overrides.sourceTags ?? [".Prop"],
    sourcePacks: overrides.sourcePacks ?? [],
    macroCategory: overrides.macroCategory ?? "prop",
    assetGroups: overrides.assetGroups ?? [],
    assetSubGroups: overrides.assetSubGroups ?? [],
    themeTags: overrides.themeTags ?? [],
    placementTags: overrides.placementTags ?? [],
    usageRules: overrides.usageRules ?? createDefaultUsageRules(),
    metadata: overrides.metadata ?? createEmptyMetadata(),
    qualityFlags: overrides.qualityFlags ?? [],
    status: overrides.status ?? "approved",
    taxonomyNotes: overrides.taxonomyNotes ?? []
  };
}

/** A corpus that satisfies all required fundamental categories. */
function validCorpus(): AssetManifestItem[] {
  return [
    makeItem({ path: "f.png", macroCategory: "floor" }),
    makeItem({ path: "w.png", macroCategory: "wall" }),
    makeItem({ path: "fu.png", macroCategory: "furniture" }),
    makeItem({ path: "l.png", macroCategory: "light" }),
    makeItem({ path: "d.png", macroCategory: "decoration" }),
    makeItem({ path: "t.png", macroCategory: "terrain" })
  ];
}

describe("manifest-io", () => {
  it("createAssetId is deterministic and path-derived", () => {
    expect(createAssetId("textures/a.png")).toBe(
      createAssetId("textures/a.png")
    );
    expect(createAssetId("textures/a.png")).not.toBe(
      createAssetId("textures/b.png")
    );
    expect(createAssetId("a.png")).toMatch(/^asset_[0-9a-f]{12}$/u);
  });

  it("assembleManifestItem fills extension and default metadata", () => {
    const item = assembleManifestItem({
      path: "textures/objects/table_01.PNG",
      mapped: mapSourceTags({ path: "table_01.png", sourceTags: [".Table"] })
    });
    expect(item.metadata.extension).toBe("png");
    expect(item.id).toMatch(/^asset_/u);
  });

  it("buildManifest sorts by path and computes stats", () => {
    const manifest = buildManifest([
      makeItem({ path: "z.png", macroCategory: "prop", sourcePacks: ["VM"] }),
      makeItem({ path: "a.png", macroCategory: "floor", status: "needs-review" })
    ]);
    expect(manifest.assets[0]?.path).toBe("a.png");
    expect(manifest.stats.totalAssets).toBe(2);
    expect(manifest.stats.vmTaggedAssets).toBe(1);
    expect(manifest.stats.macroCategoryCounts.prop).toBe(1);
    expect(manifest.stats.statusCounts["needs-review"]).toBe(1);
  });

  it("computeStats counts categories and VM packs", () => {
    const stats = computeStats(validCorpus());
    expect(stats.totalAssets).toBe(6);
    expect(stats.macroCategoryCounts.light).toBe(1);
  });

  it("exposes pipeline paths", () => {
    expect(TAXONOMY_PATHS.finalManifest).toBe("data/assets/asset-manifest.json");
  });
});

describe("extractSourcePacks", () => {
  it("detects VM as a standalone token in tags or path", () => {
    expect(extractSourcePacks([".VM Table"], "x.png")).toEqual(["VM"]);
    expect(extractSourcePacks([".Table"], "Venatus/VM_rocks.png")).toEqual([
      "VM"
    ]);
    expect(extractSourcePacks([".Table"], "advmap.png")).toEqual([]);
  });
});

describe("findAssetsScored", () => {
  const corpus: AssetManifestItem[] = [
    makeItem({
      id: "asset_a",
      path: "tavern_table.png",
      macroCategory: "furniture",
      assetGroups: ["table"],
      themeTags: ["tavern"],
      placementTags: ["floor"],
      sourcePacks: ["VM"],
      usageRules: {
        ...createDefaultUsageRules(),
        preferredRooms: ["tavern"],
        preferredMapTypes: ["village"]
      }
    }),
    makeItem({
      id: "asset_b",
      path: "desert_table.png",
      macroCategory: "furniture",
      assetGroups: ["table"],
      themeTags: ["desert"],
      usageRules: {
        ...createDefaultUsageRules(),
        avoidRooms: ["tavern"],
        avoidMapTypes: ["village"]
      }
    })
  ];

  it("scores macroCategory + groups + themes and ranks accordingly", () => {
    const results = findAssetsScored(corpus, {
      macroCategory: "furniture",
      assetGroups: ["table"],
      themeTags: ["tavern"]
    });
    expect(results[0]?.item.id).toBe("asset_a");
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  it("applies preferred/avoid map type and room bonuses", () => {
    const preferred = findAssetsScored(corpus, {
      macroCategory: "furniture",
      preferredRoom: "tavern",
      preferredMapType: "village"
    });
    expect(preferred[0]?.item.id).toBe("asset_a");
  });

  it("filters by sourcePacks and excludeSourcePacks", () => {
    expect(
      findAssetsScored(corpus, { macroCategory: "furniture", sourcePacks: ["VM"] })
    ).toHaveLength(1);
    expect(
      findAssetsScored(corpus, {
        macroCategory: "furniture",
        excludeSourcePacks: ["VM"]
      }).every((result) => !result.item.sourcePacks.includes("VM"))
    ).toBe(true);
  });

  it("honors limit and excludes non-requested status", () => {
    expect(
      findAssetsScored(corpus, { macroCategory: "furniture", limit: 1 })
    ).toHaveLength(1);
    expect(
      findAssetsScored([makeItem({ status: "quarantine" })], {
        macroCategory: "prop"
      })
    ).toHaveLength(0);
  });
});

describe("isSuspiciousLight", () => {
  it("flags a light asset whose path/groups look like a carpet", () => {
    const light = makeItem({
      path: "textures/objects/red_carpet.png",
      macroCategory: "light",
      usageRules: { ...createDefaultUsageRules(), canBeLightEmitter: true }
    });
    expect(isSuspiciousLight(light)).toBe(true);
  });

  it("does not flag a normal light", () => {
    expect(
      isSuspiciousLight(makeItem({ path: "torch.png", macroCategory: "light" }))
    ).toBe(false);
  });
});

describe("applyOverrides", () => {
  it("applies pack strip, group union and asset replace in order", () => {
    const item = makeItem({
      path: "textures/VM_table.png",
      sourceTags: [".VM Table"],
      sourcePacks: ["VM"],
      assetGroups: ["table", "vm"],
      macroCategory: "furniture"
    });
    const { item: result, applied } = applyOverrides(item, {
      packs: { VM: { stripFromNormalizedGroups: true } },
      groups: { ".VM Table": { themeTags: ["tavern"] } },
      assets: { "textures/VM_table.png": { status: "needs-review" } }
    });
    expect(result.assetGroups).not.toContain("vm");
    expect(result.themeTags).toContain("tavern");
    expect(result.status).toBe("needs-review");
    expect(applied).toEqual([
      "pack:VM:strip-groups",
      "group:.VM Table",
      "asset:textures/VM_table.png"
    ]);
  });

  it("returns the item untouched when no rule matches", () => {
    const item = makeItem({ path: "lonely.png" });
    const { applied } = applyOverrides(item, {});
    expect(applied).toHaveLength(0);
  });
});

describe("auditManifest", () => {
  it("counts every anomaly bucket and renders markdown", () => {
    const corpus: AssetManifestItem[] = [
      makeItem({ path: "dup.png", qualityFlags: ["missing-file"] }),
      makeItem({ path: "dup.png", macroCategory: "unknown", sourceTags: [] }),
      makeItem({
        path: "carpet_light.png",
        macroCategory: "light",
        assetGroups: ["carpet"]
      }),
      makeItem({
        path: "conflict.png",
        qualityFlags: ["multi-category-conflict"]
      }),
      makeItem({
        path: "small.png",
        metadata: { ...createEmptyMetadata(), width: 8, height: 8 }
      }),
      makeItem({
        path: "opaque.png",
        macroCategory: "furniture",
        metadata: { ...createEmptyMetadata(), hasTransparency: false }
      }),
      makeItem({ path: "VM_unmarked.png", sourcePacks: [] })
    ];
    const report = auditManifest(corpus);
    const byId = Object.fromEntries(
      report.checks.map((check) => [check.id, check.count])
    );
    expect(report.totalAssets).toBe(7);
    expect(byId["missing-files"]).toBe(1);
    expect(byId.unknown).toBe(1);
    expect(byId["no-source-tags"]).toBe(1);
    expect(byId["duplicate-paths"]).toBe(1);
    expect(byId["carpet-as-light"]).toBe(1);
    expect(byId["category-conflict"]).toBe(1);
    expect(byId.tiny).toBe(1);
    expect(byId["opaque-detail-asset"]).toBe(1);
    expect(byId["vm-path-not-marked"]).toBe(1);

    const markdown = renderAuditMarkdown(report);
    expect(markdown).toContain("# DM-Instamap");
    expect(markdown).toContain("Carpet/rug/runner/banner");
  });
});

describe("validateManifest", () => {
  it("passes a complete corpus (with unknown within threshold as warning)", () => {
    const corpus = [
      ...validCorpus(),
      makeItem({ path: "u.png", macroCategory: "unknown", status: "needs-review" })
    ];
    const result = validateManifest(corpus, { maxUnknownRatio: 0.5 });
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.code === "unknown-present")).toBe(true);
  });

  it("fails on empty manifest", () => {
    expect(validateManifest([]).ok).toBe(false);
  });

  it("fails on suspicious light, duplicate ids, missing identity and categories", () => {
    const result = validateManifest([
      makeItem({
        id: "dup",
        path: "carpet.png",
        macroCategory: "light",
        assetGroups: ["rug"]
      }),
      makeItem({ id: "dup", path: "" })
    ]);
    expect(result.ok).toBe(false);
    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain("suspicious-light");
    expect(codes).toContain("missing-identity");
    expect(codes).toContain("duplicate-ids");
    expect(codes).toContain("missing-categories");
  });

  it("fails when unknown exceeds the configured ratio", () => {
    const result = validateManifest(
      [
        ...validCorpus(),
        makeItem({ path: "u1.png", macroCategory: "unknown" }),
        makeItem({ path: "u2.png", macroCategory: "unknown" })
      ],
      { maxUnknownRatio: 0.01 }
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === "too-many-unknown")).toBe(
      true
    );
  });
});

describe("enrichAssetMetadata", () => {
  it("flags missing files", async () => {
    const item = makeItem({ path: "nope.png" });
    const result = await enrichAssetMetadata(item, null);
    expect(result.qualityFlags).toContain("missing-file");
  });

  it("reads dimensions, transparency and hash from a real image", async () => {
    const buffer = await sharp({
      create: {
        width: 10,
        height: 20,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .png()
      .toBuffer();
    const { writeFile, mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "dm-meta-"));
    const file = join(dir, "tiny.png");
    await writeFile(file, buffer);

    const result = await enrichAssetMetadata(makeItem({ path: "tiny.png" }), file);
    expect(result.metadata.width).toBe(10);
    expect(result.metadata.height).toBe(20);
    expect(result.metadata.hasTransparency).toBe(true);
    expect(result.metadata.aspectRatio).toBeCloseTo(0.5, 2);
    expect(result.metadata.hash).toMatch(/^[0-9a-f]{40}$/u);
    expect(result.qualityFlags).toContain("tiny");
  });

  it("flags an unreadable file as corrupt", async () => {
    const { writeFile, mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "dm-meta-bad-"));
    const file = join(dir, "broken.png");
    await writeFile(file, "not a real png");

    const result = await enrichAssetMetadata(makeItem({ path: "broken.png" }), file);
    expect(result.qualityFlags).toContain("corrupt");
  });
});
