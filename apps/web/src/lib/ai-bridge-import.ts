import {
  MapDocumentSchema,
  MapPlanSchema,
  createMapDocument,
  type MapDocument,
  type MapPlan,
  type MapTile,
  type TileKind
} from "@dm-instamap/core";

export type ImportPlanMode = "new-project" | "update-project";

export type ImportPlanResult = {
  document: MapDocument;
  dimensions: {
    height: number;
    width: number;
  };
  mode: ImportPlanMode;
};

const DEFAULT_PADDING = 2;
const MIN_DIMENSION = 12;
const MAX_DIMENSION = 96;

export function convertPlanToMapDocument(input: {
  documentId: string;
  documentName?: string;
  mode: ImportPlanMode;
  plan: MapPlan;
  source?: MapDocument | null;
}): ImportPlanResult {
  const plan = MapPlanSchema.parse(input.plan);
  const documentName = (input.documentName ?? input.source?.name ?? plan.name).trim() || "Imported Plan";

  if (input.mode === "update-project" && input.source) {
    const source = input.source;
    const tiles = buildTilesFromPlan({ height: source.height, plan, width: source.width });
    const document = MapDocumentSchema.parse({
      ...source,
      assets: plan.assetPlacements,
      id: source.id,
      name: documentName,
      plan,
      tiles,
      updatedAt: new Date().toISOString()
    });

    return {
      dimensions: { height: source.height, width: source.width },
      document,
      mode: "update-project"
    };
  }

  const dimensions = inferDimensionsFromPlan(plan);
  const tiles = buildTilesFromPlan({ height: dimensions.height, plan, width: dimensions.width });
  const document = createMapDocument({
    height: dimensions.height,
    id: input.documentId,
    name: documentName,
    plan,
    tiles,
    width: dimensions.width
  });

  return {
    dimensions,
    document: MapDocumentSchema.parse({
      ...document,
      assets: plan.assetPlacements,
      updatedAt: new Date().toISOString()
    }),
    mode: "new-project"
  };
}

export function inferDimensionsFromPlan(plan: MapPlan): { height: number; width: number } {
  let maxX = MIN_DIMENSION;
  let maxY = MIN_DIMENSION;

  for (const room of plan.rooms) {
    maxX = Math.max(maxX, Math.ceil(room.bounds.x + room.bounds.width) + DEFAULT_PADDING);
    maxY = Math.max(maxY, Math.ceil(room.bounds.y + room.bounds.height) + DEFAULT_PADDING);
  }

  for (const door of plan.doors) {
    maxX = Math.max(maxX, Math.ceil(door.position.x) + 1);
    maxY = Math.max(maxY, Math.ceil(door.position.y) + 1);
  }

  for (const wall of plan.walls) {
    maxX = Math.max(maxX, Math.ceil(wall.start.x), Math.ceil(wall.end.x)) + 1;
    maxY = Math.max(maxY, Math.ceil(wall.start.y), Math.ceil(wall.end.y)) + 1;
  }

  for (const asset of plan.assetPlacements) {
    maxX = Math.max(maxX, Math.ceil(asset.position.x) + 1);
    maxY = Math.max(maxY, Math.ceil(asset.position.y) + 1);
  }

  return {
    height: Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, maxY)),
    width: Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, maxX))
  };
}

function buildTilesFromPlan(input: { height: number; plan: MapPlan; width: number }): MapTile[] {
  const grid: TileKind[][] = Array.from({ length: input.height }, () =>
    Array.from({ length: input.width }, () => "empty" as TileKind)
  );

  for (const room of input.plan.rooms) {
    const startX = Math.max(0, Math.floor(room.bounds.x));
    const startY = Math.max(0, Math.floor(room.bounds.y));
    const endX = Math.min(input.width, Math.ceil(room.bounds.x + room.bounds.width));
    const endY = Math.min(input.height, Math.ceil(room.bounds.y + room.bounds.height));

    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        setTile(grid, x, y, "floor");
      }
    }
  }

  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      if (grid[y]?.[x] !== "empty") {
        continue;
      }

      if (hasAdjacentWalkableTile(grid, x, y)) {
        setTile(grid, x, y, "wall");
      }
    }
  }

  for (const door of input.plan.doors) {
    const x = clamp(Math.round(door.position.x), 0, input.width - 1);
    const y = clamp(Math.round(door.position.y), 0, input.height - 1);
    setTile(grid, x, y, "door");
  }

  return grid.flatMap((row, y) =>
    row.map((kind, x) => ({
      id: `tile-${x}-${y}`,
      kind,
      x,
      y
    }))
  );
}

function setTile(grid: TileKind[][], x: number, y: number, kind: TileKind): void {
  const row = grid[y];

  if (!row || row[x] === undefined) {
    return;
  }

  row[x] = kind;
}

function hasAdjacentWalkableTile(grid: TileKind[][], x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const kind = grid[y + dy]?.[x + dx];

      if (kind === "floor" || kind === "door") {
        return true;
      }
    }
  }

  return false;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
