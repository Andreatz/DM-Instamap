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

export function buildMapDocument(input: {
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

export function collectWallSegments(grid: TileKind[][]): WallSegment[] {
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

export function addPerimeterWalls(grid: TileKind[][]): void {
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

export function carveCorridor(
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

export function isAreaOccupied(
  grid: TileKind[][],
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      if (grid[yy]?.[xx] === "floor") {
        return true;
      }
    }
  }

  return false;
}

export function setTile(
  grid: TileKind[][],
  x: number,
  y: number,
  kind: TileKind
): void {
  if (!grid[y] || grid[y]?.[x] === undefined) {
    return;
  }

  (grid[y] as TileKind[])[x] = kind;
}

export function createRandom(seed: number | string): () => number {
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

export function hashString(value: string): number {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function toTitle(value: string): string {
  return value
    .replace(/[-_]+/gu, " ")
    .split(/\s+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
