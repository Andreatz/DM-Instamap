import {
  MapDocumentSchema,
  type DoorSegment,
  type LightSource,
  type MapDocument,
  type MapPlan,
  type MapTile,
  type PlacedAsset,
  type RoomNode,
  type WallSegment
} from "@dm-instamap/core";

export type MapVisibilityMode = "player" | "gm" | "clean";

const HIDDEN_ROOM_KINDS = new Set<RoomNode["kind"]>(["secret"]);
const HIDDEN_TAG_PATTERNS = [/^secret$/iu, /^trap$/iu, /^hidden$/iu, /^gm[-_]?only$/iu, /^spoiler$/iu];

export function listVisibilityModes(): MapVisibilityMode[] {
  return ["player", "gm", "clean"];
}

export function applyVisibilityMode(document: MapDocument, mode: MapVisibilityMode): MapDocument {
  if (mode === "gm") {
    return document;
  }

  const hiddenRoomIds = collectHiddenRoomIds(document.plan?.rooms ?? []);
  const filteredTiles = filterTiles({
    document,
    hiddenRoomIds,
    rooms: document.plan?.rooms ?? []
  });
  const filteredAssets = filterAssets(document.assets, hiddenRoomIds, document.plan?.rooms ?? [], mode);
  const filteredPlan = document.plan ? filterPlan(document.plan, hiddenRoomIds, mode) : undefined;

  return MapDocumentSchema.parse({
    ...document,
    assets: filteredAssets,
    plan: filteredPlan,
    tiles: filteredTiles
  });
}

export function isHiddenRoom(room: RoomNode): boolean {
  if (HIDDEN_ROOM_KINDS.has(room.kind)) {
    return true;
  }

  return room.tags.some((tag) => HIDDEN_TAG_PATTERNS.some((pattern) => pattern.test(tag)));
}

function collectHiddenRoomIds(rooms: RoomNode[]): Set<string> {
  const hidden = new Set<string>();

  for (const room of rooms) {
    if (isHiddenRoom(room)) {
      hidden.add(room.id);
    }
  }

  return hidden;
}

function filterTiles(input: { document: MapDocument; hiddenRoomIds: Set<string>; rooms: RoomNode[] }): MapTile[] {
  if (input.hiddenRoomIds.size === 0) {
    return input.document.tiles;
  }

  const hiddenCells = new Set<string>();

  for (const room of input.rooms) {
    if (!input.hiddenRoomIds.has(room.id)) {
      continue;
    }

    const startX = Math.max(0, Math.floor(room.bounds.x));
    const startY = Math.max(0, Math.floor(room.bounds.y));
    const endX = Math.min(input.document.width, Math.ceil(room.bounds.x + room.bounds.width));
    const endY = Math.min(input.document.height, Math.ceil(room.bounds.y + room.bounds.height));

    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        hiddenCells.add(`${x},${y}`);
      }
    }
  }

  return input.document.tiles.map((tile) => {
    if (hiddenCells.has(`${tile.x},${tile.y}`) && tile.kind !== "wall") {
      return { ...tile, kind: "empty" as MapTile["kind"] };
    }

    return tile;
  });
}

function filterAssets(
  assets: PlacedAsset[],
  hiddenRoomIds: Set<string>,
  rooms: RoomNode[],
  mode: MapVisibilityMode
): PlacedAsset[] {
  return assets.filter((asset) => {
    if (asset.layer === "annotation") {
      return false;
    }

    if (mode === "clean" && asset.layer === "lighting") {
      return true;
    }

    if (asset.tags.some((tag) => HIDDEN_TAG_PATTERNS.some((pattern) => pattern.test(tag)))) {
      return false;
    }

    if (hiddenRoomIds.size > 0 && isAssetInsideHiddenRoom(asset, rooms, hiddenRoomIds)) {
      return false;
    }

    return true;
  });
}

function isAssetInsideHiddenRoom(asset: PlacedAsset, rooms: RoomNode[], hiddenRoomIds: Set<string>): boolean {
  for (const room of rooms) {
    if (!hiddenRoomIds.has(room.id)) {
      continue;
    }

    if (
      asset.position.x >= room.bounds.x &&
      asset.position.x < room.bounds.x + room.bounds.width &&
      asset.position.y >= room.bounds.y &&
      asset.position.y < room.bounds.y + room.bounds.height
    ) {
      return true;
    }
  }

  return false;
}

function filterPlan(plan: MapPlan, hiddenRoomIds: Set<string>, mode: MapVisibilityMode): MapPlan {
  const visibleRooms = plan.rooms.filter((room) => !hiddenRoomIds.has(room.id));
  const visibleRoomIds = new Set(visibleRooms.map((room) => room.id));
  const cleanedRooms = visibleRooms.map((room) => ({
    ...room,
    connections: room.connections.filter((connection) => visibleRoomIds.has(connection))
  }));
  const visibleDoors = plan.doors.filter((door: DoorSegment) => isVisibleSegment(door.roomIds, hiddenRoomIds));
  const visibleWalls = plan.walls.filter((wall: WallSegment) => isVisibleSegment(wall.roomIds, hiddenRoomIds));
  const visibleLights = plan.lights.filter((light: LightSource) => !isSecretId(light.id));
  const visiblePlacements = filterAssets(plan.assetPlacements, hiddenRoomIds, plan.rooms, mode);

  return {
    ...plan,
    assetPlacements: visiblePlacements,
    doors: visibleDoors,
    lights: visibleLights,
    notes: mode === "clean" ? [] : plan.notes.filter((note) => !isGmNote(note)),
    rooms: cleanedRooms,
    walls: visibleWalls
  };
}

function isVisibleSegment(roomIds: string[], hiddenRoomIds: Set<string>): boolean {
  if (roomIds.length === 0) {
    return true;
  }

  return roomIds.some((id) => !hiddenRoomIds.has(id));
}

function isSecretId(id: string): boolean {
  return /secret|gm[-_]?only|hidden/iu.test(id);
}

function isGmNote(note: string): boolean {
  if (/player[-_]?safe/iu.test(note)) {
    return false;
  }

  return /\b(gm|spoiler|secret|hidden|trap)\b/iu.test(note);
}
