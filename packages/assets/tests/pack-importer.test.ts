import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { applyPackRulesToEntry, importAssetPack, listPackPresets, type AssetManifestEntry } from "../src";

function buildEntry(relativePath: string, overrides: Partial<AssetManifestEntry> = {}): AssetManifestEntry {
  return {
    classification: "unknown",
    classificationSource: "automatic",
    confidence: 0.4,
    dominantColors: [],
    extension: "png",
    fileHash: "deadbeef",
    hasTransparency: false,
    height: 64,
    id: relativePath,
    relativePath,
    tags: ["existing"],
    thumbnailPath: null,
    width: 64,
    ...overrides
  };
}

describe("listPackPresets", () => {
  it("exposes the supported presets", () => {
    expect(listPackPresets()).toEqual([
      "forgotten-adventures",
      "two-minute-tabletop",
      "czepeku",
      "generic"
    ]);
  });
});

describe("applyPackRulesToEntry", () => {
  it("auto-tags forgotten-adventures wall assets", () => {
    const entry = buildEntry("Walls/Stone/wall-stone-01.png");
    const result = applyPackRulesToEntry(entry, "forgotten-adventures");

    expect(result.entry.classification).toBe("wall");
    expect(result.reclassified).toBe(true);
    expect(result.entry.tags).toEqual(expect.arrayContaining(["forgotten-adventures", "walls", "existing"]));
  });

  it("does not reclassify manually-tagged assets", () => {
    const entry = buildEntry("Walls/Stone/wall-stone-02.png", {
      classification: "prop",
      classificationSource: "manual"
    });
    const result = applyPackRulesToEntry(entry, "forgotten-adventures");

    expect(result.entry.classification).toBe("prop");
    expect(result.reclassified).toBe(false);
  });

  it("applies defaultTags regardless of pattern matches", () => {
    const entry = buildEntry("Misc/something.png");
    const result = applyPackRulesToEntry(entry, "generic", ["imported", "needs-review"]);

    expect(result.entry.tags).toEqual(expect.arrayContaining(["imported", "needs-review"]));
  });

  it("recognizes 2-minute-tabletop sacred locations", () => {
    const entry = buildEntry("Maps/Temple/temple-of-the-sun.png");
    const result = applyPackRulesToEntry(entry, "two-minute-tabletop");

    expect(result.entry.tags).toEqual(expect.arrayContaining(["2-minute-tabletop", "sacred"]));
  });
});

describe("importAssetPack", () => {
  it("scans a directory and applies preset auto-tagging end-to-end", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "dm-packimport-"));
    const assetRoot = path.join(tempRoot, "Pack");
    const wallsDir = path.join(assetRoot, "Walls", "Stone");
    await mkdir(wallsDir, { recursive: true });
    const image = await sharp({
      create: { background: { alpha: 1, b: 100, g: 100, r: 100 }, channels: 4, height: 32, width: 32 }
    })
      .png()
      .toBuffer();
    await writeFile(path.join(wallsDir, "wall-stone-01.png"), image);

    const result = await importAssetPack({
      assetRoot,
      outputRoot: tempRoot,
      preset: "forgotten-adventures"
    });

    expect(result.preset).toBe("forgotten-adventures");
    expect(result.added).toHaveLength(1);
    expect(result.added[0]?.classification).toBe("wall");
    expect(result.added[0]?.tags).toEqual(expect.arrayContaining(["forgotten-adventures", "walls"]));
    expect(result.presetTagsApplied).toBeGreaterThan(0);
    expect(result.reclassifiedCount).toBeGreaterThanOrEqual(0);

    const manifest = JSON.parse(await readFile(path.join(tempRoot, "data", "indexes", "assets.manifest.json"), "utf8")) as {
      assets: Array<{ classification: string; tags: string[] }>;
    };
    expect(manifest.assets[0]?.classification).toBe("wall");
    expect(manifest.assets[0]?.tags).toEqual(expect.arrayContaining(["forgotten-adventures", "walls"]));
  });
});
