import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  createMapDocument,
  type DoorSegment,
  type LightSource,
  type MapNote,
  type MapPlan,
  type RoomNode,
  type WallSegment
} from "@dm-instamap/core";
import { exportFoundryModule } from "../src";

describe("exportFoundryModule", () => {
  it("generates a zip module with manifest, scene data and map image", async () => {
    const result = await exportFoundryModule(createFoundryFixture(), {
      author: "Tester",
      imageFormat: "webp",
      moduleId: "test-dungeon",
      moduleTitle: "Test Dungeon",
      sceneName: "Exported Scene"
    });
    const zip = await JSZip.loadAsync(result.buffer);
    const moduleJson = JSON.parse(
      await zip.file("module.json")!.async("string")
    ) as {
      id: string;
      packs: Array<{ path: string; type: string }>;
      title: string;
    };
    const sceneJson = JSON.parse(
      await zip.file("scenes/test-dungeon.json")!.async("string")
    ) as {
      grid: { size: number };
      img: string;
      lights: unknown[];
      walls: Array<{ door: number; ds: number }>;
    };
    const packLine = await zip.file("packs/scenes.db")!.async("string");
    const mapImage = await zip
      .file("maps/test-dungeon.webp")!
      .async("uint8array");

    expect(result.filename).toBe("test-dungeon-foundry-module.zip");
    expect(moduleJson).toMatchObject({
      id: "test-dungeon",
      title: "Test Dungeon"
    });
    expect(moduleJson.packs).toEqual([
      {
        label: "Scenes",
        name: "scenes",
        path: "packs/scenes.db",
        type: "Scene"
      }
    ]);
    expect(sceneJson.img).toBe("modules/test-dungeon/maps/test-dungeon.webp");
    expect(sceneJson.grid.size).toBe(70);
    expect(sceneJson.walls).toHaveLength(3);
    expect(sceneJson.walls.filter((wall) => wall.door === 1)).toHaveLength(1);
    expect(sceneJson.walls.find((wall) => wall.door === 1)?.ds).toBe(2);
    expect(sceneJson.lights).toHaveLength(1);
    expect(packLine.trim()).toContain('"Exported Scene"');
    expect(Buffer.from(mapImage).subarray(0, 4).toString("ascii")).toBe("RIFF");
  });

  it("includes walls, doors and lights in Foundry scene coordinates", async () => {
    const result = await exportFoundryModule(createFoundryFixture(), {
      imageFormat: "png",
      moduleId: "coordinate-test"
    });

    expect(result.sceneJson.width).toBe(350);
    expect(result.sceneJson.height).toBe(280);
    expect(result.sceneJson.walls[0]?.c).toEqual([0, 0, 350, 0]);
    expect(result.sceneJson.walls[2]).toMatchObject({
      c: [105, 70, 175, 70],
      door: 1,
      ds: 2
    });
    expect(result.sceneJson.lights[0]).toMatchObject({
      config: {
        bright: 189,
        color: "#ffaa66",
        dim: 420
      },
      x: 140,
      y: 140
    });
  });

  it("emits journal entries for rooms, GM notes, and plan notes", async () => {
    const result = await exportFoundryModule(
      createFoundryFixtureWithJournals(),
      {
        moduleId: "journal-test"
      }
    );
    const zip = await JSZip.loadAsync(result.buffer);
    const moduleJson = JSON.parse(
      await zip.file("module.json")!.async("string")
    ) as {
      packs: Array<{ name: string; type: string }>;
    };

    expect(result.journalJson.map((entry) => entry.name)).toEqual([
      "Foundry Journal Test — Rooms",
      "Foundry Journal Test — GM Notes",
      "Foundry Journal Test — Plan Notes"
    ]);
    expect(result.journalJson[0]?.pages[0]?.text.content).toContain(
      "Entrance Hall"
    );
    expect(result.journalJson[1]?.pages[0]?.text.content).toContain(
      "pressure plate"
    );
    expect(
      moduleJson.packs.find((pack) => pack.type === "JournalEntry")
    ).toBeDefined();
    expect(zip.file("packs/journal.db")).not.toBeNull();
  });

  it("adds scene notes that link GM notes to their journal pages", async () => {
    const result = await exportFoundryModule(
      createFoundryFixtureWithJournals(),
      {
        moduleId: "scene-notes-test"
      }
    );

    expect(result.sceneJson.notes).toHaveLength(1);
    const note = result.sceneJson.notes[0]!;
    expect(note.text).toBe("Trap");
    expect(note.x).toBe(210);
    expect(note.y).toBe(70);
    expect(note.entryId).toHaveLength(16);
    expect(note.pageId).toHaveLength(16);

    const gmJournal = result.journalJson.find((entry) =>
      entry.name.endsWith("— GM Notes")
    );
    expect(gmJournal?._id).toBe(note.entryId);
    expect(gmJournal?.pages[0]?._id).toBe(note.pageId);
  });

  it("emits empty scene notes when journals are disabled", async () => {
    const result = await exportFoundryModule(
      createFoundryFixtureWithJournals(),
      {
        includeJournals: false,
        moduleId: "scene-notes-skip-test"
      }
    );

    expect(result.sceneJson.notes).toHaveLength(0);
  });

  it("skips journal output when includeJournals is false", async () => {
    const result = await exportFoundryModule(
      createFoundryFixtureWithJournals(),
      {
        includeJournals: false,
        moduleId: "no-journal-test"
      }
    );
    const zip = await JSZip.loadAsync(result.buffer);
    const moduleJson = JSON.parse(
      await zip.file("module.json")!.async("string")
    ) as {
      packs: Array<{ type: string }>;
    };

    expect(result.journalJson).toHaveLength(0);
    expect(moduleJson.packs.every((pack) => pack.type === "Scene")).toBe(true);
    expect(zip.file("packs/journal.db")).toBeNull();
  });
});

function createFoundryFixture() {
  const walls: WallSegment[] = [
    {
      blocksMovement: true,
      end: { x: 5, y: 0 },
      id: "wall-north",
      roomIds: [],
      start: { x: 0, y: 0 },
      thickness: 1
    },
    {
      blocksMovement: true,
      end: { x: 5, y: 4 },
      id: "wall-east",
      roomIds: [],
      start: { x: 5, y: 0 },
      thickness: 1
    }
  ];
  const doors: DoorSegment[] = [
    {
      id: "door-locked",
      isLocked: true,
      isOpen: false,
      position: { x: 2, y: 1 },
      rotation: 0,
      roomIds: [],
      width: 1
    }
  ];
  const lights: LightSource[] = [
    {
      color: "#ffaa66",
      flicker: false,
      id: "light-torch",
      intensity: 0.8,
      kind: "torch",
      position: { x: 2, y: 2 },
      radius: 6
    }
  ];
  const plan: MapPlan = {
    assetPlacements: [],
    doors,
    gmNotes: [],
    id: "plan-foundry",
    initiative: [],
    lights,
    name: "Foundry Plan",
    notes: [],
    requestId: "request-foundry",
    rooms: [],
    walls
  };

  return createMapDocument({
    grid: {
      cellSize: 5,
      height: 4,
      pixelsPerCell: 70,
      type: "square",
      unit: "ft",
      width: 5
    },
    height: 4,
    id: "foundry-test",
    name: "Foundry Test",
    plan,
    tiles: Array.from({ length: 20 }, (_, index) => ({
      id: `tile-${index}`,
      kind: "floor" as const,
      x: index % 5,
      y: Math.floor(index / 5)
    })),
    width: 5
  });
}

function createFoundryFixtureWithJournals() {
  const rooms: RoomNode[] = [
    {
      bounds: { height: 3, width: 4, x: 0, y: 0 },
      connections: ["room-final"],
      id: "room-entrance",
      kind: "entrance",
      label: "Entrance Hall",
      tags: ["entrance"]
    },
    {
      bounds: { height: 3, width: 4, x: 5, y: 0 },
      connections: ["room-entrance"],
      id: "room-final",
      kind: "room",
      label: "Throne Room",
      tags: ["boss"]
    }
  ];
  const gmNotes: MapNote[] = [
    {
      id: "note-trap",
      position: { x: 3, y: 1 },
      text: "A pressure plate triggers darts when stepped on.",
      title: "Trap"
    }
  ];
  const plan: MapPlan = {
    assetPlacements: [],
    doors: [],
    gmNotes,
    id: "plan-journals",
    initiative: [],
    lights: [],
    name: "Journal Plan",
    notes: ["Players start at the south entrance."],
    requestId: "request-journals",
    rooms,
    walls: []
  };

  return createMapDocument({
    grid: {
      cellSize: 5,
      height: 4,
      pixelsPerCell: 70,
      type: "square",
      unit: "ft",
      width: 10
    },
    height: 4,
    id: "foundry-journal-test",
    name: "Foundry Journal Test",
    plan,
    tiles: Array.from({ length: 40 }, (_, index) => ({
      id: `tile-${index}`,
      kind: "floor" as const,
      x: index % 10,
      y: Math.floor(index / 10)
    })),
    width: 10
  });
}
