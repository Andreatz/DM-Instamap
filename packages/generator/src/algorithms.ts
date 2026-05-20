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

export type CaveDungeonOptions = {
  fillProbability?: number;
  heightCells: number;
  iterations?: number;
  seed?: number | string;
  theme?: string;
  widthCells: number;
};

export type VillageMapOptions = {
  blockCount?: number;
  heightCells: number;
  seed?: number | string;
  theme?: string;
  widthCells: number;
};

export type MultiFloorDungeonOptions = {
  floorCount: number;
  heightCells: number;
  perFloorRoomCount?: number;
  seed?: number | string;
  theme?: string;
  widthCells: number;
};

export type OutdoorMapOptions = {
  heightCells: number;
  river?: boolean;
  seed?: number | string;
  theme?: string;
  treeDensity?: number;
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

export function generateCaveDungeon(options: CaveDungeonOptions): MapDocument {
  const width = Math.max(16, Math.floor(options.widthCells));
  const height = Math.max(16, Math.floor(options.heightCells));
  const iterations = Math.max(1, Math.min(8, Math.floor(options.iterations ?? 5)));
  const fillProbability = clamp(options.fillProbability ?? 0.45, 0.3, 0.6);
  const rng = createRandom(options.seed ?? "cave");
  const grid = createCellularAutomataGrid(width, height, fillProbability, iterations, rng);
  const largest = keepLargestFloorRegion(grid);
  const entrance = pickEntranceOnEdge(largest, rng);

  if (entrance) {
    setTile(largest, entrance.x, entrance.y, "door");
  }

  const bounds = computeFloorBounds(largest);
  const roomId = "room-cave-main";
  const rooms: RoomNode[] = [
    {
      bounds,
      connections: [],
      id: roomId,
      kind: "room",
      label: "Cave Chamber",
      tags: unique([
        "cave",
        "organic",
        "natural",
        ...(options.theme ? [options.theme.toLowerCase()] : [])
      ])
    }
  ];

  if (entrance) {
    rooms.unshift({
      bounds: { height: 1, width: 1, x: entrance.x, y: entrance.y },
      connections: [roomId],
      id: "room-entrance",
      kind: "entrance",
      label: "Cave Mouth",
      tags: ["entrance", "cave", "mouth"]
    });
    rooms[1] = { ...(rooms[1] as RoomNode), connections: ["room-entrance"] };
  }

  const doors: DoorSegment[] = entrance
    ? [
        {
          id: "door-cave-entrance",
          isLocked: false,
          isOpen: true,
          position: { x: entrance.x, y: entrance.y },
          rotation: 0,
          roomIds: ["room-entrance", roomId],
          width: 1
        }
      ]
    : [];

  return buildMapDocument({
    grid: largest,
    id: "generated-cave",
    name: `${toTitle(options.theme ?? "Natural")} Cave`,
    notes: [
      `Cellular automata cave: ${iterations} iterations, fill=${fillProbability.toFixed(2)}.`
    ],
    rooms,
    doors,
    theme: options.theme ?? "cave"
  });
}

export function generateVillageMap(options: VillageMapOptions): MapDocument {
  const width = Math.max(20, Math.floor(options.widthCells));
  const height = Math.max(20, Math.floor(options.heightCells));
  const blockCount = Math.max(3, Math.min(24, Math.floor(options.blockCount ?? 6)));
  const rng = createRandom(options.seed ?? "village");
  const grid: TileKind[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => "floor" as TileKind)
  );
  const blocks = subdivideBlocks({ width, height }, blockCount, rng);
  const buildings: Array<{ bounds: { x: number; y: number; width: number; height: number }; id: string; label: string }> = [];
  const doors: DoorSegment[] = [];
  const rooms: RoomNode[] = [];

  blocks.forEach((block, index) => {
    const padding = 1;
    const bx = block.x + padding;
    const by = block.y + padding;
    const bw = Math.max(3, block.width - padding * 2);
    const bh = Math.max(3, block.height - padding * 2);

    if (bw < 3 || bh < 3) {
      return;
    }

    for (let y = by; y < by + bh; y += 1) {
      for (let x = bx; x < bx + bw; x += 1) {
        const isWall = x === bx || y === by || x === bx + bw - 1 || y === by + bh - 1;
        setTile(grid, x, y, isWall ? "wall" : "floor");
      }
    }

    const id = index === 0 ? "room-entrance" : `building-${index + 1}`;
    const label = index === 0 ? "Village Square" : `Building ${index + 1}`;
    const door = pickBuildingDoor({ bx, by, bw, bh }, rng);

    if (door) {
      setTile(grid, door.x, door.y, "door");
      doors.push({
        id: `door-building-${index + 1}`,
        isLocked: false,
        isOpen: false,
        position: { x: door.x, y: door.y },
        rotation: 0,
        roomIds: [id],
        width: 1
      });
    }

    buildings.push({ bounds: { height: bh, width: bw, x: bx, y: by }, id, label });
    rooms.push({
      bounds: { height: bh, width: bw, x: bx, y: by },
      connections: [],
      id,
      kind: index === 0 ? "entrance" : "room",
      label,
      tags: unique([
        "village",
        "building",
        ...(options.theme ? [options.theme.toLowerCase()] : []),
        index === 0 ? "square" : "interior"
      ])
    });
  });

  connectAdjacentBuildings(rooms);

  return buildMapDocument({
    grid,
    id: "generated-village",
    name: `${toTitle(options.theme ?? "Village")} Layout`,
    notes: [
      `Subdivision village: ${rooms.length} buildings, road network from open ground tiles.`
    ],
    rooms,
    doors,
    theme: options.theme ?? "village"
  });
}

export function generateMultiFloorDungeon(options: MultiFloorDungeonOptions): MultiFloorDungeon {
  const floorCount = Math.max(2, Math.min(6, Math.floor(options.floorCount)));
  const rng = createRandom(options.seed ?? "multi-floor");
  const seedString = String(options.seed ?? "multi-floor");
  const roomCount = Math.max(4, Math.min(16, Math.floor(options.perFloorRoomCount ?? 6)));
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

export function generateOutdoorMap(options: OutdoorMapOptions): MapDocument {
  const width = Math.max(16, Math.floor(options.widthCells));
  const height = Math.max(16, Math.floor(options.heightCells));
  const treeDensity = clamp(options.treeDensity ?? 0.12, 0, 0.4);
  const rng = createRandom(options.seed ?? "outdoor");
  const grid: TileKind[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => "floor" as TileKind)
  );

  scatterTreesPoisson(grid, treeDensity, rng);

  const bridges: Array<{ x: number; y: number }> = [];

  if (options.river ?? false) {
    carveRiver(grid, rng, bridges);
  }

  const clearingBounds = { height, width, x: 0, y: 0 };
  const rooms: RoomNode[] = [
    {
      bounds: { height: 1, width: 1, x: Math.floor(width / 2), y: 0 },
      connections: ["clearing-main"],
      id: "room-entrance",
      kind: "entrance",
      label: "Trail Entry",
      tags: ["entrance", "outdoor", "trail"]
    },
    {
      bounds: clearingBounds,
      connections: ["room-entrance"],
      id: "clearing-main",
      kind: "service",
      label: "Forest Clearing",
      tags: unique([
        "outdoor",
        "forest",
        "clearing",
        ...(options.river ? ["river", "water"] : []),
        ...(options.theme ? [options.theme.toLowerCase()] : [])
      ])
    }
  ];

  const doors: DoorSegment[] = bridges.map((bridge, index) => ({
    id: `bridge-${index + 1}`,
    isLocked: false,
    isOpen: true,
    position: { x: bridge.x, y: bridge.y },
    rotation: 0,
    roomIds: ["clearing-main"],
    width: 1
  }));

  return buildMapDocument({
    grid,
    id: "generated-outdoor",
    name: `${toTitle(options.theme ?? "Forest")} Outdoor`,
    notes: [
      `Outdoor terrain: tree density=${treeDensity.toFixed(2)}${options.river ? ", river with bridges" : ""}.`
    ],
    rooms,
    doors,
    theme: options.theme ?? "outdoor"
  });
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

    const id = carved.length === 0 ? "room-entrance" : `room-${input.floorIndex + 1}-${carved.length + 1}`;
    rooms.push({
      bounds: { height: roomHeight, width: roomWidth, x, y },
      connections: [],
      id,
      kind: carved.length === 0 ? "entrance" : "room",
      label: carved.length === 0 ? `Floor ${input.floorIndex + 1} Entrance` : `Floor ${input.floorIndex + 1} Room ${carved.length + 1}`,
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
    const from = carved[index] as { centerX: number; centerY: number; id: string };
    const to = carved[index + 1] as { centerX: number; centerY: number; id: string };
    carveCorridor(grid, { x: from.centerX, y: from.centerY }, { x: to.centerX, y: to.centerY });
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

function createCellularAutomataGrid(
  width: number,
  height: number,
  fillProbability: number,
  iterations: number,
  rng: () => number
): TileKind[][] {
  let grid: TileKind[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (__, x) => {
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      return (isBorder || rng() < fillProbability ? "wall" : "floor") as TileKind;
    })
  );

  for (let step = 0; step < iterations; step += 1) {
    grid = stepCellularAutomata(grid);
  }

  return grid;
}

function stepCellularAutomata(grid: TileKind[][]): TileKind[][] {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const next: TileKind[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (__, x) => grid[y]?.[x] ?? "empty")
  );

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const wallNeighbors = countWallNeighbors(grid, x, y);

      if (wallNeighbors >= 5) {
        setTile(next, x, y, "wall");
      } else if (wallNeighbors <= 3) {
        setTile(next, x, y, "floor");
      }
    }
  }

  return next;
}

function countWallNeighbors(grid: TileKind[][], x: number, y: number): number {
  let count = 0;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      if ((grid[y + dy]?.[x + dx] ?? "wall") === "wall") {
        count += 1;
      }
    }
  }

  return count;
}

function keepLargestFloorRegion(grid: TileKind[][]): TileKind[][] {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const seen: boolean[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => false));
  let bestRegion: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (seen[y]?.[x] || grid[y]?.[x] !== "floor") {
        continue;
      }

      const region = floodFillFloor(grid, seen, x, y);

      if (region.length > bestRegion.length) {
        bestRegion = region;
      }
    }
  }

  const result: TileKind[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => "wall" as TileKind)
  );

  for (const point of bestRegion) {
    setTile(result, point.x, point.y, "floor");
  }

  return result;
}

function floodFillFloor(
  grid: TileKind[][],
  seen: boolean[][],
  startX: number,
  startY: number
): Array<{ x: number; y: number }> {
  const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  const region: Array<{ x: number; y: number }> = [];

  while (stack.length > 0) {
    const point = stack.pop() as { x: number; y: number };

    if (seen[point.y]?.[point.x] || grid[point.y]?.[point.x] !== "floor") {
      continue;
    }

    (seen[point.y] as boolean[])[point.x] = true;
    region.push(point);

    stack.push({ x: point.x + 1, y: point.y });
    stack.push({ x: point.x - 1, y: point.y });
    stack.push({ x: point.x, y: point.y + 1 });
    stack.push({ x: point.x, y: point.y - 1 });
  }

  return region;
}

function pickEntranceOnEdge(grid: TileKind[][], rng: () => number): { x: number; y: number } | null {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const candidates: Array<{ x: number; y: number }> = [];

  for (let x = 1; x < width - 1; x += 1) {
    if (grid[1]?.[x] === "floor") {
      candidates.push({ x, y: 0 });
    }

    if (grid[height - 2]?.[x] === "floor") {
      candidates.push({ x, y: height - 1 });
    }
  }

  for (let y = 1; y < height - 1; y += 1) {
    if (grid[y]?.[1] === "floor") {
      candidates.push({ x: 0, y });
    }

    if (grid[y]?.[width - 2] === "floor") {
      candidates.push({ x: width - 1, y });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates[Math.floor(rng() * candidates.length)] ?? null;
}

function computeFloorBounds(grid: TileKind[][]): {
  height: number;
  width: number;
  x: number;
  y: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y] ?? [];

    for (let x = 0; x < row.length; x += 1) {
      if (row[x] !== "floor") {
        continue;
      }

      if (x < minX) {
        minX = x;
      }

      if (y < minY) {
        minY = y;
      }

      if (x > maxX) {
        maxX = x;
      }

      if (y > maxY) {
        maxY = y;
      }
    }
  }

  if (maxX < 0) {
    return { height: 1, width: 1, x: 0, y: 0 };
  }

  return { height: maxY - minY + 1, width: maxX - minX + 1, x: minX, y: minY };
}

function subdivideBlocks(
  area: { width: number; height: number },
  blockCount: number,
  rng: () => number
): Array<{ height: number; width: number; x: number; y: number }> {
  const blocks: Array<{ height: number; width: number; x: number; y: number }> = [
    { height: area.height, width: area.width, x: 0, y: 0 }
  ];

  while (blocks.length < blockCount) {
    blocks.sort((left, right) => right.width * right.height - left.width * left.height);
    const target = blocks.shift();

    if (!target || (target.width < 8 && target.height < 8)) {
      if (target) {
        blocks.push(target);
      }
      break;
    }

    const splitVertical = target.width >= target.height ? rng() < 0.7 : rng() < 0.3;

    if (splitVertical && target.width >= 8) {
      const splitAt = Math.max(4, Math.floor(target.width * (0.35 + rng() * 0.3)));
      blocks.push({ height: target.height, width: splitAt, x: target.x, y: target.y });
      blocks.push({
        height: target.height,
        width: target.width - splitAt,
        x: target.x + splitAt,
        y: target.y
      });
    } else if (target.height >= 8) {
      const splitAt = Math.max(4, Math.floor(target.height * (0.35 + rng() * 0.3)));
      blocks.push({ height: splitAt, width: target.width, x: target.x, y: target.y });
      blocks.push({
        height: target.height - splitAt,
        width: target.width,
        x: target.x,
        y: target.y + splitAt
      });
    } else {
      blocks.push(target);
      break;
    }
  }

  return blocks;
}

function pickBuildingDoor(
  block: { bx: number; by: number; bw: number; bh: number },
  rng: () => number
): { x: number; y: number } | null {
  const sides: Array<{ x: number; y: number }> = [
    { x: block.bx + Math.floor(block.bw / 2), y: block.by },
    { x: block.bx + Math.floor(block.bw / 2), y: block.by + block.bh - 1 },
    { x: block.bx, y: block.by + Math.floor(block.bh / 2) },
    { x: block.bx + block.bw - 1, y: block.by + Math.floor(block.bh / 2) }
  ];

  return sides[Math.floor(rng() * sides.length)] ?? null;
}

function connectAdjacentBuildings(rooms: RoomNode[]): void {
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const left = rooms[i] as RoomNode;
      const right = rooms[j] as RoomNode;

      if (areBlocksAdjacent(left.bounds, right.bounds)) {
        left.connections = unique([...left.connections, right.id]);
        right.connections = unique([...right.connections, left.id]);
      }
    }
  }
}

function areBlocksAdjacent(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
): boolean {
  const horizontalTouch =
    (left.x + left.width === right.x || right.x + right.width === left.x) &&
    left.y < right.y + right.height &&
    right.y < left.y + left.height;
  const verticalTouch =
    (left.y + left.height === right.y || right.y + right.height === left.y) &&
    left.x < right.x + right.width &&
    right.x < left.x + left.width;
  return horizontalTouch || verticalTouch;
}

function pickStairsHostRoom(document: MapDocument, rng: () => number, direction: "up" | "down"): RoomNode | null {
  const candidates = (document.plan?.rooms ?? []).filter((room) => room.kind === "room");

  if (candidates.length === 0) {
    return (document.plan?.rooms ?? []).find((room) => room.kind === "entrance") ?? null;
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

function scatterTreesPoisson(grid: TileKind[][], density: number, rng: () => number): void {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const targetCount = Math.floor(width * height * density);
  const minDistance = Math.max(1, Math.floor(Math.sqrt(1 / Math.max(density, 0.05))));
  const placed: Array<{ x: number; y: number }> = [];
  let attempts = 0;
  const maxAttempts = targetCount * 30;

  while (placed.length < targetCount && attempts < maxAttempts) {
    attempts += 1;
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    const collision = placed.some(
      (point) => Math.abs(point.x - x) < minDistance && Math.abs(point.y - y) < minDistance
    );

    if (collision) {
      continue;
    }

    placed.push({ x, y });
    setTile(grid, x, y, "wall");
  }
}

function carveRiver(
  grid: TileKind[][],
  rng: () => number,
  bridges: Array<{ x: number; y: number }>
): void {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const horizontal = rng() < 0.5;
  const baseLine = Math.floor((horizontal ? height : width) * (0.3 + rng() * 0.4));
  const length = horizontal ? width : height;
  let drift = 0;

  for (let step = 0; step < length; step += 1) {
    drift += Math.floor((rng() - 0.5) * 2);
    const offset = Math.max(-3, Math.min(3, drift));
    const main = baseLine + offset;
    const x = horizontal ? step : main;
    const y = horizontal ? main : step;
    setTile(grid, x, y, "wall");

    if (main - 1 >= 0 && rng() < 0.5) {
      setTile(grid, horizontal ? step : main - 1, horizontal ? main - 1 : step, "wall");
    }
  }

  const bridgeCount = 1 + Math.floor(rng() * 2);

  for (let index = 0; index < bridgeCount; index += 1) {
    const at = Math.floor((length / (bridgeCount + 1)) * (index + 1));
    const x = horizontal ? at : baseLine;
    const y = horizontal ? baseLine : at;
    setTile(grid, x, y, "door");
    bridges.push({ x, y });
  }
}

function buildMapDocument(input: {
  doors: DoorSegment[];
  grid: TileKind[][];
  id: string;
  name: string;
  notes: string[];
  rooms: RoomNode[];
  theme: string;
}): MapDocument {
  const height = input.grid.length;
  const width = input.grid[0]?.length ?? 0;
  const tiles: MapTile[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push({
        id: `tile-${x}-${y}`,
        kind: input.grid[y]?.[x] ?? "empty",
        x,
        y
      });
    }
  }

  const walls = collectWallSegments(input.grid);
  const plan: MapPlan = {
    assetPlacements: [],
    doors: input.doors,
    gmNotes: [],
    id: `plan-${input.id}`,
    initiative: [],
    lights: [],
    name: `${input.name} Plan`,
    notes: input.notes,
    requestId: `request-${input.id}`,
    rooms: input.rooms,
    walls
  };

  return createMapDocument({
    grid: {
      cellSize: 5,
      height,
      pixelsPerCell: 70,
      type: "square",
      unit: "ft",
      width
    },
    height,
    id: input.id,
    name: input.name,
    plan,
    tiles,
    width
  });
}

function collectWallSegments(grid: TileKind[][]): WallSegment[] {
  const walls: WallSegment[] = [];
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  for (let y = 0; y < height; y += 1) {
    let startX: number | null = null;

    for (let x = 0; x <= width; x += 1) {
      const isWall = grid[y]?.[x] === "wall";

      if (isWall && startX === null) {
        startX = x;
      }

      if ((!isWall || x === width) && startX !== null) {
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

function addPerimeterWalls(grid: TileKind[][]): void {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const targets: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (grid[y]?.[x] !== "empty") {
        continue;
      }

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }

          const neighbor = grid[y + dy]?.[x + dx];

          if (neighbor === "floor" || neighbor === "door") {
            targets.push({ x, y });
            dy = 2;
            dx = 2;
          }
        }
      }
    }
  }

  for (const target of targets) {
    setTile(grid, target.x, target.y, "wall");
  }
}

function carveCorridor(
  grid: TileKind[][],
  from: { x: number; y: number },
  to: { x: number; y: number }
): void {
  const xStep = from.x <= to.x ? 1 : -1;
  const yStep = from.y <= to.y ? 1 : -1;

  for (let x = from.x; x !== to.x + xStep; x += xStep) {
    setTile(grid, x, from.y, "floor");
  }

  for (let y = from.y; y !== to.y + yStep; y += yStep) {
    setTile(grid, to.x, y, "floor");
  }
}

function isAreaOccupied(grid: TileKind[][], x: number, y: number, width: number, height: number): boolean {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      if (grid[yy]?.[xx] === "floor") {
        return true;
      }
    }
  }

  return false;
}

function setTile(grid: TileKind[][], x: number, y: number, kind: TileKind): void {
  if (!grid[y] || grid[y]?.[x] === undefined) {
    return;
  }

  (grid[y] as TileKind[])[x] = kind;
}

function createRandom(seed: number | string): () => number {
  const numericSeed = typeof seed === "number" ? seed : hashString(seed);
  let state = numericSeed >>> 0;

  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
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
