import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  createEmbeddingProviderFromEnv,
  createLocalEmbeddingProvider,
  createRemoteEmbeddingProvider,
  explainAssetSearchResult,
  generateAssetEmbeddings,
  loadAssetEmbeddingIndex,
  resolveEmbeddingConfigFromEnv,
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
      reason: expect.stringContaining("red"),
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
    expect(results[0]?.reason).toContain("local score");
  });

  it("falls back to manifest metadata when no embedding index exists", async () => {
    const outputRoot = await createEmbeddingFixture();

    const results = await searchAssetsByText({ outputRoot, query: "blue water" });

    expect(results[0]).toMatchObject({
      assetId: "asset-blue-water",
      reason: expect.stringContaining("blue")
    });
  });

  it("exposes a provider interface with text and image methods", async () => {
    const outputRoot = await createEmbeddingFixture();
    const provider = createLocalEmbeddingProvider();
    const textVector = await provider.embedText("blue water");
    const imageVector = await provider.embedImage(path.join(outputRoot, "data", "previews", "assets", "blue.webp"));

    expect(provider.dimensions).toBe(textVector.length);
    expect(provider.dimensions).toBe(imageVector.length);
  });

  it("explains local search results", () => {
    expect(
      explainAssetSearchResult(
        {
          assetId: "asset-red-floor",
          reason: "",
          relativePath: "floors/red-stone.png",
          score: 0.8,
          tags: ["red", "stone", "floor"]
        },
        "red floor"
      )
    ).toContain("matched red, floor");
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

describe("remote embedding provider", () => {
  it("normalizes responses with data[0].embedding to the configured dimensions", async () => {
    let capturedBody: unknown = null;
    const fetchImpl: typeof fetch = async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body ?? "{}"));
      return new Response(
        JSON.stringify({
          data: [
            {
              embedding: [0.1, 0.2, 0.3, 0.4, 0.5]
            }
          ]
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      );
    };
    const provider = createRemoteEmbeddingProvider({
      dimensions: 8,
      endpoint: "https://example.test/embed",
      fetchImpl,
      model: "test-embed"
    });
    const vector = await provider.embedText("dark gothic library");

    expect(vector).toHaveLength(8);
    expect(vector.every((value) => typeof value === "number" && Number.isFinite(value))).toBe(true);
    expect((capturedBody as { model: string }).model).toBe("test-embed");
  });

  it("throws when the API responds with an error", async () => {
    const fetchImpl: typeof fetch = async () => new Response("nope", { status: 500 });
    const provider = createRemoteEmbeddingProvider({
      endpoint: "https://example.test/embed",
      fetchImpl
    });

    await expect(provider.embedText("query")).rejects.toThrow(/Remote embedding request failed/u);
  });
});

describe("resolveEmbeddingConfigFromEnv", () => {
  it("defaults to local when EMBEDDINGS_PROVIDER is unset", () => {
    expect(resolveEmbeddingConfigFromEnv({})).toEqual({ provider: "local" });
  });

  it("parses remote configuration", () => {
    expect(
      resolveEmbeddingConfigFromEnv({
        EMBEDDINGS_API_KEY: "secret",
        EMBEDDINGS_DIMENSIONS: "64",
        EMBEDDINGS_ENDPOINT: "https://example.test/embed",
        EMBEDDINGS_MODEL: "clip-vit",
        EMBEDDINGS_PROVIDER: "remote"
      })
    ).toEqual({
      apiKey: "secret",
      dimensions: 64,
      endpoint: "https://example.test/embed",
      model: "clip-vit",
      provider: "remote"
    });
  });

  it("falls back to local provider when remote endpoint is missing", () => {
    const provider = createEmbeddingProviderFromEnv({ EMBEDDINGS_PROVIDER: "remote" });
    expect(provider.id).toBe("local-color-layout-v1");
  });
});
