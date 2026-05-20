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
      request: "Crea una cripta sotto una cattedrale dove i morti non sono ostili ma prigionieri."
    });

    expect(blueprint.name).toBe("Crypt Beneath the Cathedral");
    expect(blueprint.globalTags).toEqual(
      expect.arrayContaining(["crypt", "cathedral", "undead", "non-hostile", "prisoners", "bound"])
    );
    expect(blueprint.rooms.some((room) => room.tacticalRole === "entrance")).toBe(true);
    expect(blueprint.rooms.some((room) => room.tacticalRole === "social")).toBe(true);
    expect(blueprint.rooms.some((room) => room.tacticalRole === "puzzle")).toBe(true);
    expect(blueprint.rooms.some((room) => room.tacticalRole === "hazard")).toBe(true);
    expect(blueprint.rooms.some((room) => room.tacticalRole === "boss")).toBe(true);
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
    expect(map.plan?.rooms.some((room) => room.label === "Hall of Bound Spirits")).toBe(true);
    expect(map.plan?.rooms.some((room) => room.tags.includes("role-social"))).toBe(true);
    expect(map.plan?.rooms.some((room) => room.tags.includes("role-boss"))).toBe(true);
    expect(map.plan?.notes.join(" ")).toContain("The undead are prisoners");
  });

  it("keeps all blueprint room connections internally valid", () => {
    const blueprint = createNarrativeBlueprint({
      request: "A haunted building with a social hall and private chamber",
      theme: "haunted keep"
    });

    expectConnectionsReferenceRooms(blueprint);
  });
});

function expectConnectionsReferenceRooms(blueprint: MapGenerationBlueprint) {
  const roomIds = new Set(blueprint.rooms.map((room) => room.id));

  for (const connection of blueprint.connections) {
    expect(roomIds.has(connection.from), connection.from).toBe(true);
    expect(roomIds.has(connection.to), connection.to).toBe(true);
  }
}
