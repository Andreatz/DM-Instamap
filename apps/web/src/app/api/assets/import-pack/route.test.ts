import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@dm-instamap/assets/pack-importer", () => ({
  importAssetPack: vi.fn(),
  PACK_PRESETS: ["generic", "forgotten-adventures"]
}));

import { importAssetPack } from "@dm-instamap/assets/pack-importer";
import { POST } from "./route";

const importAssetPackMock = importAssetPack as unknown as ReturnType<
  typeof vi.fn
>;

describe("POST /api/assets/import-pack", () => {
  beforeEach(() => {
    importAssetPackMock.mockReset();
  });

  function jsonRequest(body: unknown): Request {
    return new Request("http://test/api/assets/import-pack", {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
  }

  it("returns 400 when assetRoot is missing", async () => {
    const response = await POST(jsonRequest({ preset: "generic" }));

    expect(response.status).toBe(400);
    expect(importAssetPackMock).not.toHaveBeenCalled();
  });

  it("rejects path traversal before importing", async () => {
    const response = await POST(
      jsonRequest({ assetRoot: "../outside-pack", preset: "generic" })
    );

    expect(response.status).toBe(400);
    expect(importAssetPackMock).not.toHaveBeenCalled();
  });

  it("imports a validated local folder", async () => {
    importAssetPackMock.mockResolvedValue({
      added: [{ id: "asset_1" }],
      manifest: {
        errors: [],
        sourceRoot: "local-assets"
      },
      preset: "generic",
      presetTagsApplied: 0,
      reclassifiedCount: 0
    });

    const response = await POST(
      jsonRequest({
        assetRoot: ".",
        defaultTags: ["demo", 42],
        preset: "generic"
      })
    );

    expect(response.status).toBe(200);
    expect(importAssetPackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        assetRoot: expect.any(String),
        defaultTags: ["demo"],
        preset: "generic"
      })
    );
  });
});
