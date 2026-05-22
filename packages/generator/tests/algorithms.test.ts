import { describe, expect, it } from "vitest";
import {
  generateCaveDungeon,
  generateMultiFloorDungeon,
  generateOutdoorMap,
  generateVillageMap
} from "../src";

describe("generateCaveDungeon", () => {
  it("creates an organic cave with floor and wall tiles", () => {
    const map = generateCaveDungeon({
      heightCells: 24,
      seed: "cave-1",
      theme: "underdark",
      widthCells: 32
    });

    const floors = map.tiles.filter((tile) => tile.kind === "floor");
    const walls = map.tiles.filter((tile) => tile.kind === "wall");

    expect(map.editable).toBe(true);
    expect(floors.length).toBeGreaterThan(20);
    expect(walls.length).toBeGreaterThan(20);
    expect(
      map.plan?.rooms.find((room) => room.id === "room-cave-main")
    ).toBeDefined();
  });

  it("is deterministic for the same seed", () => {
    const first = generateCaveDungeon({
      heightCells: 24,
      seed: "deterministic",
      widthCells: 32
    });
    const second = generateCaveDungeon({
      heightCells: 24,
      seed: "deterministic",
      widthCells: 32
    });

    expect(first.tiles.map((tile) => tile.kind)).toEqual(
      second.tiles.map((tile) => tile.kind)
    );
  });
});

describe("generateVillageMap", () => {
  it("creates multiple building rooms with doors", () => {
    const map = generateVillageMap({
      blockCount: 6,
      heightCells: 30,
      seed: "village-1",
      theme: "lumberton",
      widthCells: 40
    });

    const buildings = (map.plan?.rooms ?? []).filter(
      (room) => room.kind === "room"
    );

    expect(buildings.length).toBeGreaterThanOrEqual(2);
    expect(map.plan?.doors.length).toBeGreaterThan(0);
    expect(map.tiles.some((tile) => tile.kind === "door")).toBe(true);
    expect(
      (map.plan?.rooms ?? []).some((room) => room.kind === "entrance")
    ).toBe(true);
  });
});

describe("generateMultiFloorDungeon", () => {
  it("creates floors with stairs links between them", () => {
    const multi = generateMultiFloorDungeon({
      floorCount: 3,
      heightCells: 28,
      perFloorRoomCount: 5,
      seed: "tower-keep",
      theme: "keep",
      widthCells: 36
    });

    expect(multi.floors).toHaveLength(3);
    expect(multi.links).toHaveLength(2);
    expect(multi.links[0]?.fromFloor).toBe(0);
    expect(multi.links[0]?.toFloor).toBe(1);

    for (const floor of multi.floors) {
      expect(floor.editable).toBe(true);
      expect(floor.plan?.rooms.some((room) => room.kind === "room")).toBe(true);
    }

    expect(
      multi.floors[0]?.plan?.rooms.some(
        (room) => room.kind === "stairs" && room.tags.includes("down")
      )
    ).toBe(true);
    expect(
      multi.floors[1]?.plan?.rooms.some(
        (room) => room.kind === "stairs" && room.tags.includes("up")
      )
    ).toBe(true);
  });
});

describe("generateOutdoorMap", () => {
  it("creates an outdoor map with trees and an optional river", () => {
    const map = generateOutdoorMap({
      heightCells: 24,
      river: true,
      seed: "forest-river",
      theme: "deepwood",
      treeDensity: 0.18,
      widthCells: 32
    });

    expect(map.editable).toBe(true);
    expect(map.tiles.some((tile) => tile.kind === "wall")).toBe(true);
    expect(
      map.plan?.rooms.find((room) => room.id === "clearing-main")?.tags
    ).toEqual(expect.arrayContaining(["outdoor", "river"]));
    expect((map.plan?.doors ?? []).length).toBeGreaterThan(0);
  });
});
