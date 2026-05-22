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

export type OutdoorMapOptions = {
  heightCells: number;
  river?: boolean;
  seed?: number | string;
  theme?: string;
  treeDensity?: number;
  widthCells: number;
};

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

function scatterTreesPoisson(
  grid: TileKind[][],
  density: number,
  rng: () => number
): void {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const targetCount = Math.floor(width * height * density);
  const minDistance = Math.max(
    1,
    Math.floor(Math.sqrt(1 / Math.max(density, 0.05)))
  );
  const placed: Array<{ x: number; y: number }> = [];
  let attempts = 0;
  const maxAttempts = targetCount * 30;

  while (placed.length < targetCount && attempts < maxAttempts) {
    attempts += 1;
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    const collision = placed.some(
      (point) =>
        Math.abs(point.x - x) < minDistance &&
        Math.abs(point.y - y) < minDistance
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
  const baseLine = Math.floor(
    (horizontal ? height : width) * (0.3 + rng() * 0.4)
  );
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
      setTile(
        grid,
        horizontal ? step : main - 1,
        horizontal ? main - 1 : step,
        "wall"
      );
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
