import { describe, expect, it } from "vitest";
import { generateDungeon } from "@dm-instamap/generator";
import {
  addDoorAtCell,
  addInitiativeEntry,
  addLightAtCell,
  addMapNote,
  addPlacedAsset,
  computeVisibleCells,
  createPlacedAssetClipboard,
  deleteInitiativeEntry,
  deleteMapNote,
  deletePlacedAsset,
  deletePlacedAssets,
  duplicatePlacedAsset,
  duplicatePlacedAssets,
  ensureEditorLayers,
  findRoomAtCell,
  getEditorLayerOpacity,
  groupPlacedAssets,
  isEditorLayerLocked,
  isEditorLayerVisible,
  movePlacedAsset,
  movePlacedAssets,
  pastePlacedAssetClipboard,
  parseMapDocumentJson,
  selectPlacedAssetsInBounds,
  selectElementAtCell,
  serializeMapDocument,
  setTileKind,
  ungroupPlacedAssets,
  updateInitiativeEntry,
  updateLightSource,
  updateMapLayer,
  updateMapNote,
  updatePlacedAssetLayer,
  updatePlacedAssetTransform,
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

  it("moves, duplicates, deletes, copies and pastes selected asset sets", () => {
    const first = addPlacedAsset(document, paletteAsset, { x: 4, y: 5 });
    const second = addPlacedAsset(
      first,
      { ...paletteAsset, id: "asset-chair", name: "Chair" },
      { x: 7, y: 8 }
    );
    const selectedIds = second.assets.map((asset) => asset.id);

    const moved = movePlacedAssets(second, selectedIds, { x: 1, y: -1 });
    expect(moved.assets.map((asset) => asset.position)).toEqual([
      { x: 5, y: 4 },
      { x: 8, y: 7 }
    ]);

    const duplicated = duplicatePlacedAssets(second, selectedIds);
    expect(duplicated.assets).toHaveLength(4);

    const clipboard = createPlacedAssetClipboard(second, selectedIds);
    const pasted = pastePlacedAssetClipboard(document, clipboard, {
      x: 2,
      y: 2
    });
    expect(pasted.pastedIds).toHaveLength(2);
    expect(pasted.document.assets.map((asset) => asset.position)).toEqual([
      { x: 6, y: 7 },
      { x: 9, y: 10 }
    ]);

    const selectedInBounds = selectPlacedAssetsInBounds(second, {
      maxX: 8,
      maxY: 9,
      minX: 3,
      minY: 4
    });
    expect(selectedInBounds).toEqual(selectedIds);

    const deleted = deletePlacedAssets(second, selectedIds);
    expect(deleted.assets).toHaveLength(0);
  });

  it("groups and ungroups selected asset sets", () => {
    const first = addPlacedAsset(document, paletteAsset, { x: 4, y: 5 });
    const second = addPlacedAsset(
      first,
      { ...paletteAsset, id: "asset-chair", name: "Chair" },
      { x: 7, y: 8 }
    );
    const selectedIds = second.assets.map((asset) => asset.id);
    const grouped = groupPlacedAssets(second, selectedIds);

    expect(grouped.groupId).toBeTruthy();
    expect(
      grouped.document.assets.every(
        (asset) => asset.groupId === grouped.groupId
      )
    ).toBe(true);

    const ungrouped = ungroupPlacedAssets(grouped.document, [
      selectedIds[0] ?? ""
    ]);
    expect(ungrouped.assets.every((asset) => asset.groupId === undefined)).toBe(
      true
    );
  });

  it("updates lights and computes line-of-sight visible cells", () => {
    const withLight = addLightAtCell(document, { x: 3, y: 3 });
    const lightId = withLight.plan?.lights[0]?.id ?? "";
    const updated = updateLightSource(withLight, lightId, {
      color: "#88ccff",
      flicker: true,
      intensity: 0.35,
      radius: 3
    });
    const blocked = setTileKind(updated, { x: 4, y: 3 }, "wall");
    const visibleCells = computeVisibleCells(blocked);

    expect(updated.plan?.lights[0]).toMatchObject({
      color: "#88ccff",
      flicker: true,
      intensity: 0.35,
      radius: 3
    });
    expect(visibleCells).toContain("3,3");
    expect(visibleCells).not.toContain("5,3");
  });

  it("adds, updates and deletes GM notes and initiative entries", () => {
    const withNote = addMapNote(
      document,
      { x: 4, y: 5 },
      "Secret door behind the altar",
      "Secret"
    );
    const noteId = withNote.plan?.gmNotes[0]?.id ?? "";
    const updatedNote = updateMapNote(withNote, noteId, {
      text: "Trapdoor behind the altar"
    });
    const withoutNote = deleteMapNote(updatedNote, noteId);

    const withInitiative = addInitiativeEntry(withoutNote, {
      hitPoints: 12,
      initiative: 14,
      name: "Skeleton",
      notes: "Guards the altar",
      side: "enemy"
    });
    const entryId = withInitiative.plan?.initiative[0]?.id ?? "";
    const updatedInitiative = updateInitiativeEntry(withInitiative, entryId, {
      hitPoints: 8,
      initiative: 18
    });
    const withoutInitiative = deleteInitiativeEntry(updatedInitiative, entryId);

    expect(updatedNote.plan?.gmNotes[0]?.text).toBe(
      "Trapdoor behind the altar"
    );
    expect(withoutNote.plan?.gmNotes).toHaveLength(0);
    expect(updatedInitiative.plan?.initiative[0]).toMatchObject({
      hitPoints: 8,
      initiative: 18
    });
    expect(withoutInitiative.plan?.initiative).toHaveLength(0);
  });

  it("updates placed asset transforms and layer assignment", () => {
    const withAsset = addPlacedAsset(document, paletteAsset, { x: 4, y: 5 });
    const placedId = withAsset.assets[0]?.id ?? "";
    const transformed = updatePlacedAssetTransform(withAsset, placedId, {
      flipX: true,
      rotation: 375,
      scale: 2.25
    });
    const relayered = updatePlacedAssetLayer(
      transformed,
      placedId,
      "annotation"
    );
    const duplicated = duplicatePlacedAsset(relayered, placedId);

    expect(transformed.assets[0]).toMatchObject({
      flipX: true,
      flipY: false,
      rotation: 15,
      scale: 2.25
    });
    expect(relayered.assets[0]?.layer).toBe("annotation");
    expect(duplicated.assets).toHaveLength(2);
    expect(duplicated.assets[1]?.position).toEqual({ x: 5, y: 6 });
  });

  it("ensures and updates editor document layers", () => {
    const layered = ensureEditorLayers(document);
    const updated = updateMapLayer(layered, "props", {
      locked: true,
      opacity: 0.45,
      visible: false
    });

    expect(layered.layers.map((layer) => layer.kind)).toEqual([
      "background",
      "terrain",
      "walls",
      "props",
      "lighting",
      "gm-only",
      "notes"
    ]);
    expect(isEditorLayerVisible(updated, "props")).toBe(false);
    expect(isEditorLayerLocked(updated, "props")).toBe(true);
    expect(getEditorLayerOpacity(updated, "props")).toBe(0.45);
  });

  it("finds a room at a cell position", () => {
    const entrance = document.plan?.rooms.find(
      (room) => room.id === "room-entrance"
    );

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
    expect(
      paintedFloor.tiles.find((tile) => tile.x === 1 && tile.y === 1)?.kind
    ).toBe("floor");

    const paintedWall = updateDocumentForTool(paintedFloor, "paint-wall", {
      x: 1,
      y: 1
    });
    expect(
      paintedWall.tiles.find((tile) => tile.x === 1 && tile.y === 1)?.kind
    ).toBe("wall");

    const unchanged = setTileKind(document, { x: -1, y: 1 }, "floor");
    expect(unchanged).toBe(document);
  });

  it("adds doors and lights through canvas tools", () => {
    const withDoor = addDoorAtCell(document, { x: 2, y: 2 });
    expect(withDoor.plan?.doors).toHaveLength(
      (document.plan?.doors.length ?? 0) + 1
    );
    expect(
      withDoor.tiles.find((tile) => tile.x === 2 && tile.y === 2)?.kind
    ).toBe("door");

    const withLight = addLightAtCell(withDoor, { x: 3, y: 3 });
    expect(withLight.plan?.lights).toHaveLength(
      (withDoor.plan?.lights.length ?? 0) + 1
    );
  });

  it("selects assets, doors, lights, and rooms by cell", () => {
    const withAsset = addPlacedAsset(document, paletteAsset, { x: 4, y: 5 });
    expect(selectElementAtCell(withAsset, { x: 4, y: 5 })).toMatchObject({
      type: "asset"
    });

    const withDoor = addDoorAtCell(withAsset, { x: 6, y: 6 });
    expect(selectElementAtCell(withDoor, { x: 6, y: 6 })).toMatchObject({
      type: "door"
    });

    const withLight = addLightAtCell(withDoor, { x: 7, y: 7 });
    expect(selectElementAtCell(withLight, { x: 7, y: 7 })).toMatchObject({
      type: "light"
    });

    const entrance = document.plan?.rooms.find(
      (room) => room.id === "room-entrance"
    );
    expect(
      selectElementAtCell(document, {
        x: entrance?.bounds.x ?? 0,
        y: entrance?.bounds.y ?? 0
      })
    ).toMatchObject({ id: "room-entrance", type: "room" });
  });
});
