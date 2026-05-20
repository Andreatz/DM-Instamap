import { describe, expect, it } from "vitest";
import { MapPlanSchema, createMapDocument } from "@dm-instamap/core";
import { convertPlanToMapDocument, inferDimensionsFromPlan } from "./ai-bridge-import";

const samplePlan = MapPlanSchema.parse({
  assetPlacements: [
    {
      assetId: "group-altar",
      id: "place-altar",
      layer: "object",
      locked: false,
      position: { x: 6, y: 6 },
      rotation: 0,
      scale: 1,
      tags: []
    }
  ],
  doors: [
    {
      id: "door-1",
      isLocked: false,
      isOpen: false,
      position: { x: 4, y: 6 },
      rotation: 0,
      roomIds: ["room-entry"],
      width: 1
    }
  ],
  id: "plan-1",
  lights: [],
  name: "Sample Plan",
  notes: [],
  requestId: "request-1",
  rooms: [
    {
      bounds: { height: 6, width: 8, x: 2, y: 3 },
      connections: [],
      id: "room-entry",
      kind: "entrance",
      label: "Entry",
      tags: []
    }
  ],
  walls: []
});

describe("inferDimensionsFromPlan", () => {
  it("returns min 12x12 even for tiny plans", () => {
    const dimensions = inferDimensionsFromPlan(samplePlan);
    expect(dimensions.width).toBeGreaterThanOrEqual(12);
    expect(dimensions.height).toBeGreaterThanOrEqual(12);
  });

  it("scales to cover room bounds", () => {
    const wide = MapPlanSchema.parse({
      ...samplePlan,
      rooms: [
        {
          bounds: { height: 40, width: 60, x: 5, y: 5 },
          connections: [],
          id: "big-room",
          kind: "room",
          label: "Big",
          tags: []
        }
      ]
    });
    const dimensions = inferDimensionsFromPlan(wide);
    expect(dimensions.width).toBeGreaterThanOrEqual(65);
    expect(dimensions.height).toBeGreaterThanOrEqual(45);
  });
});

describe("convertPlanToMapDocument", () => {
  it("creates a MapDocument with floor tiles for the room area and walls around it", () => {
    const result = convertPlanToMapDocument({
      documentId: "imported-plan",
      mode: "new-project",
      plan: samplePlan
    });

    const floorTiles = result.document.tiles.filter((tile) => tile.kind === "floor");
    const wallTiles = result.document.tiles.filter((tile) => tile.kind === "wall");
    const doorTiles = result.document.tiles.filter((tile) => tile.kind === "door");

    expect(floorTiles.length).toBeGreaterThan(0);
    expect(wallTiles.length).toBeGreaterThan(0);
    expect(doorTiles.length).toBeGreaterThanOrEqual(1);
    expect(result.document.assets).toHaveLength(1);
    expect(result.document.plan?.rooms).toHaveLength(1);
  });

  it("preserves source dimensions when updating an existing project", () => {
    const source = createMapDocument({ height: 20, id: "source", name: "Source", width: 20 });
    const result = convertPlanToMapDocument({
      documentId: "source",
      mode: "update-project",
      plan: samplePlan,
      source
    });

    expect(result.document.width).toBe(20);
    expect(result.document.height).toBe(20);
    expect(result.document.id).toBe("source");
  });
});
