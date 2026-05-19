import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { scanAssets } from "../src";

describe("scanAssets", () => {
  it("scans local sample images and writes a manifest with thumbnails", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "dm-instamap-assets-"));
    const sourceDir = path.join(tempDir, "source");
    const outputRoot = path.join(tempDir, "output");
    await mkdir(path.join(sourceDir, "props"), { recursive: true });

    await sharp({
      create: {
        background: { alpha: 1, b: 20, g: 40, r: 220 },
        channels: 4,
        height: 4,
        width: 6
      }
    })
      .png()
      .toFile(path.join(sourceDir, "red-room.png"));

    await sharp({
      create: {
        background: { alpha: 0.4, b: 255, g: 120, r: 20 },
        channels: 4,
        height: 5,
        width: 5
      }
    })
      .webp()
      .toFile(path.join(sourceDir, "props", "glow.webp"));

    await writeFile(
      path.join(sourceDir, "walls.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><rect width="12" height="8" fill="#336699"/></svg>',
      "utf8"
    );

    await writeFile(path.join(sourceDir, "notes.txt"), "not an image", "utf8");

    const manifest = await scanAssets(sourceDir, { outputRoot, thumbnailSize: 16 });
    const manifestFile = await readFile(
      path.join(outputRoot, "data", "indexes", "assets.manifest.json"),
      "utf8"
    );

    expect(manifest.assets).toHaveLength(3);
    expect(manifest.errors).toHaveLength(0);
    expect(JSON.parse(manifestFile)).toMatchObject({ version: 1 });
    expect(manifest.assets.map((asset) => asset.relativePath)).toEqual([
      "props/glow.webp",
      "red-room.png",
      "walls.svg"
    ]);
    expect(manifest.assets.every((asset) => asset.fileHash.length === 64)).toBe(true);
    expect(manifest.assets.every((asset) => asset.dominantColors.length > 0)).toBe(true);
    expect(manifest.assets.every((asset) => asset.confidence >= 0 && asset.confidence <= 1)).toBe(true);

    const png = manifest.assets.find((asset) => asset.relativePath === "red-room.png");
    expect(png).toMatchObject({
      classification: "unknown",
      classificationSource: "automatic",
      extension: "png",
      hasTransparency: false,
      height: 4,
      tags: ["red", "room"],
      width: 6
    });

    const webp = manifest.assets.find((asset) => asset.relativePath === "props/glow.webp");
    expect(webp?.classification).toBe("prop");
    expect(webp?.hasTransparency).toBe(true);

    for (const asset of manifest.assets) {
      expect(asset.thumbnailPath).toBeTruthy();
      const preview = await readFile(path.join(outputRoot, asset.thumbnailPath ?? ""));
      expect(preview.byteLength).toBeGreaterThan(0);
    }
  });

  it("applies manual overrides from data/indexes/asset-overrides.json", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "dm-instamap-assets-"));
    const sourceDir = path.join(tempDir, "source");
    const outputRoot = path.join(tempDir, "output");
    await mkdir(path.join(sourceDir, "floors"), { recursive: true });
    await mkdir(path.join(outputRoot, "data", "indexes"), { recursive: true });

    await sharp({
      create: {
        background: { alpha: 1, b: 20, g: 90, r: 90 },
        channels: 4,
        height: 8,
        width: 8
      }
    })
      .png()
      .toFile(path.join(sourceDir, "floors", "stone-floor.png"));

    await writeFile(
      path.join(outputRoot, "data", "indexes", "asset-overrides.json"),
      JSON.stringify(
        {
          overrides: {
            "floors/stone-floor.png": {
              classification: "terrain",
              confidence: 0.87,
              tags: ["manual", "moss"]
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const manifest = await scanAssets(sourceDir, { outputRoot, thumbnailSize: 16 });

    expect(manifest.assets[0]).toMatchObject({
      classification: "terrain",
      classificationSource: "manual",
      confidence: 0.87,
      relativePath: "floors/stone-floor.png",
      tags: ["manual", "moss"]
    });
  });
});
