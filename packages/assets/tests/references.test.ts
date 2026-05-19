import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { scanReferences } from "../src";

describe("scanReferences", () => {
  it("scans local reference maps and writes a manifest with thumbnails", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "dm-instamap-references-"));
    const sourceDir = path.join(tempDir, "source");
    const outputRoot = path.join(tempDir, "output");
    await mkdir(path.join(sourceDir, "Dungeon Maps"), { recursive: true });
    await mkdir(path.join(sourceDir, "City"), { recursive: true });

    await sharp({
      create: {
        background: { alpha: 1, b: 30, g: 80, r: 120 },
        channels: 4,
        height: 80,
        width: 120
      }
    })
      .png()
      .toFile(path.join(sourceDir, "Dungeon Maps", "ancient-dungeon-map.png"));

    await sharp({
      create: {
        background: { alpha: 1, b: 90, g: 100, r: 180 },
        channels: 4,
        height: 64,
        width: 64
      }
    })
      .jpeg()
      .toFile(path.join(sourceDir, "City", "market-district.jpg"));

    await sharp({
      create: {
        background: { alpha: 1, b: 180, g: 150, r: 30 },
        channels: 4,
        height: 50,
        width: 90
      }
    })
      .webp()
      .toFile(path.join(sourceDir, "coastal-harbor.webp"));

    await writeFile(
      path.join(sourceDir, "ignored.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"></svg>',
      "utf8"
    );

    const manifest = await scanReferences(sourceDir, { outputRoot, thumbnailSize: 24 });
    const manifestFile = await readFile(
      path.join(outputRoot, "data", "indexes", "references.manifest.json"),
      "utf8"
    );

    expect(manifest.references).toHaveLength(3);
    expect(manifest.errors).toHaveLength(0);
    expect(JSON.parse(manifestFile)).toMatchObject({ version: 1 });
    expect(new Set(manifest.references.map((reference) => reference.path))).toEqual(
      new Set(["City/market-district.jpg", "Dungeon Maps/ancient-dungeon-map.png", "coastal-harbor.webp"])
    );

    const dungeon = manifest.references.find((reference) => reference.path.includes("dungeon"));
    expect(dungeon).toMatchObject({
      extension: "png",
      height: 80,
      mapType: "dungeon",
      mapTypeConfidence: 0.75,
      tags: ["ancient", "dungeon", "map", "maps"],
      width: 120
    });
    expect(dungeon?.dominantColors.length).toBeGreaterThan(0);
    expect(dungeon?.fileHash.length).toBe(64);

    const city = manifest.references.find((reference) => reference.path.includes("market"));
    expect(city?.mapType).toBe("city");
    expect(city?.mapTypeConfidence).toBeGreaterThan(0.5);

    const coast = manifest.references.find((reference) => reference.path.includes("coastal"));
    expect(coast?.mapType).toBe("coast");

    for (const reference of manifest.references) {
      expect(reference.thumbnailPath).toBeTruthy();
      const preview = await readFile(path.join(outputRoot, reference.thumbnailPath ?? ""));
      expect(preview.byteLength).toBeGreaterThan(0);
    }
  });
});
