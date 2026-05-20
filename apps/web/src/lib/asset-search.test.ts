import path from "node:path";
import { describe, expect, it } from "vitest";
import { enrichAssetSearchResults, normalizeSearchLimit, resolveWorkspaceFilePath } from "./asset-search";
import type { AssetBrowserEntry } from "./asset-browser";

const assets: AssetBrowserEntry[] = [
  {
    classification: "floor",
    classificationSource: "automatic",
    confidence: 0.9,
    dominantColors: [],
    extension: "png",
    fileHash: "hash",
    hasTransparency: false,
    height: 128,
    id: "asset-floor",
    relativePath: "floors/stone.png",
    sourceFolder: "floors",
    tags: ["stone"],
    thumbnailUrl: "/assets/preview/asset-floor",
    width: 128
  }
];

describe("asset search helpers", () => {
  it("normalizes search limits", () => {
    expect(normalizeSearchLimit("5")).toBe(5);
    expect(normalizeSearchLimit("500")).toBe(100);
    expect(normalizeSearchLimit("bad", 12)).toBe(12);
  });

  it("enriches package search results for the API", () => {
    expect(
      enrichAssetSearchResults(
        [
          {
            assetId: "asset-floor",
            reason: "matched stone",
            relativePath: "floors/stone.png",
            score: 0.9,
            tags: ["stone"]
          }
        ],
        assets
      )
    ).toEqual([
      {
        assetId: "asset-floor",
        classification: "floor",
        reason: "matched stone",
        relativePath: "floors/stone.png",
        score: 0.9,
        tags: ["stone"],
        thumbnailUrl: "/assets/preview/asset-floor"
      }
    ]);
  });

  it("prevents image search path traversal", () => {
    const root = path.resolve("workspace");

    expect(resolveWorkspaceFilePath(root, "data/previews/example.webp")).toBe(
      path.resolve(root, "data/previews/example.webp")
    );
    expect(() => resolveWorkspaceFilePath(root, "../secret.png")).toThrow("workspace");
  });
});
