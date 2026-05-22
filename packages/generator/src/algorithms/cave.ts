import type {
  DoorSegment,
  MapDocument,
  RoomNode,
  TileKind
} from "@dm-instamap/core";
import {
  buildMapDocument,
  clamp,
  createRandom,
  setTile,
  toTitle,
  unique
} from "./shared";

export type CaveDungeonOptions = {
  fillProbability?: number;
  heightCells: number;
  iterations?: number;
  seed?: number | string;
  theme?: string;
  widthCells: number;
};

export function generateCaveDungeon(options: CaveDungeonOptions): MapDocument {
  const width = Math.max(16, Math.floor(options.widthCells));
  const height = Math.max(16, Math.floor(options.heightCells));
  const iterations = Math.max(
    1,
    Math.min(8, Math.floor(options.iterations ?? 5))
  );
  const fillProbability = clamp(options.fillProbability ?? 0.45, 0.3, 0.6);
  const rng = createRandom(options.seed ?? "cave");
  const grid = createCellularAutomataGrid(
    width,
    height,
    fillProbability,
    iterations,
    rng
  );
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

function createCellularAutomataGrid(
  width: number,
  height: number,
  fillProbability: number,
  iterations: number,
  rng: () => number
): TileKind[][] {
  let grid: TileKind[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (__, x) => {
      const isBorder =
        x === 0 || y === 0 || x === width - 1 || y === height - 1;
      return (
        isBorder || rng() < fillProbability ? "wall" : "floor"
      ) as TileKind;
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
  const seen: boolean[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => false)
  );
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

function pickEntranceOnEdge(
  grid: TileKind[][],
  rng: () => number
): { x: number; y: number } | null {
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
