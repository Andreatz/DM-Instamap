import { describe, expect, it } from "vitest";
import {
  autoFurnishMap,
  generateCryptBlueprint,
  generateDungeon,
  generateMapFromBlueprint,
  inferFurnishingRoomType,
  type FurnishingAsset
} from "../src";

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
  },
  {
    assetId: "asset-prison-bars",
    heightCells: 1,
    kind: "prop",
    qualityScore: 88,
    tags: ["prison", "bars", "chains"],
    usableFor: ["prison"],
    widthCells: 2
  },
  {
    assetId: "asset-altar",
    heightCells: 2,
    kind: "furniture",
    qualityScore: 92,
    tags: ["chapel", "altar", "holy"],
    usableFor: ["chapel"],
    widthCells: 2
  },
  {
    assetId: "asset-throne",
    heightCells: 2,
    kind: "furniture",
    qualityScore: 90,
    tags: ["boss", "throne"],
    usableFor: ["boss_room"],
    widthCells: 2
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
      const room = result.document.plan?.rooms.find((candidate) =>
        placedAsset.tags.includes(candidate.id)
      );

      expect(room, placedAsset.id).toBeDefined();
      expect(placedAsset.position.x).toBeGreaterThanOrEqual(room!.bounds.x);
      expect(placedAsset.position.y).toBeGreaterThanOrEqual(room!.bounds.y);
      expect(placedAsset.position.x).toBeLessThan(
        room!.bounds.x + room!.bounds.width
      );
      expect(placedAsset.position.y).toBeLessThan(
        room!.bounds.y + room!.bounds.height
      );
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
      const placedAsset = result.document.assets.find(
        (asset) =>
          asset.assetId === placement.assetId &&
          asset.tags.includes(placement.roomId)
      );

      expect(placedAsset).toBeDefined();

      for (
        let y = placedAsset!.position.y;
        y < placedAsset!.position.y + placement.footprint.height;
        y += 1
      ) {
        for (
          let x = placedAsset!.position.x;
          x < placedAsset!.position.x + placement.footprint.width;
          x += 1
        ) {
          const key = `${x},${y}`;

          expect(
            occupied.has(key),
            `${placement.assetId} overlaps at ${key}`
          ).toBe(false);
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

  it("uses room type rules for crypt, library, prison, chapel, and boss rooms", () => {
    const map = generateDungeon({
      heightCells: 48,
      requiredRooms: ["library", "prison", "chapel", "boss", "storage"],
      roomCount: 9,
      theme: "crypt",
      widthCells: 64
    });

    const result = autoFurnishMap(map, {
      assets: selectedAssets,
      density: "rich"
    });

    expect(result.summary.placedCount).toBe(result.placed.length);
    expect(result.placed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: "asset-sarcophagus",
          roomType: "crypt"
        }),
        expect.objectContaining({
          assetId: "asset-bookshelf",
          roomType: "library"
        }),
        expect.objectContaining({
          assetId: "asset-prison-bars",
          roomType: "prison"
        }),
        expect.objectContaining({ assetId: "asset-altar", roomType: "chapel" }),
        expect.objectContaining({
          assetId: "asset-throne",
          roomType: "boss_room"
        })
      ])
    );
    expect(
      result.placed.find((placement) => placement.assetId === "asset-bookshelf")
        ?.placement
    ).toBe("wall");
    expect(
      result.placed.find((placement) => placement.assetId === "asset-altar")
        ?.placement
    ).toBe("center");
  });

  it("uses narrative room suggestions and asset groups when available", () => {
    const blueprint = generateCryptBlueprint({
      request: "Crypt under cathedral, non-hostile undead prisoners"
    });
    const map = generateMapFromBlueprint(blueprint, {
      heightCells: 44,
      widthCells: 64
    });

    const result = autoFurnishMap(map, {
      assetGroups: [
        {
          assetIds: ["group-ritual-circle-asset"],
          kind: "decoration",
          qualityScore: 95,
          tags: ["ritual", "circle", "crypt"],
          usableFor: ["boss_room"]
        }
      ],
      assets: selectedAssets,
      density: "normal",
      narrativeRooms: blueprint.rooms,
      styleTags: blueprint.globalTags
    });

    expect(result.placed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: "group-ritual-circle-asset",
          roomType: "boss_room"
        })
      ])
    );
    expect(
      result.placed.find(
        (placement) =>
          placement.assetId === "group-ritual-circle-asset" &&
          placement.roomType === "boss_room"
      )?.reasons
    ).toContain("usableFor:boss_room");
  });
});

describe("inferFurnishingRoomType (C3 extensions)", () => {
  it("detects cave rooms from labels and tags", () => {
    expect(
      inferFurnishingRoomType({
        bounds: { height: 5, width: 5, x: 0, y: 0 },
        connections: [],
        id: "room-cave-main",
        kind: "room",
        label: "Cave Chamber",
        tags: ["cave", "organic"]
      })
    ).toBe("cave");
  });

  it("detects clearings from service rooms", () => {
    expect(
      inferFurnishingRoomType({
        bounds: { height: 8, width: 8, x: 0, y: 0 },
        connections: [],
        id: "clearing-main",
        kind: "service",
        label: "Forest Clearing",
        tags: ["outdoor", "clearing"]
      })
    ).toBe("clearing");
  });

  it("detects tavern and smithy from labels", () => {
    expect(
      inferFurnishingRoomType({
        bounds: { height: 5, width: 5, x: 0, y: 0 },
        connections: [],
        id: "tavern",
        kind: "room",
        label: "Tavern",
        tags: ["interior"]
      })
    ).toBe("tavern");

    expect(
      inferFurnishingRoomType({
        bounds: { height: 5, width: 5, x: 0, y: 0 },
        connections: [],
        id: "smithy",
        kind: "room",
        label: "Smithy",
        tags: ["interior"]
      })
    ).toBe("smithy");
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
