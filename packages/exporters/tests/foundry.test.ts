import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { createMapDocument, type DoorSegment, type LightSource, type MapPlan, type WallSegment } from "@dm-instamap/core";
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
    const moduleJson = JSON.parse(await zip.file("module.json")!.async("string")) as {
      id: string;
      packs: Array<{ path: string; type: string }>;
      title: string;
    };
    const sceneJson = JSON.parse(await zip.file("scenes/test-dungeon.json")!.async("string")) as {
      grid: { size: number };
      img: string;
      lights: unknown[];
      walls: Array<{ door: number; ds: number }>;
    };
    const packLine = await zip.file("packs/scenes.db")!.async("string");
    const mapImage = await zip.file("maps/test-dungeon.webp")!.async("uint8array");

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
    expect(packLine.trim()).toContain("\"Exported Scene\"");
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
    id: "plan-foundry",
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
