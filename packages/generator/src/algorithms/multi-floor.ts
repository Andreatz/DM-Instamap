import type {
  DoorSegment,
  MapDocument,
  RoomNode,
  TileKind
} from "@dm-instamap/core";
import {
  addPerimeterWalls,
  buildMapDocument,
  carveCorridor,
  createRandom,
  isAreaOccupied,
  setTile,
  toTitle,
  unique
} from "./shared";

export type MultiFloorDungeonOptions = {
  floorCount: number;
  heightCells: number;
  perFloorRoomCount?: number;
  seed?: number | string;
  theme?: string;
  widthCells: number;
};

export type MultiFloorDungeon = {
  floors: MapDocument[];
  links: Array<{
    fromFloor: number;
    fromRoomId: string;
    kind: "stairs";
    toFloor: number;
    toRoomId: string;
  }>;
  seed: string;
};

export function generateMultiFloorDungeon(
  options: MultiFloorDungeonOptions
): MultiFloorDungeon {
  const floorCount = Math.max(2, Math.min(6, Math.floor(options.floorCount)));
  const rng = createRandom(options.seed ?? "multi-floor");
  const seedString = String(options.seed ?? "multi-floor");
  const roomCount = Math.max(
    4,
    Math.min(16, Math.floor(options.perFloorRoomCount ?? 6))
  );
  const floors: MapDocument[] = [];
  const links: MultiFloorDungeon["links"] = [];

  for (let floorIndex = 0; floorIndex < floorCount; floorIndex += 1) {
    const baseSeed = `${seedString}-floor-${floorIndex}`;
    const document = generateDungeonForFloor({
      floorIndex,
      heightCells: options.heightCells,
      roomCount,
      seed: baseSeed,
      theme: options.theme,
      widthCells: options.widthCells
    });
    floors.push(document);
  }

  for (let floorIndex = 0; floorIndex < floorCount - 1; floorIndex += 1) {
    const upper = floors[floorIndex];
    const lower = floors[floorIndex + 1];

    if (!upper?.plan || !lower?.plan) {
      continue;
    }

    const upperHost = pickStairsHostRoom(upper, rng, "down");
    const lowerHost = pickStairsHostRoom(lower, rng, "up");

    if (!upperHost || !lowerHost) {
      continue;
    }

    const downId = `stairs-floor-${floorIndex}-to-${floorIndex + 1}`;
    const upId = `stairs-floor-${floorIndex + 1}-to-${floorIndex}`;
    upper.plan.rooms = [
      ...upper.plan.rooms,
      {
        bounds: pickPointInRoomBounds(upperHost),
        connections: [upperHost.id],
        id: downId,
        kind: "stairs",
        label: `Stairs Down (Floor ${floorIndex + 2})`,
        tags: ["stairs", "down", `link-floor-${floorIndex + 1}`]
      }
    ];
    upperHost.connections = unique([...upperHost.connections, downId]);

    lower.plan.rooms = [
      ...lower.plan.rooms,
      {
        bounds: pickPointInRoomBounds(lowerHost),
        connections: [lowerHost.id],
        id: upId,
        kind: "stairs",
        label: `Stairs Up (Floor ${floorIndex + 1})`,
        tags: ["stairs", "up", `link-floor-${floorIndex}`]
      }
    ];
    lowerHost.connections = unique([...lowerHost.connections, upId]);

    links.push({
      fromFloor: floorIndex,
      fromRoomId: downId,
      kind: "stairs",
      toFloor: floorIndex + 1,
      toRoomId: upId
    });
  }

  return { floors, links, seed: seedString };
}

function generateDungeonForFloor(input: {
  floorIndex: number;
  heightCells: number;
  roomCount: number;
  seed: string;
  theme?: string;
  widthCells: number;
}): MapDocument {
  const width = Math.max(20, Math.floor(input.widthCells));
  const height = Math.max(20, Math.floor(input.heightCells));
  const rng = createRandom(input.seed);
  const grid: TileKind[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => "empty" as TileKind)
  );
  const rooms: RoomNode[] = [];
  const doors: DoorSegment[] = [];
  const carved: Array<{ centerX: number; centerY: number; id: string }> = [];

  for (let index = 0; index < input.roomCount; index += 1) {
    const roomWidth = 4 + Math.floor(rng() * 4);
    const roomHeight = 4 + Math.floor(rng() * 4);
    const x = 1 + Math.floor(rng() * (width - roomWidth - 2));
    const y = 1 + Math.floor(rng() * (height - roomHeight - 2));

    if (isAreaOccupied(grid, x - 1, y - 1, roomWidth + 2, roomHeight + 2)) {
      continue;
    }

    for (let yy = y; yy < y + roomHeight; yy += 1) {
      for (let xx = x; xx < x + roomWidth; xx += 1) {
        setTile(grid, xx, yy, "floor");
      }
    }

    const id =
      carved.length === 0
        ? "room-entrance"
        : `room-${input.floorIndex + 1}-${carved.length + 1}`;
    rooms.push({
      bounds: { height: roomHeight, width: roomWidth, x, y },
      connections: [],
      id,
      kind: carved.length === 0 ? "entrance" : "room",
      label:
        carved.length === 0
          ? `Floor ${input.floorIndex + 1} Entrance`
          : `Floor ${input.floorIndex + 1} Room ${carved.length + 1}`,
      tags: unique([
        "multi-floor",
        `floor-${input.floorIndex + 1}`,
        ...(input.theme ? [input.theme.toLowerCase()] : []),
        ...(carved.length === 0 ? ["entrance"] : [])
      ])
    });
    carved.push({
      centerX: x + Math.floor(roomWidth / 2),
      centerY: y + Math.floor(roomHeight / 2),
      id
    });
  }

  for (let index = 0; index < carved.length - 1; index += 1) {
    const from = carved[index] as {
      centerX: number;
      centerY: number;
      id: string;
    };
    const to = carved[index + 1] as {
      centerX: number;
      centerY: number;
      id: string;
    };
    carveCorridor(
      grid,
      { x: from.centerX, y: from.centerY },
      { x: to.centerX, y: to.centerY }
    );
    const fromRoom = rooms[index] as RoomNode;
    const toRoom = rooms[index + 1] as RoomNode;
    fromRoom.connections = unique([...fromRoom.connections, to.id]);
    toRoom.connections = unique([...toRoom.connections, from.id]);
  }

  addPerimeterWalls(grid);

  return buildMapDocument({
    grid,
    id: `generated-floor-${input.floorIndex + 1}`,
    name: `${toTitle(input.theme ?? "Procedural")} Floor ${input.floorIndex + 1}`,
    notes: [`Floor ${input.floorIndex + 1} of multi-floor dungeon.`],
    rooms,
    doors,
    theme: input.theme ?? "dungeon"
  });
}

function pickStairsHostRoom(
  document: MapDocument,
  rng: () => number,
  direction: "up" | "down"
): RoomNode | null {
  const candidates = (document.plan?.rooms ?? []).filter(
    (room) => room.kind === "room"
  );

  if (candidates.length === 0) {
    return (
      (document.plan?.rooms ?? []).find((room) => room.kind === "entrance") ??
      null
    );
  }

  if (direction === "down") {
    return candidates[candidates.length - 1] ?? null;
  }

  return candidates[Math.floor(rng() * candidates.length)] ?? null;
}

function pickPointInRoomBounds(room: RoomNode): {
  height: number;
  width: number;
  x: number;
  y: number;
} {
  return {
    height: 1,
    width: 1,
    x: room.bounds.x + Math.floor(room.bounds.width / 2),
    y: room.bounds.y + Math.floor(room.bounds.height / 2)
  };
}
