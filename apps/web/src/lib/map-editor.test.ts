import { describe, expect, it } from "vitest";
import { generateDungeon } from "@dm-instamap/generator";
import {
  addPlacedAsset,
  deletePlacedAsset,
  findRoomAtCell,
  movePlacedAsset,
  parseMapDocumentJson,
  serializeMapDocument
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
});
