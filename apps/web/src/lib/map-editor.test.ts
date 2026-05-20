import { describe, expect, it } from "vitest";
import { generateDungeon } from "@dm-instamap/generator";
import {
  addDoorAtCell,
  addLightAtCell,
  addPlacedAsset,
  deletePlacedAsset,
  findRoomAtCell,
  movePlacedAsset,
  parseMapDocumentJson,
  selectElementAtCell,
  serializeMapDocument,
  setTileKind,
  updateDocumentForTool
} from "./map-editor";

const document = generateDungeon({
  heightCells: 28,
  requiredRooms: ["boss"],
  roomCount: 5,
  theme: "crypt",
  widthCells: 36
});
const paletteAsset = {
  id: "asset-table",
  kind: "furniture",
  name: "Table",
  thumbnailUrl: null
};

describe("map editor helpers", () => {
  it("adds, moves, and deletes placed assets", () => {
    const withAsset = addPlacedAsset(document, paletteAsset, { x: 4, y: 5 });
    const placedId = withAsset.assets[0]?.id ?? "";

    expect(withAsset.assets[0]).toMatchObject({
      assetId: "asset-table",
      layer: "object",
      position: { x: 4, y: 5 }
    });

    const moved = movePlacedAsset(withAsset, placedId, { x: 8, y: 9 });
    expect(moved.assets[0]?.position).toEqual({ x: 8, y: 9 });

    const deleted = deletePlacedAsset(moved, placedId);
    expect(deleted.assets).toHaveLength(0);
  });

  it("finds a room at a cell position", () => {
    const entrance = document.plan?.rooms.find((room) => room.id === "room-entrance");

    expect(entrance).toBeTruthy();
    expect(
      findRoomAtCell(document, {
        x: entrance?.bounds.x ?? 0,
        y: entrance?.bounds.y ?? 0
      })?.id
    ).toBe("room-entrance");
  });

  it("serializes and parses editable map documents", () => {
    const json = serializeMapDocument(document);
    const parsed = parseMapDocumentJson(json);

    expect(parsed.editable).toBe(true);
    expect(parsed.tiles).toHaveLength(document.tiles.length);
  });

  it("paints cells and keeps the MapDocument valid", () => {
    const paintedFloor = setTileKind(document, { x: 1, y: 1 }, "floor");
    expect(paintedFloor.tiles.find((tile) => tile.x === 1 && tile.y === 1)?.kind).toBe("floor");

    const paintedWall = updateDocumentForTool(paintedFloor, "paint-wall", { x: 1, y: 1 });
    expect(paintedWall.tiles.find((tile) => tile.x === 1 && tile.y === 1)?.kind).toBe("wall");

    const unchanged = setTileKind(document, { x: -1, y: 1 }, "floor");
    expect(unchanged).toBe(document);
  });

  it("adds doors and lights through canvas tools", () => {
    const withDoor = addDoorAtCell(document, { x: 2, y: 2 });
    expect(withDoor.plan?.doors).toHaveLength((document.plan?.doors.length ?? 0) + 1);
    expect(withDoor.tiles.find((tile) => tile.x === 2 && tile.y === 2)?.kind).toBe("door");

    const withLight = addLightAtCell(withDoor, { x: 3, y: 3 });
    expect(withLight.plan?.lights).toHaveLength((withDoor.plan?.lights.length ?? 0) + 1);
  });

  it("selects assets, doors, lights, and rooms by cell", () => {
    const withAsset = addPlacedAsset(document, paletteAsset, { x: 4, y: 5 });
    expect(selectElementAtCell(withAsset, { x: 4, y: 5 })).toMatchObject({ type: "asset" });

    const withDoor = addDoorAtCell(withAsset, { x: 6, y: 6 });
    expect(selectElementAtCell(withDoor, { x: 6, y: 6 })).toMatchObject({ type: "door" });

    const withLight = addLightAtCell(withDoor, { x: 7, y: 7 });
    expect(selectElementAtCell(withLight, { x: 7, y: 7 })).toMatchObject({ type: "light" });

    const entrance = document.plan?.rooms.find((room) => room.id === "room-entrance");
    expect(
      selectElementAtCell(document, {
        x: entrance?.bounds.x ?? 0,
        y: entrance?.bounds.y ?? 0
      })
    ).toMatchObject({ id: "room-entrance", type: "room" });
  });
});
