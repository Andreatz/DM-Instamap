import { describe, expect, it } from "vitest";
import { MapDocumentSchema, MapPlanSchema, createMapDocument, type MapPlan } from "@dm-instamap/core";
import { applyVisibilityMode, listVisibilityModes } from "../src";
import { exportDmImap } from "../src/dmimap";

const plan: MapPlan = MapPlanSchema.parse({
  assetPlacements: [
    {
      assetId: "asset-furniture",
      id: "place-public",
      layer: "object",
      locked: false,
      position: { x: 3, y: 3 },
      rotation: 0,
      scale: 1,
      tags: ["furniture"]
    },
    {
      assetId: "asset-trap",
      id: "place-secret",
      layer: "object",
      locked: false,
      position: { x: 14, y: 14 },
      rotation: 0,
      scale: 1,
      tags: ["secret"]
    },
    {
      assetId: "asset-gm-note",
      id: "place-annotation",
      layer: "annotation",
      locked: false,
      position: { x: 4, y: 4 },
      rotation: 0,
      scale: 1,
      tags: ["gm-only"]
    }
  ],
  doors: [
    {
      id: "door-public",
      isLocked: false,
      isOpen: false,
      position: { x: 5, y: 5 },
      rotation: 0,
      roomIds: ["room-main"],
      width: 1
    },
    {
      id: "door-secret",
      isLocked: false,
      isOpen: false,
      position: { x: 15, y: 15 },
      rotation: 0,
      roomIds: ["room-secret"],
      width: 1
    }
  ],
  id: "plan-test",
  lights: [
    {
      color: "#ffcc88",
      id: "light-public",
      intensity: 0.6,
      kind: "torch",
      position: { x: 4, y: 4 },
      radius: 3
    },
    {
      color: "#000000",
      id: "light-secret-room",
      intensity: 0.5,
      kind: "ambient",
      position: { x: 15, y: 15 },
      radius: 1
    }
  ],
  name: "Test Plan",
  notes: ["Player-safe overview", "GM secret about trap"],
  requestId: "req-test",
  rooms: [
    {
      bounds: { height: 6, width: 8, x: 2, y: 3 },
      connections: ["room-secret"],
      id: "room-main",
      kind: "room",
      label: "Main Hall",
      tags: ["library"]
    },
    {
      bounds: { height: 4, width: 4, x: 13, y: 13 },
      connections: ["room-main"],
      id: "room-secret",
      kind: "secret",
      label: "Hidden Chamber",
      tags: ["secret", "trap"]
    }
  ],
  walls: [
    {
      blocksMovement: true,
      end: { x: 10, y: 3 },
      id: "wall-main",
      material: "stone",
      roomIds: ["room-main"],
      start: { x: 2, y: 3 },
      thickness: 1
    },
    {
      blocksMovement: true,
      end: { x: 17, y: 13 },
      id: "wall-secret",
      material: "stone",
      roomIds: ["room-secret"],
      start: { x: 13, y: 13 },
      thickness: 1
    }
  ]
});

function createSampleDocument() {
  const base = createMapDocument({
    height: 24,
    id: "test-doc",
    name: "Test Doc",
    plan,
    width: 24
  });

  return MapDocumentSchema.parse({
    ...base,
    assets: plan.assetPlacements,
    tiles: createTiles(24, 24)
  });
}

function createTiles(width: number, height: number) {
  const tiles = [] as Array<{ id: string; kind: "floor" | "wall" | "door" | "empty"; x: number; y: number }>;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inMain = x >= 2 && x < 10 && y >= 3 && y < 9;
      const inSecret = x >= 13 && x < 17 && y >= 13 && y < 17;
      tiles.push({
        id: `tile-${x}-${y}`,
        kind: inMain || inSecret ? "floor" : "empty",
        x,
        y
      });
    }
  }

  return tiles;
}

describe("listVisibilityModes", () => {
  it("returns player/gm/clean", () => {
    expect(listVisibilityModes()).toEqual(["player", "gm", "clean"]);
  });
});

describe("applyVisibilityMode", () => {
  it("keeps everything in gm mode", () => {
    const document = createSampleDocument();
    const filtered = applyVisibilityMode(document, "gm");
    expect(filtered.plan?.rooms).toHaveLength(2);
    expect(filtered.plan?.assetPlacements).toHaveLength(3);
    expect(filtered.assets).toHaveLength(3);
  });

  it("removes secret rooms, secret doors, secret-tagged assets and annotation layer in player mode", () => {
    const document = createSampleDocument();
    const filtered = applyVisibilityMode(document, "player");

    expect(filtered.plan?.rooms.map((room) => room.id)).toEqual(["room-main"]);
    expect(filtered.plan?.doors.map((door) => door.id)).toEqual(["door-public"]);
    expect(filtered.plan?.walls.map((wall) => wall.id)).toEqual(["wall-main"]);
    expect(filtered.plan?.assetPlacements.map((asset) => asset.id)).toEqual(["place-public"]);
    expect(filtered.assets.map((asset) => asset.id)).toEqual(["place-public"]);
    expect(filtered.plan?.notes).toEqual(["Player-safe overview"]);
  });

  it("clears plan notes in clean mode", () => {
    const document = createSampleDocument();
    const filtered = applyVisibilityMode(document, "clean");
    expect(filtered.plan?.notes).toEqual([]);
  });

  it("converts hidden room floor tiles to empty for player exports", () => {
    const document = createSampleDocument();
    const filtered = applyVisibilityMode(document, "player");
    const hidden = filtered.tiles.find((tile) => tile.x === 14 && tile.y === 14);
    expect(hidden?.kind).toBe("empty");
  });
});

describe("exportDmImap", () => {
  it("produces a JSON dmimap payload including format and version", () => {
    const result = exportDmImap(createSampleDocument(), { mode: "gm" });
    const parsed = JSON.parse(result.json) as { document: { id: string }; format: string; mode: string; version: number };

    expect(result.contentType).toBe("application/json");
    expect(parsed.format).toBe("dmimap");
    expect(parsed.version).toBe(1);
    expect(parsed.mode).toBe("gm");
    expect(parsed.document.id).toBe("test-doc");
  });

  it("applies visibility filtering to dmimap exports", () => {
    const result = exportDmImap(createSampleDocument(), { mode: "player" });
    const parsed = JSON.parse(result.json) as { document: { plan?: { rooms: Array<{ id: string }> } } };

    expect(parsed.document.plan?.rooms.map((room) => room.id)).toEqual(["room-main"]);
  });
});
