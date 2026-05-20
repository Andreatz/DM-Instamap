import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { analyzeLocalImage } from "../src";

describe("analyzeLocalImage", () => {
  it("extracts local metadata, transparency and dominant colors with Sharp", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "dm-instamap-image-analysis-"));
    const imagePath = path.join(tempDir, "glow.png");

    await sharp({
      create: {
        background: { alpha: 0.5, b: 32, g: 96, r: 224 },
        channels: 4,
        height: 4,
        width: 6
      }
    })
      .png()
      .toFile(imagePath);

    const analysis = await analyzeLocalImage(imagePath);

    expect(analysis).toMatchObject({
      format: "png",
      height: 4,
      imagePath,
      transparency: true,
      width: 6
    });
    expect(analysis.dominantColors[0]).toMatchObject({
      hex: "#e06020",
      population: 24
    });
  });
});
