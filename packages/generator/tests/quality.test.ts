import { createMapDocument, type MapTile } from "@dm-instamap/core";
import { describe, expect, it } from "vitest";
import {
  generateCaveDungeon,
  generateDungeon,
  generateOutdoorMap,
  generateVillageMap,
  scoreMapQuality
} from "../src";

describe("scoreMapQuality", () => {
  it("scores the procedural dungeon as usable or better", () => {
    const map = generateDungeon({
      heightCells: 36,
      requiredRooms: ["boss", "library"],
      roomCount: 8,
      theme: "crypt",
      widthCells: 52
    });
    const quality = scoreMapQuality(map);

    expect(quality.score).toBeGreaterThanOrEqual(60);
    expect(quality.rating).not.toBe("poor");
    expect(quality.metrics.connectivity.score).toBe(100);
  });

  it("keeps alternate generators above the usable threshold for deterministic samples", () => {
    const maps = [
      generateCaveDungeon({ heightCells: 30, seed: "quality-cave", theme: "underdark", widthCells: 42 }),
      generateVillageMap({ blockCount: 7, heightCells: 34, seed: "quality-village", theme: "frontier", widthCells: 46 }),
      generateOutdoorMap({ heightCells: 34, river: true, seed: "quality-outdoor", theme: "forest", treeDensity: 0.16, widthCells: 46 })
    ];

    const reports = maps.map((map) => scoreMapQuality(map));

    expect(reports.filter((report) => report.score >= 60)).toHaveLength(3);
  });

  it("warns about disconnected walkable regions", () => {
    const map = createMapDocument({
      height: 5,
      id: "disconnected",
      name: "Disconnected",
      tiles: createTiles(5, 5, new Set(["1,1", "1,2", "3,3"])),
      width: 5
    });
    const quality = scoreMapQuality(map);

    expect(quality.metrics.connectivity.score).toBeLessThan(100);
    expect(quality.debugTiles.some((tile) => tile.kind === "disconnected")).toBe(true);
    expect(quality.warnings).toContain("Alcune aree camminabili non sono collegate alla regione principale.");
  });

  it("reports dead ends for thin one-way corridors", () => {
    const map = createMapDocument({
      height: 5,
      id: "dead-ends",
      name: "Dead Ends",
      tiles: createTiles(5, 5, new Set(["1,2", "2,2", "3,2"])),
      width: 5
    });
    const quality = scoreMapQuality(map);

    expect(quality.metrics.deadEnds.score).toBeLessThan(100);
    expect(quality.debugTiles.some((tile) => tile.kind === "dead-end")).toBe(true);
  });
});

function createTiles(width: number, height: number, floors: Set<string>): MapTile[] {
  const tiles: MapTile[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push({
        id: `tile-${x}-${y}`,
        kind: floors.has(`${x},${y}`) ? "floor" : "wall",
        x,
        y
      });
    }
  }

  return tiles;
}
