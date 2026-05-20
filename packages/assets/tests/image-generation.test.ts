import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createAutomatic1111Provider,
  createCustomImageGenerationProvider,
  createImageGenerationProviderFromEnv,
  createReplicateImageGenerationProvider,
  importGeneratedAssetToLibrary,
  resolveImageGenerationConfigFromEnv
} from "../src";

describe("createAutomatic1111Provider", () => {
  it("decodes the first base64 image from txt2img", async () => {
    const pngBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ images: [pngBytes.toString("base64")] }), {
        headers: { "content-type": "application/json" },
        status: 200
      });
    const provider = createAutomatic1111Provider({ fetchImpl });
    const result = await provider.generate({
      height: 256,
      prompt: "stone floor tile",
      width: 256
    });

    expect(result.contentType).toBe("image/png");
    expect(Buffer.compare(result.data, pngBytes)).toBe(0);
  });

  it("throws when the SD endpoint returns an error", async () => {
    const fetchImpl: typeof fetch = async () => new Response("bad", { status: 500 });
    const provider = createAutomatic1111Provider({ fetchImpl });

    await expect(provider.generate({ prompt: "x" })).rejects.toThrow(/Automatic1111 request failed/u);
  });
});

describe("createReplicateImageGenerationProvider", () => {
  it("polls the prediction and downloads the resulting image", async () => {
    const pngBytes = Buffer.from([1, 2, 3, 4]);
    let calls = 0;
    const fetchImpl: typeof fetch = async (url) => {
      calls += 1;
      const urlString = String(url);

      if (urlString.endsWith("/v1/predictions")) {
        return new Response(
          JSON.stringify({
            id: "pred-1",
            input: { seed: 42 },
            status: "processing",
            urls: { get: "https://example.test/v1/predictions/pred-1" }
          }),
          { status: 200 }
        );
      }

      if (urlString.endsWith("/predictions/pred-1")) {
        return new Response(
          JSON.stringify({
            id: "pred-1",
            input: { seed: 42 },
            output: ["https://example.test/image.png"],
            status: "succeeded"
          }),
          { status: 200 }
        );
      }

      if (urlString.endsWith("image.png")) {
        return new Response(pngBytes, {
          headers: { "content-type": "image/png" },
          status: 200
        });
      }

      throw new Error(`Unexpected URL: ${urlString}`);
    };
    const provider = createReplicateImageGenerationProvider({
      apiToken: "r8_test",
      baseUrl: "https://example.test",
      fetchImpl,
      model: "stability-ai/sdxl",
      pollIntervalMs: 250,
      pollTimeoutMs: 5000
    });
    const result = await provider.generate({ prompt: "stone tile" });

    expect(Buffer.compare(result.data, pngBytes)).toBe(0);
    expect(result.seed).toBe(42);
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it("throws when the prediction reports failure", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({ error: "model exploded", id: "p", status: "failed" }),
        { status: 200 }
      );
    const provider = createReplicateImageGenerationProvider({
      apiToken: "x",
      fetchImpl,
      model: "demo/model",
      pollIntervalMs: 100
    });

    await expect(provider.generate({ prompt: "x" })).rejects.toThrow(/model exploded/u);
  });
});

describe("importGeneratedAssetToLibrary", () => {
  it("writes the generated image into the asset library and returns metadata", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "dm-genassets-"));
    const provider = createCustomImageGenerationProvider({
      id: "custom:test",
      async generate() {
        return {
          contentType: "image/png",
          data: Buffer.from([9, 9, 9, 9]),
          seed: 7
        };
      }
    });
    const result = await provider.generate({ prompt: "ornate door" });
    const metadata = await importGeneratedAssetToLibrary(provider, {
      classification: "door",
      fileNameHint: "ornate-door",
      outputDirectory: path.join("library", "generated"),
      outputRoot: tempRoot,
      request: { prompt: "ornate door", styleTags: ["wood", "iron"] },
      result
    });

    expect(metadata.provider).toBe("custom:test");
    expect(metadata.relativePath).toBe(`library/generated/${metadata.filename}`);
    expect(metadata.classification).toBe("door");
    expect(metadata.styleTags).toEqual(["wood", "iron"]);

    const onDisk = await readFile(metadata.path);
    expect(Buffer.compare(onDisk, result.data)).toBe(0);
  });
});

describe("resolveImageGenerationConfigFromEnv", () => {
  it("returns null when no provider is configured", () => {
    expect(resolveImageGenerationConfigFromEnv({})).toBeNull();
  });

  it("parses replicate config", () => {
    expect(
      resolveImageGenerationConfigFromEnv({
        IMAGE_GEN_API_KEY: "r8_test",
        IMAGE_GEN_MODEL: "stability-ai/sdxl",
        IMAGE_GEN_PROVIDER: "replicate",
        IMAGE_GEN_VERSION: "abc123"
      })
    ).toEqual({
      apiToken: "r8_test",
      baseUrl: undefined,
      model: "stability-ai/sdxl",
      provider: "replicate",
      version: "abc123"
    });
  });

  it("creates a working provider for automatic1111", () => {
    const provider = createImageGenerationProviderFromEnv({
      IMAGE_GEN_BASE_URL: "http://localhost:1234",
      IMAGE_GEN_PROVIDER: "automatic1111"
    });

    expect(provider?.vendor).toBe("automatic1111");
  });
});
