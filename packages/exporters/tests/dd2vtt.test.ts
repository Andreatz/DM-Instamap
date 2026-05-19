import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createMapDocument, type DoorSegment, type LightSource, type MapPlan, type WallSegment } from "@dm-instamap/core";
import { exportMapDocumentDd2Vtt, importDd2Vtt, importDd2VttFile } from "../src";

const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "simple.dd2vtt");

describe("importDd2VttFile", () => {
  it("reads Universal VTT files and converts them to editable MapDocuments", async () => {
    const result = await importDd2VttFile(fixturePath, {
      name: "Fixture Dungeon"
    });

    expect(result.metadata).toMatchObject({
      format: 0.3,
      pixelsPerGrid: 100,
      source: "universal-vtt"
    });
    expect(result.document).toMatchObject({
      editable: true,
      grid: {
        height: 6,
        pixelsPerCell: 100,
        width: 8
      },
      height: 6,
      id: "fixture-dungeon",
      name: "Fixture Dungeon",
      version: 1,
      width: 8
    });
    expect(result.document.tiles).toHaveLength(48);
  });

  it("extracts embedded map images", async () => {
    const result = await importDd2VttFile(fixturePath);

    expect(result.image).toMatchObject({
      contentType: "image/png",
      extension: "png"
    });
    expect(result.image?.buffer.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  });

  it("extracts walls, doors and lights", async () => {
    const result = await importDd2VttFile(fixturePath);

    expect(result.document.plan?.walls).toHaveLength(3);
    expect(result.document.plan?.walls[0]).toMatchObject({
      blocksMovement: true,
      end: { x: 4, y: 1 },
      start: { x: 1, y: 1 },
      thickness: 1
    });
    expect(result.document.plan?.doors).toHaveLength(1);
    expect(result.document.plan?.doors[0]).toMatchObject({
      isOpen: false,
      position: { x: 4, y: 2 },
      width: 1
    });
    expect(result.document.plan?.lights).toHaveLength(1);
    expect(result.document.plan?.lights[0]).toMatchObject({
      color: "#ffaa66",
      intensity: 0.7,
      position: { x: 2, y: 2 },
      radius: 6
    });
  });
});

describe("importDd2Vtt", () => {
  it("supports alternate wall and portal shapes without embedded images", () => {
    const result = importDd2Vtt({
      format: "uvtt",
      portals: [
        {
          bounds: [
            [1, 1],
            [2, 1]
          ],
          isOpen: true
        }
      ],
      resolution: {
        image_size: {
          x: 300,
          y: 200
        },
        pixels_per_grid: 50
      },
      walls: [
        [
          [0, 0],
          [3, 0]
        ]
      ]
    });

    expect(result.image).toBeNull();
    expect(result.document.width).toBe(6);
    expect(result.document.height).toBe(4);
    expect(result.document.plan?.doors[0]).toMatchObject({
      isOpen: true,
      position: { x: 1.5, y: 1 }
    });
    expect(result.document.plan?.walls).toHaveLength(1);
  });
});

describe("exportMapDocumentDd2Vtt", () => {
  it("converts MapDocument to dd2vtt-compatible JSON with image, grid, walls, doors and lights", async () => {
    const document = createDd2VttExportFixture();
    const result = await exportMapDocumentDd2Vtt(document, {
      embedImage: true,
      imageFormat: "png",
      includeGrid: false
    });

    expect(result.object.resolution).toMatchObject({
      image_size: { x: 350, y: 280 },
      map_origin: { x: 0, y: 0 },
      map_size: { x: 5, y: 4 },
      pixels_per_grid: 70
    });
    expect(result.object.line_of_sight).toEqual([
      [
        { x: 0, y: 0 },
        { x: 5, y: 0 }
      ],
      [
        { x: 5, y: 0 },
        { x: 5, y: 4 }
      ]
    ]);
    expect(result.object.portals).toEqual([
      {
        closed: true,
        position: { x: 2, y: 0 },
        rotation: 90,
        width: 1
      }
    ]);
    expect(result.object.lights).toEqual([
      {
        color: "#ffaa66",
        intensity: 0.75,
        position: { x: 2, y: 2 },
        range: 5
      }
    ]);
    expect(result.object.image).toMatch(/^data:image\/png;base64,/u);
    expect(JSON.parse(result.json)).toMatchObject({ format: 0.3 });
  });

  it("round-trips through import after export", async () => {
    const exported = await exportMapDocumentDd2Vtt(createDd2VttExportFixture(), {
      embedImage: true
    });
    const imported = importDd2Vtt(exported.json, {
      name: "Round Trip"
    });

    expect(imported.image?.contentType).toBe("image/png");
    expect(imported.document.width).toBe(5);
    expect(imported.document.height).toBe(4);
    expect(imported.metadata.pixelsPerGrid).toBe(70);
    expect(imported.document.plan?.walls).toHaveLength(2);
    expect(imported.document.plan?.doors).toHaveLength(1);
    expect(imported.document.plan?.lights).toHaveLength(1);
    expect(imported.document.plan?.doors[0]).toMatchObject({
      isOpen: false,
      position: { x: 2, y: 0 },
      rotation: 90,
      width: 1
    });
  });
});

function createDd2VttExportFixture() {
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
      id: "door-north",
      isLocked: false,
      isOpen: false,
      position: { x: 2, y: 0 },
      rotation: 90,
      roomIds: [],
      width: 1
    }
  ];
  const lights: LightSource[] = [
    {
      color: "#ffaa66",
      id: "light-center",
      intensity: 0.75,
      kind: "torch",
      position: { x: 2, y: 2 },
      radius: 5
    }
  ];
  const plan: MapPlan = {
    assetPlacements: [],
    doors,
    id: "plan-export",
    lights,
    name: "Export Plan",
    notes: [],
    requestId: "request-export",
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
    id: "dd2vtt-export",
    name: "dd2vtt Export",
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
