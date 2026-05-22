import { describe, expect, it } from "vitest";
import { generateDungeon, scoreMapQuality } from "@dm-instamap/generator";
import { parseRequiredRooms } from "./generator-form";

describe("parseRequiredRooms", () => {
  it("normalizes comma-separated required room names", () => {
    expect(parseRequiredRooms("boss, library, boss, ")).toEqual([
      "boss",
      "library"
    ]);
  });
});

describe("generator preview quality contract", () => {
  it("can compute quality metrics used by the preview debug panel", () => {
    const map = generateDungeon({
      heightCells: 36,
      requiredRooms: parseRequiredRooms("boss, library"),
      roomCount: 8,
      theme: "crypt",
      widthCells: 52
    });
    const quality = scoreMapQuality(map);

    expect(quality.score).toBeGreaterThanOrEqual(60);
    expect(quality.summary).toContain("/100");
    expect(quality.metrics.connectivity.label).toBe("Connettivita");
    expect(quality.debugTiles.length).toBeGreaterThan(0);
  });
});
