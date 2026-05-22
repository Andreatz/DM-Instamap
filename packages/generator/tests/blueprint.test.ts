import { describe, expect, it } from "vitest";
import {
  createNarrativeBlueprint,
  generateCryptBlueprint,
  generateMapFromBlueprint,
  type MapGenerationBlueprint
} from "../src";

describe("narrative blueprints", () => {
  it("creates a crypt under a cathedral with non-hostile imprisoned dead", () => {
    const blueprint = createNarrativeBlueprint({
      request:
        "Crea una cripta sotto una cattedrale dove i morti non sono ostili ma prigionieri."
    });

    expect(blueprint.name).toBe("Crypt Beneath the Cathedral");
    expect(blueprint.globalTags).toEqual(
      expect.arrayContaining([
        "crypt",
        "cathedral",
        "undead",
        "non-hostile",
        "prisoners",
        "bound"
      ])
    );
    expect(
      blueprint.rooms.some((room) => room.tacticalRole === "entrance")
    ).toBe(true);
    expect(blueprint.rooms.some((room) => room.tacticalRole === "social")).toBe(
      true
    );
    expect(blueprint.rooms.some((room) => room.tacticalRole === "puzzle")).toBe(
      true
    );
    expect(blueprint.rooms.some((room) => room.tacticalRole === "hazard")).toBe(
      true
    );
    expect(blueprint.rooms.some((room) => room.tacticalRole === "boss")).toBe(
      true
    );
    expect(blueprint.rooms.map((room) => room.label)).toEqual(
      expect.arrayContaining([
        "Entrance from Cathedral Sacristy",
        "Hall of Bound Spirits",
        "Reliquary of Broken Vows",
        "Sealed Prison Tomb",
        "Final Ritual Chamber"
      ])
    );
  });

  it("converts a blueprint into a valid editable MapDocument", () => {
    const blueprint = generateCryptBlueprint({
      request: "Crypt under cathedral, non-hostile undead prisoners"
    });
    const map = generateMapFromBlueprint(blueprint, {
      heightCells: 42,
      widthCells: 60
    });

    expect(map.editable).toBe(true);
    expect(map.id).toBe(blueprint.id);
    expect(map.plan?.requestId).toBe(blueprint.id);
    expect(
      map.plan?.rooms.some((room) => room.label === "Hall of Bound Spirits")
    ).toBe(true);
    expect(
      map.plan?.rooms.some((room) => room.tags.includes("role-social"))
    ).toBe(true);
    expect(
      map.plan?.rooms.some((room) => room.tags.includes("role-boss"))
    ).toBe(true);
    expect(map.plan?.notes.join(" ")).toContain("The undead are prisoners");
  });

  it("keeps all blueprint room connections internally valid", () => {
    const blueprint = createNarrativeBlueprint({
      request: "A haunted building with a social hall and private chamber",
      theme: "haunted keep"
    });

    expectConnectionsReferenceRooms(blueprint);
  });

  it("routes cave requests to the cave structure and uses cellular automata", () => {
    const blueprint = createNarrativeBlueprint({
      request: "A natural cavern flooded with cold water beneath the mountain"
    });
    const map = generateMapFromBlueprint(blueprint, {
      heightCells: 28,
      widthCells: 36
    });

    expect(blueprint.structure).toBe("cave");
    expect(blueprint.hasWater).toBe(true);
    expect(map.plan?.rooms.some((room) => room.id === "room-cave-main")).toBe(
      true
    );
    expect(map.tiles.some((tile) => tile.kind === "floor")).toBe(true);
  });

  it("routes village requests to the village structure with multiple buildings", () => {
    const blueprint = createNarrativeBlueprint({
      request: "A small fishing village with a tavern, smithy, and docks",
      theme: "fishing"
    });
    const map = generateMapFromBlueprint(blueprint, {
      heightCells: 30,
      widthCells: 40
    });

    expect(blueprint.structure).toBe("village");
    expect(blueprint.hasWater).toBe(true);
    expect(
      (map.plan?.rooms ?? []).filter((room) => room.kind === "room").length
    ).toBeGreaterThanOrEqual(2);
  });

  it("routes outdoor requests to the outdoor structure with a river when mentioned", () => {
    const blueprint = createNarrativeBlueprint({
      request: "A dense forest clearing with a river running through it"
    });
    const map = generateMapFromBlueprint(blueprint, {
      heightCells: 24,
      widthCells: 32
    });

    expect(blueprint.structure).toBe("outdoor");
    expect(blueprint.hasWater).toBe(true);
    expect(blueprint.hasVegetation).toBe(true);
    expect(
      map.plan?.rooms.find((room) => room.id === "clearing-main")
    ).toBeDefined();
  });

  it("applies the requested scale to the generated map dimensions", () => {
    const small = createNarrativeBlueprint({
      request: "A small ruined building"
    });
    const large = createNarrativeBlueprint({
      request: "A huge sprawling castle keep"
    });
    const smallMap = generateMapFromBlueprint(small);
    const largeMap = generateMapFromBlueprint(large);

    expect(small.scale).toBe("small");
    expect(large.scale).toBe("large");
    expect(smallMap.width).toBeLessThan(largeMap.width);
    expect(smallMap.height).toBeLessThan(largeMap.height);
  });
});

function expectConnectionsReferenceRooms(blueprint: MapGenerationBlueprint) {
  const roomIds = new Set(blueprint.rooms.map((room) => room.id));

  for (const connection of blueprint.connections) {
    expect(roomIds.has(connection.from), connection.from).toBe(true);
    expect(roomIds.has(connection.to), connection.to).toBe(true);
  }
}
