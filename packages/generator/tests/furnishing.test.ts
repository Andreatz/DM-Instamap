import { describe, expect, it } from "vitest";
import { autoFurnishMap, generateDungeon, inferFurnishingRoomType, type FurnishingAsset } from "../src";

const selectedAssets: FurnishingAsset[] = [
  {
    assetId: "asset-sarcophagus",
    heightCells: 2,
    kind: "furniture",
    qualityScore: 95,
    tags: ["crypt", "sarcophagus"],
    usableFor: ["crypt", "boss_room"],
    widthCells: 2
  },
  {
    assetId: "asset-bookshelf",
    heightCells: 1,
    kind: "furniture",
    qualityScore: 80,
    tags: ["library", "bookshelf"],
    usableFor: ["library"],
    widthCells: 2
  },
  {
    assetId: "asset-crate",
    heightCells: 1,
    kind: "prop",
    qualityScore: 70,
    tags: ["storage", "crate"],
    usableFor: ["storage"],
    widthCells: 1
  },
  {
    assetId: "asset-torch",
    heightCells: 1,
    kind: "light",
    qualityScore: 60,
    tags: ["torch"],
    usableFor: ["entrance", "corridor", "crypt"],
    widthCells: 1
  }
];

describe("autoFurnishMap", () => {
  it("places selected assets inside room boundaries", () => {
    const map = generateDungeon({
      heightCells: 36,
      requiredRooms: ["library", "boss"],
      roomCount: 7,
      theme: "crypt",
      widthCells: 52
    });

    const result = autoFurnishMap(map, {
      assets: selectedAssets,
      density: "normal"
    });

    expect(result.placed.length).toBeGreaterThan(0);

    for (const placedAsset of result.document.assets) {
      const room = result.document.plan?.rooms.find((candidate) => placedAsset.tags.includes(candidate.id));

      expect(room, placedAsset.id).toBeDefined();
      expect(placedAsset.position.x).toBeGreaterThanOrEqual(room!.bounds.x);
      expect(placedAsset.position.y).toBeGreaterThanOrEqual(room!.bounds.y);
      expect(placedAsset.position.x).toBeLessThan(room!.bounds.x + room!.bounds.width);
      expect(placedAsset.position.y).toBeLessThan(room!.bounds.y + room!.bounds.height);
    }
  });

  it("avoids major collisions by respecting asset footprints", () => {
    const map = generateDungeon({
      heightCells: 40,
      requiredRooms: ["library", "storage", "boss"],
      roomCount: 8,
      theme: "crypt",
      widthCells: 56
    });

    const result = autoFurnishMap(map, {
      assets: selectedAssets,
      density: "rich"
    });
    const occupied = new Set<string>();

    for (const placement of result.placed) {
      const placedAsset = result.document.assets.find((asset) => asset.assetId === placement.assetId && asset.tags.includes(placement.roomId));

      expect(placedAsset).toBeDefined();

      for (let y = placedAsset!.position.y; y < placedAsset!.position.y + placement.footprint.height; y += 1) {
        for (let x = placedAsset!.position.x; x < placedAsset!.position.x + placement.footprint.width; x += 1) {
          const key = `${x},${y}`;

          expect(occupied.has(key), `${placement.assetId} overlaps at ${key}`).toBe(false);
          occupied.add(key);
        }
      }
    }
  });

  it("places large props before small props", () => {
    const map = generateDungeon({
      heightCells: 30,
      requiredRooms: ["boss"],
      roomCount: 4,
      theme: "crypt",
      widthCells: 42
    });

    const result = autoFurnishMap(map, {
      assets: selectedAssets,
      density: "normal"
    });

    expect(result.placed[0]?.assetId).toBe("asset-sarcophagus");
  });
});

describe("inferFurnishingRoomType", () => {
  it("supports named room types from labels and tags", () => {
    expect(
      inferFurnishingRoomType({
        bounds: { height: 5, width: 5, x: 0, y: 0 },
        connections: [],
        id: "room-prison",
        kind: "room",
        label: "Prison Cells",
        tags: ["chains"]
      })
    ).toBe("prison");

    expect(
      inferFurnishingRoomType({
        bounds: { height: 5, width: 5, x: 0, y: 0 },
        connections: [],
        id: "room-final",
        kind: "room",
        label: "Final Room",
        tags: ["boss"]
      })
    ).toBe("boss_room");
  });
});
