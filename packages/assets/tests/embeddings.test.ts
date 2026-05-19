import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  createLocalEmbeddingProvider,
  generateAssetEmbeddings,
  loadAssetEmbeddingIndex,
  searchAssetsByImage,
  searchAssetsByText
} from "../src";

describe("local asset embeddings", () => {
  it("generates local vectors for asset thumbnails and stores them", async () => {
    const outputRoot = await createEmbeddingFixture();
    const index = await generateAssetEmbeddings({ outputRoot });
    const written = await loadAssetEmbeddingIndex({ outputRoot });

    expect(index.provider).toBe("local-color-layout-v1");
    expect(index.vectors).toHaveLength(2);
    expect(index.vectors.every((entry) => entry.vector.length === index.dimensions)).toBe(true);
    expect(written?.vectors.map((entry) => entry.assetId).sort()).toEqual(["asset-blue-water", "asset-red-floor"]);

    const file = JSON.parse(await readFile(path.join(outputRoot, "data", "indexes", "asset-embeddings.json"), "utf8")) as {
      version: number;
    };
    expect(file.version).toBe(1);
  });

  it("supports text-to-asset search with local metadata and vectors", async () => {
    const outputRoot = await createEmbeddingFixture();
    await generateAssetEmbeddings({ outputRoot });

    const results = await searchAssetsByText({
      outputRoot,
      query: "red stone floor"
    });

    expect(results[0]).toMatchObject({
      assetId: "asset-red-floor",
      relativePath: "floors/red-stone.png"
    });
  });

  it("supports image-to-image search", async () => {
    const outputRoot = await createEmbeddingFixture();
    const queryImage = path.join(outputRoot, "query-red.png");
    await sharp({
      create: {
        background: { alpha: 1, b: 30, g: 30, r: 230 },
        channels: 4,
        height: 16,
        width: 16
      }
    })
      .png()
      .toFile(queryImage);
    await generateAssetEmbeddings({ outputRoot });

    const results = await searchAssetsByImage({
      imagePath: queryImage,
      outputRoot
    });

    expect(results[0]?.assetId).toBe("asset-red-floor");
  });

  it("keeps search optional when no embedding index exists", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "dm-instamap-no-embeddings-"));

    await expect(searchAssetsByText({ outputRoot, query: "floor" })).resolves.toEqual([]);
  });

  it("exposes a provider interface with text and image methods", async () => {
    const outputRoot = await createEmbeddingFixture();
    const provider = createLocalEmbeddingProvider();
    const textVector = await provider.embedText("blue water");
    const imageVector = await provider.embedImage(path.join(outputRoot, "data", "previews", "assets", "blue.webp"));

    expect(provider.dimensions).toBe(textVector.length);
    expect(provider.dimensions).toBe(imageVector.length);
  });
});

async function createEmbeddingFixture(): Promise<string> {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "dm-instamap-embeddings-"));
  const previewDir = path.join(outputRoot, "data", "previews", "assets");
  const indexDir = path.join(outputRoot, "data", "indexes");
  await mkdir(previewDir, { recursive: true });
  await mkdir(indexDir, { recursive: true });

  await sharp({
    create: {
      background: { alpha: 1, b: 30, g: 30, r: 230 },
      channels: 4,
      height: 16,
      width: 16
    }
  })
    .webp()
    .toFile(path.join(previewDir, "red.webp"));

  await sharp({
    create: {
      background: { alpha: 1, b: 230, g: 110, r: 20 },
      channels: 4,
      height: 16,
      width: 16
    }
  })
    .webp()
    .toFile(path.join(previewDir, "blue.webp"));

  await writeFile(
    path.join(indexDir, "assets.manifest.json"),
    JSON.stringify(
      {
        assets: [
          {
            classification: "floor",
            dominantColors: [{ hex: "#e02020", population: 10 }],
            id: "asset-red-floor",
            relativePath: "floors/red-stone.png",
            tags: ["red", "stone", "floor"],
            thumbnailPath: "data/previews/assets/red.webp"
          },
          {
            classification: "water",
            dominantColors: [{ hex: "#146ee6", population: 10 }],
            id: "asset-blue-water",
            relativePath: "terrain/blue-water.png",
            tags: ["blue", "water"],
            thumbnailPath: "data/previews/assets/blue.webp"
          }
        ],
        version: 1
      },
      null,
      2
    ),
    "utf8"
  );

  return outputRoot;
}
