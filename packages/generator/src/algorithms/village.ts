import type {
  DoorSegment,
  MapDocument,
  RoomNode,
  TileKind
} from "@dm-instamap/core";
import {
  buildMapDocument,
  carveCorridor,
  createRandom,
  setTile,
  toTitle,
  unique
} from "./shared";

export type VillageMapOptions = {
  blockCount?: number;
  heightCells: number;
  seed?: number | string;
  theme?: string;
  widthCells: number;
};

export function generateVillageMap(options: VillageMapOptions): MapDocument {
  const width = Math.max(20, Math.floor(options.widthCells));
  const height = Math.max(20, Math.floor(options.heightCells));
  const blockCount = Math.max(
    3,
    Math.min(24, Math.floor(options.blockCount ?? 6))
  );
  const rng = createRandom(options.seed ?? "village");
  const grid: TileKind[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => "floor" as TileKind)
  );
  const blocks = subdivideBlocks({ width, height }, blockCount, rng);
  const buildings: Array<{
    bounds: { x: number; y: number; width: number; height: number };
    id: string;
    label: string;
  }> = [];
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
        const isWall =
          x === bx || y === by || x === bx + bw - 1 || y === by + bh - 1;
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

    buildings.push({
      bounds: { height: bh, width: bw, x: bx, y: by },
      id,
      label
    });
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
  ensureBuildingsConnected(grid, rooms, width, height);

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

function isWalkableCell(grid: TileKind[][], x: number, y: number): boolean {
  const kind = grid[y]?.[x];
  return kind === "floor" || kind === "door";
}

function largestWalkableComponent(
  grid: TileKind[][],
  width: number,
  height: number
): Set<string> {
  const visited = new Set<string>();
  let best = new Set<string>();

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isWalkableCell(grid, x, y) || visited.has(`${x},${y}`)) {
        continue;
      }

      const component = new Set<string>();
      const stack: Array<[number, number]> = [[x, y]];

      while (stack.length > 0) {
        const cell = stack.pop();
        if (!cell) {
          continue;
        }
        const [cx, cy] = cell;
        const cellKey = `${cx},${cy}`;
        if (visited.has(cellKey)) {
          continue;
        }
        visited.add(cellKey);
        component.add(cellKey);

        for (const [nx, ny] of [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1]
        ] as Array<[number, number]>) {
          if (isWalkableCell(grid, nx, ny) && !visited.has(`${nx},${ny}`)) {
            stack.push([nx, ny]);
          }
        }
      }

      if (component.size > best.size) {
        best = component;
      }
    }
  }

  return best;
}

function findInteriorFloorCell(
  grid: TileKind[][],
  bounds: { height: number; width: number; x: number; y: number }
): { x: number; y: number } | null {
  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      if (grid[y]?.[x] === "floor") {
        return { x, y };
      }
    }
  }

  return null;
}

/**
 * Guarantees every building is reachable from the main street network: any
 * building interior not in the largest walkable component gets a carved
 * corridor to it (an alley), so no building is left enclosed.
 */
function ensureBuildingsConnected(
  grid: TileKind[][],
  rooms: RoomNode[],
  width: number,
  height: number
): void {
  const main = largestWalkableComponent(grid, width, height);
  const targetKey = main.values().next().value;

  if (!targetKey) {
    return;
  }

  const [tx, ty] = targetKey.split(",").map(Number) as [number, number];

  for (const room of rooms) {
    const interior = findInteriorFloorCell(grid, room.bounds);
    if (!interior || main.has(`${interior.x},${interior.y}`)) {
      continue;
    }
    carveCorridor(grid, interior, { x: tx, y: ty });
  }
}

function subdivideBlocks(
  area: { width: number; height: number },
  blockCount: number,
  rng: () => number
): Array<{ height: number; width: number; x: number; y: number }> {
  const blocks: Array<{ height: number; width: number; x: number; y: number }> =
    [{ height: area.height, width: area.width, x: 0, y: 0 }];

  while (blocks.length < blockCount) {
    blocks.sort(
      (left, right) => right.width * right.height - left.width * left.height
    );
    const target = blocks.shift();

    if (!target || (target.width < 8 && target.height < 8)) {
      if (target) {
        blocks.push(target);
      }
      break;
    }

    const splitVertical =
      target.width >= target.height ? rng() < 0.7 : rng() < 0.3;

    if (splitVertical && target.width >= 8) {
      const splitAt = Math.max(
        4,
        Math.floor(target.width * (0.35 + rng() * 0.3))
      );
      blocks.push({
        height: target.height,
        width: splitAt,
        x: target.x,
        y: target.y
      });
      blocks.push({
        height: target.height,
        width: target.width - splitAt,
        x: target.x + splitAt,
        y: target.y
      });
    } else if (target.height >= 8) {
      const splitAt = Math.max(
        4,
        Math.floor(target.height * (0.35 + rng() * 0.3))
      );
      blocks.push({
        height: splitAt,
        width: target.width,
        x: target.x,
        y: target.y
      });
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
