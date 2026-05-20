import { MapDocumentSchema, type MapDocument, type PlacedAsset, type RoomNode, type TileKind } from "@dm-instamap/core";

export type EditorPaletteAsset = {
  id: string;
  kind: string;
  name: string;
  thumbnailUrl: string | null;
};

export type EditorTool = "select" | "paint-floor" | "paint-wall" | "paint-empty" | "door" | "light";

export type EditorSelection =
  | {
      id: string;
      type: "asset" | "door" | "light" | "room";
    }
  | null;

export function addPlacedAsset(
  document: MapDocument,
  paletteAsset: EditorPaletteAsset,
  position: { x: number; y: number }
): MapDocument {
  const placedAsset: PlacedAsset = {
    assetId: paletteAsset.id,
    id: createPlacedAssetId(document, paletteAsset.id),
    layer: paletteAsset.kind === "light" ? "lighting" : "object",
    locked: false,
    position,
    rotation: 0,
    scale: 1,
    tags: [paletteAsset.kind]
  };

  return MapDocumentSchema.parse({
    ...document,
    assets: [...document.assets, placedAsset]
  });
}

export function movePlacedAsset(
  document: MapDocument,
  placedAssetId: string,
  position: { x: number; y: number }
): MapDocument {
  return MapDocumentSchema.parse({
    ...document,
    assets: document.assets.map((asset) =>
      asset.id === placedAssetId
        ? {
            ...asset,
            position
          }
        : asset
    )
  });
}

export function deletePlacedAsset(document: MapDocument, placedAssetId: string): MapDocument {
  return MapDocumentSchema.parse({
    ...document,
    assets: document.assets.filter((asset) => asset.id !== placedAssetId)
  });
}

export function setTileKind(
  document: MapDocument,
  position: { x: number; y: number },
  kind: TileKind
): MapDocument {
  if (!isCellInBounds(document, position)) {
    return document;
  }

  const tileId = createTileId(position);
  const existingTile = document.tiles.find((tile) => tile.x === position.x && tile.y === position.y);
  const tiles = existingTile
    ? document.tiles.map((tile) => (tile.id === existingTile.id ? { ...tile, kind } : tile))
    : [
        ...document.tiles,
        {
          id: tileId,
          kind,
          x: position.x,
          y: position.y
        }
      ];

  return MapDocumentSchema.parse({
    ...document,
    tiles
  });
}

export function addDoorAtCell(document: MapDocument, position: { x: number; y: number }): MapDocument {
  if (!isCellInBounds(document, position)) {
    return document;
  }

  const door = {
    id: createPlanElementId(document.plan?.doors ?? [], "door"),
    isLocked: false,
    isOpen: false,
    position: { x: position.x + 0.5, y: position.y + 0.5 },
    rotation: 0,
    roomIds: findRoomsTouchingCell(document, position).map((room) => room.id),
    width: 1
  };
  const plan = document.plan
    ? {
        ...document.plan,
        doors: [...document.plan.doors, door]
      }
    : undefined;

  return setTileKind(
    MapDocumentSchema.parse({
      ...document,
      plan
    }),
    position,
    "door"
  );
}

export function addLightAtCell(document: MapDocument, position: { x: number; y: number }): MapDocument {
  if (!isCellInBounds(document, position)) {
    return document;
  }

  const light = {
    color: "#d7a447",
    id: createPlanElementId(document.plan?.lights ?? [], "light"),
    intensity: 0.75,
    kind: "torch" as const,
    position: { x: position.x + 0.5, y: position.y + 0.5 },
    radius: 4
  };

  return MapDocumentSchema.parse({
    ...document,
    plan: document.plan
      ? {
          ...document.plan,
          lights: [...document.plan.lights, light]
        }
      : undefined
  });
}

export function selectElementAtCell(
  document: MapDocument,
  position: { x: number; y: number }
): EditorSelection {
  const asset = document.assets.find(
    (placedAsset) => Math.floor(placedAsset.position.x) === position.x && Math.floor(placedAsset.position.y) === position.y
  );

  if (asset) {
    return { id: asset.id, type: "asset" };
  }

  const door = document.plan?.doors.find(
    (candidate) => Math.floor(candidate.position.x) === position.x && Math.floor(candidate.position.y) === position.y
  );

  if (door) {
    return { id: door.id, type: "door" };
  }

  const light = document.plan?.lights.find(
    (candidate) => Math.floor(candidate.position.x) === position.x && Math.floor(candidate.position.y) === position.y
  );

  if (light) {
    return { id: light.id, type: "light" };
  }

  const room = findRoomAtCell(document, position);
  return room ? { id: room.id, type: "room" } : null;
}

export function updateDocumentForTool(
  document: MapDocument,
  tool: EditorTool,
  position: { x: number; y: number }
): MapDocument {
  switch (tool) {
    case "paint-floor":
      return setTileKind(document, position, "floor");
    case "paint-wall":
      return setTileKind(document, position, "wall");
    case "paint-empty":
      return setTileKind(document, position, "empty");
    case "door":
      return addDoorAtCell(document, position);
    case "light":
      return addLightAtCell(document, position);
    case "select":
      return document;
  }
}

export function findRoomAtCell(
  document: MapDocument,
  position: { x: number; y: number }
): RoomNode | null {
  const rooms = document.plan?.rooms.filter((room) => room.kind === "room" || room.kind === "entrance") ?? [];

  return (
    rooms.find(
      (room) =>
        position.x >= room.bounds.x &&
        position.x < room.bounds.x + room.bounds.width &&
        position.y >= room.bounds.y &&
        position.y < room.bounds.y + room.bounds.height
    ) ?? null
  );
}

export function serializeMapDocument(document: MapDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function parseMapDocumentJson(value: string): MapDocument {
  const parsed = JSON.parse(value) as unknown;

  if (!parsed || typeof parsed !== "object" || !("editable" in parsed)) {
    throw new Error("JSON is not an editable MapDocument.");
  }

  return MapDocumentSchema.parse(parsed);
}

export function createFallbackPalette(): EditorPaletteAsset[] {
  return [
    { id: "fallback-torch", kind: "light", name: "Torch", thumbnailUrl: null },
    { id: "fallback-table", kind: "furniture", name: "Table", thumbnailUrl: null },
    { id: "fallback-crate", kind: "prop", name: "Crate", thumbnailUrl: null },
    { id: "fallback-statue", kind: "decoration", name: "Statue", thumbnailUrl: null }
  ];
}

function createPlacedAssetId(document: MapDocument, assetId: string): string {
  const safeAssetId = assetId.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  return createUniqueId(
    new Set(document.assets.map((asset) => asset.id)),
    `placed-${safeAssetId || "asset"}-${document.assets.length + 1}`
  );
}

function createTileId(position: { x: number; y: number }): string {
  return `tile-${position.x}-${position.y}`;
}

function createPlanElementId(items: Array<{ id: string }>, prefix: string): string {
  return createUniqueId(new Set(items.map((item) => item.id)), `${prefix}-${items.length + 1}`);
}

function createUniqueId(existingIds: Set<string>, preferredId: string): string {
  if (!existingIds.has(preferredId)) {
    return preferredId;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${preferredId}-${index}`;

    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }

  return `${preferredId}-${Date.now()}`;
}

function findRoomsTouchingCell(document: MapDocument, position: { x: number; y: number }): RoomNode[] {
  const candidates = [
    position,
    { x: position.x - 1, y: position.y },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y - 1 },
    { x: position.x, y: position.y + 1 }
  ];
  const rooms = candidates
    .map((candidate) => findRoomAtCell(document, candidate))
    .filter((room): room is RoomNode => room !== null);

  return [...new Map(rooms.map((room) => [room.id, room])).values()];
}

function isCellInBounds(document: MapDocument, position: { x: number; y: number }): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < document.width && position.y < document.height;
}
