import { describe, expect, it } from "vitest";
import { normalizeReferenceMaps } from "./references";

describe("normalizeReferenceMaps", () => {
  it("normalizes reference manifest entries for display", () => {
    const styleDnaByReferenceId = new Map([
      [
        "reference-a",
        {
          confidence: 0.82,
          density: "medium",
          grid: {
            confidence: 0.55,
            detected: true,
            estimatedCellSizePx: 70
          },
          id: "style-a",
          layoutTraits: ["corridor-heavy"],
          mood: ["dark"],
          palette: [{ hex: "#202020", population: 20, role: "background" }],
          promptSummary: "Dark dungeon battlemap style.",
          recommendedAssetTags: ["stone", "torch"],
          referenceId: "reference-a",
          visualTags: ["dark", "dungeon"]
        }
      ]
    ]);
    const references = normalizeReferenceMaps(
      [
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
      ],
      styleDnaByReferenceId
    );

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
        styleDna: {
          confidence: 0.82,
          density: "medium",
          grid: {
            confidence: 0.55,
            detected: true,
            estimatedCellSizePx: 70
          },
          id: "style-a",
          layoutTraits: ["corridor-heavy"],
          mood: ["dark"],
          palette: [{ hex: "#202020", population: 20, role: "background" }],
          promptSummary: "Dark dungeon battlemap style.",
          recommendedAssetTags: ["stone", "torch"],
          referenceId: "reference-a",
          visualTags: ["dark", "dungeon"]
        },
        tags: ["dungeon", "old"],
        thumbnailPath: "data/previews/references/reference-a.webp",
        width: 1200
      }
    ]);
  });
});
