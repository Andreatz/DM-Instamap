import { describe, expect, it } from "vitest";
import { normalizeReferenceMaps } from "./references";

describe("normalizeReferenceMaps", () => {
  it("normalizes reference manifest entries for display", () => {
    const references = normalizeReferenceMaps([
      {
        dominantColors: [{ hex: "#406080", population: 10 }],
        extension: "png",
        height: 800,
        id: "reference-a",
        mapType: "dungeon",
        mapTypeConfidence: 0.75,
        path: "Maps/old-dungeon.png",
        tags: ["dungeon", "old"],
        thumbnailPath: "data/previews/references/reference-a.webp",
        width: 1200
      }
    ]);

    expect(references).toEqual([
      {
        dominantColors: [{ hex: "#406080", population: 10 }],
        extension: "png",
        height: 800,
        id: "reference-a",
        mapType: "dungeon",
        mapTypeConfidence: 0.75,
        path: "Maps/old-dungeon.png",
        previewUrl: "/references/preview/reference-a",
        tags: ["dungeon", "old"],
        thumbnailPath: "data/previews/references/reference-a.webp",
        width: 1200
      }
    ]);
  });
});
