import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  createMapDocument,
  type DoorSegment,
  type InitiativeEntry,
  type LightSource,
  type MapNote,
  type MapPlan,
  type RoomNode,
  type WallSegment
} from "@dm-instamap/core";
import { exportSessionPack } from "../src";

describe("exportSessionPack", () => {
  it("produces a zip with full, GM, and player maps plus notes and initiative", async () => {
    const result = await exportSessionPack(createSessionFixture(), {
      description: "A short test session.",
      imageFormat: "png",
      includeGrid: true,
      includeInitiative: true,
      scale: 1
    });
    const zip = await JSZip.loadAsync(result.buffer);
    const paths = Object.keys(zip.files);

    expect(result.filename).toBe("session-fixture-session-pack.zip");
    expect(paths).toEqual(
      expect.arrayContaining([
        "maps/session-fixture-full.png",
        "maps/session-fixture-gm.png",
        "maps/session-fixture-player.png",
        "notes/gm-notes.json",
        "notes/plan-notes.txt",
        "notes/description.txt",
        "initiative/initiative.json",
        "manifest.json"
      ])
    );

    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string")) as {
      artifacts: Array<{ path: string }>;
      documentId: string;
      rooms: Array<{ id: string }>;
    };
    expect(manifest.documentId).toBe("session-fixture");
    expect(manifest.rooms.map((room) => room.id)).toEqual(expect.arrayContaining(["room-public", "room-secret"]));
    expect(manifest.artifacts.length).toBeGreaterThanOrEqual(7);

    const gmNotes = JSON.parse(await zip.file("notes/gm-notes.json")!.async("string")) as {
      entries: Array<{ title: string }>;
    };
    expect(gmNotes.entries.map((entry) => entry.title)).toEqual(["Trap"]);

    const initiative = JSON.parse(await zip.file("initiative/initiative.json")!.async("string")) as {
      entries: Array<{ name: string }>;
    };
    expect(initiative.entries.map((entry) => entry.name)).toEqual(["Goblin"]);
  });

  it("omits the initiative file when includeInitiative is false", async () => {
    const result = await exportSessionPack(createSessionFixture(), {
      includeInitiative: false
    });
    const zip = await JSZip.loadAsync(result.buffer);

    expect(zip.file("initiative/initiative.json")).toBeNull();
  });
});

function createSessionFixture() {
  const walls: WallSegment[] = [
    {
      blocksMovement: true,
      end: { x: 6, y: 0 },
      id: "wall-north",
      roomIds: ["room-public"],
      start: { x: 0, y: 0 },
      thickness: 1
    }
  ];
  const doors: DoorSegment[] = [
    {
      id: "door-front",
      isLocked: false,
      isOpen: false,
      position: { x: 3, y: 0 },
      rotation: 0,
      roomIds: ["room-public"],
      width: 1
    }
  ];
  const lights: LightSource[] = [
    {
      color: "#ffcc88",
      flicker: false,
      id: "light-fireplace",
      intensity: 0.8,
      kind: "torch",
      position: { x: 1, y: 1 },
      radius: 6
    }
  ];
  const rooms: RoomNode[] = [
    {
      bounds: { height: 4, width: 5, x: 0, y: 0 },
      connections: [],
      id: "room-public",
      kind: "room",
      label: "Public Hall",
      tags: ["public"]
    },
    {
      bounds: { height: 2, width: 2, x: 4, y: 2 },
      connections: [],
      id: "room-secret",
      kind: "secret",
      label: "Hidden Cache",
      tags: ["secret"]
    }
  ];
  const gmNotes: MapNote[] = [
    {
      id: "note-trap",
      position: { x: 4, y: 2 },
      text: "A pressure plate triggers darts when stepped on.",
      title: "Trap"
    }
  ];
  const initiative: InitiativeEntry[] = [
    {
      id: "init-goblin",
      initiative: 15,
      name: "Goblin",
      side: "enemy"
    }
  ];
  const plan: MapPlan = {
    assetPlacements: [],
    doors,
    gmNotes,
    id: "plan-session",
    initiative,
    lights,
    name: "Session Plan",
    notes: ["Players start at the south entrance."],
    requestId: "request-session",
    rooms,
    walls
  };

  return createMapDocument({
    grid: {
      cellSize: 5,
      height: 4,
      pixelsPerCell: 70,
      type: "square",
      unit: "ft",
      width: 6
    },
    height: 4,
    id: "session-fixture",
    name: "Session Fixture",
    plan,
    tiles: Array.from({ length: 24 }, (_, index) => ({
      id: `tile-${index}`,
      kind: "floor" as const,
      x: index % 6,
      y: Math.floor(index / 6)
    })),
    width: 6
  });
}
