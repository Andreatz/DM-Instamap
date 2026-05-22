import type { MapDocument } from "@dm-instamap/core";
import { computeDocumentContentHash } from "@dm-instamap/core/server";
import { describe, expect, it } from "vitest";
import {
  applyStyleDna,
  deriveFurnishingDensity,
  describeStyleDna,
  generateDungeon
} from "../src";

function floorArea(document: MapDocument): number {
  return document.tiles.filter((tile) => tile.kind === "floor").length;
}

describe("style dna influence", () => {
  it("maps the density bias onto a furnishing density", () => {
    expect(deriveFurnishingDensity({ densityBias: "sparse" })).toBe("sparse");
    expect(deriveFurnishingDensity({ densityBias: "rich" })).toBe("rich");
    expect(deriveFurnishingDensity({ densityBias: "normal" })).toBe("normal");
    expect(deriveFurnishingDensity(undefined)).toBe("normal");
  });

  it("merges palette tags into every room and records the intent", () => {
    const map = generateDungeon({
      heightCells: 24,
      roomCount: 4,
      theme: "crypt",
      widthCells: 30
    });
    const styled = applyStyleDna(map, {
      densityBias: "rich",
      layoutBias: "compact",
      paletteTags: ["Stone", "Candlelight"]
    });

    expect(
      styled.plan?.rooms.every(
        (room) =>
          room.tags.includes("stone") && room.tags.includes("candlelight")
      )
    ).toBe(true);
    expect(styled.plan?.notes.some((note) => note.includes("Style DNA"))).toBe(
      true
    );
  });

  it("is a no-op without a style dna", () => {
    const map = generateDungeon({
      heightCells: 24,
      roomCount: 4,
      theme: "crypt",
      widthCells: 30
    });
    expect(applyStyleDna(map, undefined)).toBe(map);
  });

  it("modulates room geometry by layout bias with controlled divergence", () => {
    const input = {
      heightCells: 30,
      roomCount: 6,
      theme: "test",
      widthCells: 44
    };
    const compact = generateDungeon({
      ...input,
      styleDna: { layoutBias: "compact" }
    });
    const balanced = generateDungeon(input);
    const sprawling = generateDungeon({
      ...input,
      styleDna: { layoutBias: "sprawling" }
    });

    // Coherent geometry: compact rooms are smaller, sprawling larger.
    expect(floorArea(compact)).toBeLessThan(floorArea(balanced));
    expect(floorArea(balanced)).toBeLessThan(floorArea(sprawling));

    // Controlled divergence: the DNA layout changes the map vs the baseline.
    expect(computeDocumentContentHash(compact)).not.toBe(
      computeDocumentContentHash(balanced)
    );

    // Deterministic: same input + DNA reproduces the same layout.
    const compactAgain = generateDungeon({
      ...input,
      styleDna: { layoutBias: "compact" }
    });
    expect(computeDocumentContentHash(compactAgain)).toBe(
      computeDocumentContentHash(compact)
    );
  });

  it("describes the style dna deterministically", () => {
    expect(
      describeStyleDna({
        densityBias: "sparse",
        layoutBias: "sprawling",
        paletteTags: ["moss"]
      })
    ).toBe("Style DNA - densita: sparse, layout: sprawling, palette: moss.");
  });
});
