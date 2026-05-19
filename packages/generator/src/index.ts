import {
  createMapDocument,
  type DoorSegment,
  type MapDocument,
  type MapPlan,
  type MapTile,
  type RoomNode,
  type TileKind,
  type WallSegment
} from "@dm-instamap/core";

export {
  autoFurnishMap,
  inferFurnishingRoomType,
  FURNISHING_DENSITIES,
  FURNISHING_ROOM_TYPES,
  type AutoFurnishOptions,
  type AutoFurnishResult,
  type FurnishingAsset,
  type FurnishingDensity,
  type FurnishingPlacementDebug,
  type FurnishingRoomType
} from "./furnishing";

export type SimpleDungeonOptions = {
  height: number;
  width: number;
};

export type DungeonGeneratorInput = {
  heightCells: number;
  requiredRooms?: string[];
  roomCount: number;
  theme?: string;
  widthCells: number;
};

type RectRoom = {
  center: { x: number; y: number };
  height: number;
  id: string;
  kind: RoomNode["kind"];
  label: string;
  tags: string[];
  width: number;
  x: number;
  y: number;
};

type DoorPlacement = {
  id: string;
  roomIds: string[];
  x: number;
  y: number;
};

export function createSimpleDungeon(options: SimpleDungeonOptions): MapDocument {
  const tiles: MapTile[] = [];

  for (let y = 0; y < options.height; y += 1) {
    for (let x = 0; x < options.width; x += 1) {
      const isBoundary =
        x === 0 || y === 0 || x === options.width - 1 || y === options.height - 1;

      tiles.push({
        id: `tile-${x}-${y}`,
        kind: isBoundary ? "wall" : "floor",
        x,
        y
      });
    }
  }

  return createMapDocument({
    height: options.height,
    id: "simple-dungeon",
    name: "Simple Dungeon",
    tiles,
    width: options.width
  });
}

export function generateDungeon(input: DungeonGeneratorInput): MapDocument {
  const widthCells = Math.max(12, Math.floor(input.widthCells));
  const heightCells = Math.max(12, Math.floor(input.heightCells));
  const requiredRooms = input.requiredRooms ?? [];
  const finalRequested = requiredRooms.some((room) => /boss|final/i.test(room));
  const minimumRooms = 1 + requiredRooms.filter((room) => !/entrance|boss|final/i.test(room)).length + (finalRequested ? 1 : 0);
  const roomCount = Math.max(1, Math.min(24, Math.max(Math.floor(input.roomCount), minimumRooms)));
  const rooms = createRooms({
    finalRequested,
    heightCells,
    requiredRooms,
    roomCount,
    theme: input.theme,
    widthCells
  });
  const tileKinds = createTileGrid(widthCells, heightCells);
  const corridorNodes: RoomNode[] = [];
  const doors: DoorPlacement[] = [];

  for (const room of rooms) {
    carveRoom(tileKinds, room);
  }

  for (let index = 0; index < rooms.length - 1; index += 1) {
    const from = rooms[index] as RectRoom;
    const to = rooms[index + 1] as RectRoom;
    const corridorId = `corridor-${index + 1}`;

    carveCorridor(tileKinds, from.center, to.center);
    const fromDoor = createDoorPlacement(from, to.center, `door-${index + 1}-a`, [from.id, corridorId]);
    const toDoor = createDoorPlacement(to, from.center, `door-${index + 1}-b`, [to.id, corridorId]);
    setTile(tileKinds, fromDoor.x, fromDoor.y, "door");
    setTile(tileKinds, toDoor.x, toDoor.y, "door");
    doors.push(fromDoor, toDoor);

    corridorNodes.push({
      bounds: createCorridorBounds(from.center, to.center),
      connections: [from.id, to.id],
      id: corridorId,
      kind: "corridor",
      label: `Corridor ${index + 1}`,
      tags: ["corridor"]
    });

    from.tags = unique([...from.tags, `connects-${to.id}`]);
    to.tags = unique([...to.tags, `connects-${from.id}`]);
  }

  addWalls(tileKinds);

  const roomNodes: RoomNode[] = rooms.map((room, index) => ({
    bounds: {
      height: room.height,
      width: room.width,
      x: room.x,
      y: room.y
    },
    connections: createRoomConnections(index, rooms.length),
    id: room.id,
    kind: room.kind,
    label: room.label,
    tags: room.tags
  }));
  const plan: MapPlan = {
    assetPlacements: [],
    doors: doors.map<DoorSegment>((door) => ({
      id: door.id,
      isLocked: false,
      isOpen: false,
      position: {
        x: door.x,
        y: door.y
      },
      rotation: 0,
      roomIds: door.roomIds,
      width: 1
    })),
    id: "plan-procedural-dungeon",
    lights: [],
    name: `${toTitle(input.theme ?? "Procedural")} Dungeon Plan`,
    notes: [
      "Generated with rectangular rooms, connecting corridors, door markers, and surrounding walls."
    ],
    requestId: "request-procedural-dungeon",
    rooms: [...roomNodes, ...corridorNodes],
    walls: createWallSegments(tileKinds)
  };

  return createMapDocument({
    grid: {
      cellSize: 5,
      height: heightCells,
      pixelsPerCell: 70,
      type: "square",
      unit: "ft",
      width: widthCells
    },
    height: heightCells,
    id: "generated-dungeon",
    name: `${toTitle(input.theme ?? "Procedural")} Dungeon`,
    plan,
    tiles: createTiles(tileKinds),
    width: widthCells
  });
}

function createRooms(input: {
  finalRequested: boolean;
  heightCells: number;
  requiredRooms: string[];
  roomCount: number;
  theme?: string;
  widthCells: number;
}): RectRoom[] {
  const columns = Math.ceil(Math.sqrt(input.roomCount));
  const rows = Math.ceil(input.roomCount / columns);
  const cellWidth = Math.max(5, Math.floor((input.widthCells - 2) / columns));
  const cellHeight = Math.max(5, Math.floor((input.heightCells - 2) / rows));
  const requiredLabels = input.requiredRooms.filter((room) => !/entrance|boss|final/i.test(room));
  const rooms: RectRoom[] = [];

  for (let index = 0; index < input.roomCount; index += 1) {
    const gridX = index % columns;
    const gridY = Math.floor(index / columns);
    const roomWidth = Math.max(3, Math.min(8, cellWidth - 2));
    const roomHeight = Math.max(3, Math.min(7, cellHeight - 2));
    const x = Math.min(
      input.widthCells - roomWidth - 2,
      Math.max(1, 1 + gridX * cellWidth + Math.floor((cellWidth - roomWidth) / 2))
    );
    const y = Math.min(
      input.heightCells - roomHeight - 2,
      Math.max(1, 1 + gridY * cellHeight + Math.floor((cellHeight - roomHeight) / 2))
    );
    const isEntrance = index === 0;
    const isFinal = input.finalRequested && index === input.roomCount - 1;
    const requiredLabel = requiredLabels[index - 1];
    const label = isEntrance
      ? "Entrance"
      : isFinal
        ? "Final Room"
        : requiredLabel
          ? toTitle(requiredLabel)
          : `Room ${index + 1}`;
    const id = isEntrance ? "room-entrance" : isFinal ? "room-final" : `room-${index + 1}`;

    rooms.push({
      center: {
        x: x + Math.floor(roomWidth / 2),
        y: y + Math.floor(roomHeight / 2)
      },
      height: roomHeight,
      id,
      kind: isEntrance ? "entrance" : "room",
      label,
      tags: unique([
        "room",
        ...(isEntrance ? ["entrance"] : []),
        ...(isFinal ? ["final", "boss"] : []),
        ...(input.theme ? [input.theme.toLowerCase()] : []),
        ...label.toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean)
      ]),
      width: roomWidth,
      x,
      y
    });
  }

  return rooms;
}

function createTileGrid(width: number, height: number): TileKind[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => "empty" as TileKind));
}

function carveRoom(tileKinds: TileKind[][], room: RectRoom): void {
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      setTile(tileKinds, x, y, "floor");
    }
  }
}

function carveCorridor(tileKinds: TileKind[][], from: { x: number; y: number }, to: { x: number; y: number }): void {
  const xStep = from.x <= to.x ? 1 : -1;
  const yStep = from.y <= to.y ? 1 : -1;

  for (let x = from.x; x !== to.x + xStep; x += xStep) {
    setTile(tileKinds, x, from.y, "floor");
  }

  for (let y = from.y; y !== to.y + yStep; y += yStep) {
    setTile(tileKinds, to.x, y, "floor");
  }
}

function createDoorPlacement(
  room: RectRoom,
  target: { x: number; y: number },
  id: string,
  roomIds: string[]
): DoorPlacement {
  if (Math.abs(target.x - room.center.x) >= Math.abs(target.y - room.center.y)) {
    return {
      id,
      roomIds,
      x: target.x >= room.center.x ? room.x + room.width - 1 : room.x,
      y: clamp(room.center.y, room.y, room.y + room.height - 1)
    };
  }

  return {
    id,
    roomIds,
    x: clamp(room.center.x, room.x, room.x + room.width - 1),
    y: target.y >= room.center.y ? room.y + room.height - 1 : room.y
  };
}

function addWalls(tileKinds: TileKind[][]): void {
  const height = tileKinds.length;
  const width = tileKinds[0]?.length ?? 0;
  const wallPositions: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (tileKinds[y]?.[x] !== "empty") {
        continue;
      }

      if (hasAdjacentWalkableTile(tileKinds, x, y)) {
        wallPositions.push({ x, y });
      }
    }
  }

  for (const position of wallPositions) {
    setTile(tileKinds, position.x, position.y, "wall");
  }
}

function hasAdjacentWalkableTile(tileKinds: TileKind[][], x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const kind = tileKinds[y + dy]?.[x + dx];

      if (kind === "floor" || kind === "door") {
        return true;
      }
    }
  }

  return false;
}

function createRoomConnections(index: number, roomCount: number): string[] {
  const connections: string[] = [];

  if (index > 0) {
    connections.push(`corridor-${index}`);
  }

  if (index < roomCount - 1) {
    connections.push(`corridor-${index + 1}`);
  }

  return connections;
}

function createCorridorBounds(from: { x: number; y: number }, to: { x: number; y: number }) {
  return {
    height: Math.max(1, Math.abs(to.y - from.y) + 1),
    width: Math.max(1, Math.abs(to.x - from.x) + 1),
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y)
  };
}

function createWallSegments(tileKinds: TileKind[][]): WallSegment[] {
  const walls: WallSegment[] = [];

  for (let y = 0; y < tileKinds.length; y += 1) {
    let startX: number | null = null;

    for (let x = 0; x <= (tileKinds[0]?.length ?? 0); x += 1) {
      const isWall = tileKinds[y]?.[x] === "wall";

      if (isWall && startX === null) {
        startX = x;
      }

      if ((!isWall || x === (tileKinds[0]?.length ?? 0)) && startX !== null) {
        walls.push({
          blocksMovement: true,
          end: { x, y },
          id: `wall-${walls.length + 1}`,
          roomIds: [],
          start: { x: startX, y },
          thickness: 1
        });
        startX = null;
      }
    }
  }

  return walls;
}

function createTiles(tileKinds: TileKind[][]): MapTile[] {
  return tileKinds.flatMap((row, y) =>
    row.map((kind, x) => ({
      id: `tile-${x}-${y}`,
      kind,
      x,
      y
    }))
  );
}

function setTile(tileKinds: TileKind[][], x: number, y: number, kind: TileKind): void {
  if (!tileKinds[y] || tileKinds[y]?.[x] === undefined) {
    return;
  }

  (tileKinds[y] as TileKind[])[x] = kind;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function toTitle(value: string): string {
  return value
    .replace(/[-_]+/gu, " ")
    .split(/\s+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
