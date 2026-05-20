import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditAssets,
  buildAssetReviewQueue,
  calculateAssetQualityScore,
  createVisualHash,
  findDuplicateGroups
} from "../src";

describe("asset audit", () => {
  it("calculates quality signals from local metadata", () => {
    const result = calculateAssetQualityScore({
      classification: "floor",
      confidence: 0.82,
      dominantColors: [
        { hex: "#404040", population: 10 },
        { hex: "#808080", population: 5 }
      ],
      hasTransparency: false,
      height: 512,
      relativePath: "Dungeon/Floors/stone-floor.png",
      tags: ["dungeon", "stone", "floor"],
      width: 512
    });

    expect(result.qualityScore).toBeGreaterThan(70);
    expect(result.qualitySignals.resolution).toBeGreaterThan(0.6);
    expect(result.qualitySignals.classificationConfidence).toBe(0.82);
  });

  it("creates stable visual hashes from dimensions, transparency and colors", () => {
    const hash = createVisualHash({
      dominantColors: [{ hex: "#202020", population: 10 }],
      hasTransparency: true,
      height: 64,
      width: 256
    });

    expect(hash).toBe("long|alpha|#202020");
  });

  it("finds exact and visual duplicate groups", () => {
    const groups = findDuplicateGroups([
      {
        classification: "door",
        fileHash: "same-hash",
        id: "asset-a",
        relativePath: "doors/a.png"
      },
      {
        classification: "door",
        fileHash: "same-hash",
        id: "asset-b",
        relativePath: "doors/b.png"
      },
      {
        classification: "floor",
        dominantColors: [{ hex: "#808080", population: 10 }],
        hasTransparency: false,
        height: 512,
        id: "asset-c",
        relativePath: "floors/c.png",
        width: 512
      },
      {
        classification: "floor",
        dominantColors: [{ hex: "#808080", population: 8 }],
        hasTransparency: false,
        height: 1024,
        id: "asset-d",
        relativePath: "floors/d.png",
        width: 1024
      }
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.some((group) => group.reason === "file-hash" && group.assetIds.includes("asset-a"))).toBe(true);
    expect(groups.some((group) => group.reason === "visual-hash" && group.assetIds.includes("asset-c"))).toBe(true);
  });

  it("builds a review queue for unknown and low-confidence assets", () => {
    const queue = buildAssetReviewQueue([
      {
        classification: "unknown",
        confidence: 0.1,
        height: 128,
        id: "asset-unknown",
        relativePath: "misc/blob.png",
        tags: [],
        width: 128
      },
      {
        classification: "floor",
        confidence: 0.91,
        dominantColors: [{ hex: "#808080", population: 10 }],
        hasTransparency: false,
        height: 1024,
        id: "asset-good",
        relativePath: "floors/good-stone-floor.png",
        tags: ["good", "stone", "floor"],
        width: 1024
      }
    ]);

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      assetId: "asset-unknown",
      reviewPriority: "critical"
    });
  });

  it("writes data/indexes/asset-audit.json", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "dm-instamap-audit-"));
    const indexDir = path.join(outputRoot, "data", "indexes");
    await mkdir(indexDir, { recursive: true });
    await writeFile(
      path.join(indexDir, "assets.manifest.json"),
      JSON.stringify({
        assets: [
          {
            classification: "unknown",
            confidence: 0.1,
            fileHash: "hash-a",
            height: 64,
            id: "asset-a",
            relativePath: "unknown/a.png",
            tags: [],
            width: 64
          },
          {
            classification: "door",
            confidence: 0.7,
            fileHash: "hash-a",
            height: 64,
            id: "asset-b",
            relativePath: "doors/b.png",
            tags: ["door"],
            width: 256
          }
        ],
        version: 1
      }),
      "utf8"
    );

    const audit = await auditAssets({ outputRoot });
    const written = JSON.parse(await readFile(path.join(indexDir, "asset-audit.json"), "utf8")) as typeof audit;

    expect(written.assetCount).toBe(2);
    expect(written.duplicateGroupCount).toBe(1);
    expect(written.needsReviewCount).toBeGreaterThan(0);
    expect(written.reviewQueue[0]?.reviewPriority).toBe("critical");
  });
});
