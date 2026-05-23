import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createMapDocument,
  type DoorSegment,
  type LightSource,
  type MapDocument,
  type MapPlan,
  type MapTile,
  type Point,
  type WallSegment
} from "@dm-instamap/core/browser";
import type { AssetResolver } from "./asset-resolver";
import { exportMapDocumentRaster } from "./raster";

export type Dd2VttImportOptions = {
  id?: string;
  name?: string;
};

export type Dd2VttEmbeddedImage = {
  buffer: Buffer;
  contentType: string;
  extension: string;
};

export type Dd2VttImportResult = {
  document: MapDocument;
  image: Dd2VttEmbeddedImage | null;
  metadata: {
    format: string | number | null;
    pixelsPerGrid: number;
    source: "universal-vtt";
  };
};

export type Dd2VttExportOptions = {
  assetResolver?: AssetResolver;
  embedImage?: boolean;
  imageFormat?: "png" | "webp";
  includeGrid?: boolean;
  scale?: number;
};

export type Dd2VttExportResult = {
  json: string;
  object: Dd2VttExportObject;
};

export type Dd2VttExportObject = {
  format: 0.3;
  image?: string;
  lights: Array<{
    color: string;
    intensity: number;
    position: Point;
    range: number;
  }>;
  line_of_sight: Point[][];
  portals: Array<{
    bounds: Point[];
    closed: boolean;
    position: Point;
    rotation: number;
    width: number;
  }>;
  resolution: {
    image_size: {
      x: number;
      y: number;
    };
    map_origin: {
      x: number;
      y: number;
    };
    map_size: {
      x: number;
      y: number;
    };
    pixels_per_grid: number;
  };
};

type RawDd2Vtt = {
  format?: unknown;
  grid?: unknown;
  image?: unknown;
  imageData?: unknown;
  lights?: unknown;
  line_of_sight?: unknown;
  lineOfSight?: unknown;
  map?: unknown;
  mapImage?: unknown;
  portals?: unknown;
  resolution?: unknown;
  walls?: unknown;
};

type RawPoint = {
  x?: unknown;
  y?: unknown;
};

type RawPortal = {
  bounds?: unknown;
  closed?: unknown;
  isOpen?: unknown;
  position?: unknown;
  rotation?: unknown;
  width?: unknown;
};

type RawLight = {
  color?: unknown;
  intensity?: unknown;
  position?: unknown;
  range?: unknown;
  radius?: unknown;
};

const DEFAULT_PIXELS_PER_GRID = 70;

/**
 * Upper bound on each grid dimension when importing untrusted dd2vtt files.
 * Without it a malformed `map_size` (e.g. 1e9 x 1e9) would make
 * `createImportedTiles` try to allocate billions of tiles and crash the
 * process. Real Universal VTT exports are at most a few hundred cells per side.
 */
const MAX_IMPORT_GRID_DIMENSION = 1024;

export async function exportMapDocumentDd2Vtt(
  document: MapDocument,
  options: Dd2VttExportOptions = {}
): Promise<Dd2VttExportResult> {
  const userScale = options.scale && options.scale > 0 ? options.scale : 1;
  // Universal VTT requires the embedded image to be exactly pixels_per_grid per
  // cell. Render the battlemap at the document grid resolution (scaled) and let
  // the actual image dimensions drive pixels_per_grid so the grid lines up.
  const targetPixelsPerGrid = Math.max(
    1,
    Math.round(document.grid.pixelsPerCell * userScale)
  );
  const walls = document.plan?.walls.length
    ? document.plan.walls
    : createWallsFromTiles(document.tiles);

  let pixelsPerGrid = targetPixelsPerGrid;
  let imageWidth = document.width * targetPixelsPerGrid;
  let imageHeight = document.height * targetPixelsPerGrid;
  let imageDataUrl: string | undefined;

  if (options.embedImage ?? true) {
    const image = await exportMapDocumentRaster(document, {
      assetResolver: options.assetResolver,
      cellPixels: targetPixelsPerGrid,
      format: options.imageFormat ?? "png",
      includeGrid: options.includeGrid ?? false
    });
    imageWidth = image.width;
    imageHeight = image.height;
    pixelsPerGrid = Math.max(
      1,
      Math.round(image.width / Math.max(1, document.width))
    );
    imageDataUrl = `data:${image.contentType};base64,${image.buffer.toString("base64")}`;
  }

  const object: Dd2VttExportObject = {
    format: 0.3,
    lights: (document.plan?.lights ?? []).map((light) => ({
      color: light.color,
      intensity: light.intensity,
      position: light.position,
      range: light.radius
    })),
    line_of_sight: walls.map((wall) => [wall.start, wall.end]),
    portals: (document.plan?.doors ?? []).map((door) => {
      const bounds = createDoorBounds(door);
      return {
        bounds,
        closed: !door.isOpen,
        position: door.position,
        rotation: door.rotation,
        width: door.width
      };
    }),
    resolution: {
      image_size: {
        x: imageWidth,
        y: imageHeight
      },
      map_origin: {
        x: document.grid.origin.x,
        y: document.grid.origin.y
      },
      map_size: {
        x: document.width,
        y: document.height
      },
      pixels_per_grid: pixelsPerGrid
    }
  };

  if (imageDataUrl) {
    object.image = imageDataUrl;
  }

  return {
    json: `${JSON.stringify(object, null, 2)}\n`,
    object
  };
}

function createDoorBounds(door: DoorSegment): Point[] {
  const halfWidth = door.width / 2;
  const radians = (door.rotation * Math.PI) / 180;
  const dx = Math.cos(radians) * halfWidth;
  const dy = Math.sin(radians) * halfWidth;

  return [
    {
      x: roundCoordinate(door.position.x - dx),
      y: roundCoordinate(door.position.y - dy)
    },
    {
      x: roundCoordinate(door.position.x + dx),
      y: roundCoordinate(door.position.y + dy)
    }
  ];
}

function createWallsFromTiles(tiles: MapTile[]): WallSegment[] {
  const wallTiles = new Set(
    tiles
      .filter((tile) => tile.kind === "wall")
      .map((tile) => `${tile.x},${tile.y}`)
  );
  const segments: WallSegment[] = [];

  for (const tile of tiles) {
    if (tile.kind !== "wall") {
      continue;
    }

    const edges = [
      {
        adjacent: `${tile.x},${tile.y - 1}`,
        end: { x: tile.x + 1, y: tile.y },
        start: { x: tile.x, y: tile.y }
      },
      {
        adjacent: `${tile.x + 1},${tile.y}`,
        end: { x: tile.x + 1, y: tile.y + 1 },
        start: { x: tile.x + 1, y: tile.y }
      },
      {
        adjacent: `${tile.x},${tile.y + 1}`,
        end: { x: tile.x + 1, y: tile.y + 1 },
        start: { x: tile.x, y: tile.y + 1 }
      },
      {
        adjacent: `${tile.x - 1},${tile.y}`,
        end: { x: tile.x, y: tile.y + 1 },
        start: { x: tile.x, y: tile.y }
      }
    ];

    for (const edge of edges) {
      if (wallTiles.has(edge.adjacent)) {
        continue;
      }

      segments.push({
        blocksMovement: true,
        end: edge.end,
        id: `tile-wall-${segments.length + 1}`,
        roomIds: [],
        start: edge.start,
        thickness: 1
      });
    }
  }

  return segments;
}

export async function importDd2VttFile(
  filePath: string,
  options: Dd2VttImportOptions = {}
): Promise<Dd2VttImportResult> {
  const raw = await readFile(filePath, "utf8");
  return importDd2Vtt(raw, {
    id: options.id,
    name: options.name ?? path.basename(filePath, path.extname(filePath))
  });
}

export function importDd2Vtt(
  input: string | Buffer | unknown,
  options: Dd2VttImportOptions = {}
): Dd2VttImportResult {
  const source = parseDd2VttInput(input);
  const resolution = readResolution(source);
  const documentId = slugify(options.id ?? options.name ?? "imported-dd2vtt");
  const documentName = options.name ?? "Imported dd2vtt Map";
  const walls = readWalls(source);
  const doors = readDoors(source);
  const lights = readLights(source);
  const tiles = createImportedTiles(resolution.width, resolution.height);
  const plan: MapPlan = {
    assetPlacements: [],
    doors,
    gmNotes: [],
    id: `${documentId}-plan`,
    initiative: [],
    lights,
    name: `${documentName} Plan`,
    notes: ["Imported from Universal VTT / dd2vtt."],
    requestId: "dd2vtt-import",
    rooms: [],
    walls
  };
  const document = createMapDocument({
    grid: {
      cellSize: 5,
      height: resolution.height,
      pixelsPerCell: resolution.pixelsPerGrid,
      type: "square",
      unit: "ft",
      width: resolution.width
    },
    height: resolution.height,
    id: documentId,
    name: documentName,
    plan,
    tiles,
    width: resolution.width
  });

  return {
    document,
    image: extractEmbeddedImage(source),
    metadata: {
      format:
        typeof source.format === "string" || typeof source.format === "number"
          ? source.format
          : null,
      pixelsPerGrid: resolution.pixelsPerGrid,
      source: "universal-vtt"
    }
  };
}

function parseDd2VttInput(input: string | Buffer | unknown): RawDd2Vtt {
  if (Buffer.isBuffer(input)) {
    return parseDd2VttInput(input.toString("utf8"));
  }

  if (typeof input === "string") {
    const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      throw new Error(`dd2vtt input is not valid JSON: ${reason}`);
    }

    return parseDd2VttInput(parsed);
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("dd2vtt input must be a JSON object.");
  }

  return input as RawDd2Vtt;
}

function readResolution(source: RawDd2Vtt): {
  height: number;
  pixelsPerGrid: number;
  width: number;
} {
  const resolution = readObject(source.resolution) ?? {};
  const grid = readObject(source.grid) ?? {};
  const map = readObject(source.map) ?? {};
  const mapSize =
    readObject(resolution.map_size) ??
    readObject(resolution.mapSize) ??
    readObject(map.size) ??
    {};
  const pixelSize =
    readObject(resolution.image_size) ?? readObject(resolution.imageSize) ?? {};
  const pixelsPerGrid =
    readPositiveNumber(resolution.pixels_per_grid) ??
    readPositiveNumber(resolution.pixelsPerGrid) ??
    readPositiveNumber(grid.pixelsPerGrid) ??
    readPositiveNumber(grid.size) ??
    DEFAULT_PIXELS_PER_GRID;
  const widthCells =
    readPositiveNumber(mapSize.x) ??
    readPositiveNumber(mapSize.width) ??
    (readPositiveNumber(pixelSize.x)
      ? Math.ceil((readPositiveNumber(pixelSize.x) as number) / pixelsPerGrid)
      : null) ??
    1;
  const heightCells =
    readPositiveNumber(mapSize.y) ??
    readPositiveNumber(mapSize.height) ??
    (readPositiveNumber(pixelSize.y)
      ? Math.ceil((readPositiveNumber(pixelSize.y) as number) / pixelsPerGrid)
      : null) ??
    1;

  return {
    height: clampGridDimension(heightCells),
    pixelsPerGrid: Math.max(1, Math.round(pixelsPerGrid)),
    width: clampGridDimension(widthCells)
  };
}

function clampGridDimension(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(MAX_IMPORT_GRID_DIMENSION, Math.max(1, Math.ceil(value)));
}

function readWalls(source: RawDd2Vtt): WallSegment[] {
  const wallShapes = readArray(
    source.line_of_sight ?? source.lineOfSight ?? source.walls
  );
  const walls: WallSegment[] = [];

  for (const shape of wallShapes) {
    const points = readPointList(shape);

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index] as Point;
      const end = points[index + 1] as Point;

      if (samePoint(start, end)) {
        continue;
      }

      walls.push({
        blocksMovement: true,
        end,
        id: `wall-${walls.length + 1}`,
        roomIds: [],
        start,
        thickness: 1
      });
    }
  }

  return walls;
}

function readDoors(source: RawDd2Vtt): DoorSegment[] {
  return readArray(source.portals).flatMap((portal, index) => {
    if (!portal || typeof portal !== "object") {
      return [];
    }

    const input = portal as RawPortal;
    const bounds = readPointList(input.bounds);
    const position = readPoint(input.position) ?? midpoint(bounds) ?? null;

    if (!position) {
      return [];
    }

    const width =
      readPositiveNumber(input.width) ??
      (bounds.length >= 2
        ? distance(bounds[0] as Point, bounds[1] as Point)
        : 1);

    return [
      {
        id: `door-${index + 1}`,
        isLocked: false,
        isOpen: readOpenState(input),
        position,
        rotation: readFiniteNumber(input.rotation) ?? 0,
        roomIds: [],
        width: Math.max(0.25, width)
      }
    ];
  });
}

function readLights(source: RawDd2Vtt): LightSource[] {
  return readArray(source.lights).flatMap((light, index) => {
    if (!light || typeof light !== "object") {
      return [];
    }

    const input = light as RawLight;
    const position = readPoint(input.position);

    if (!position) {
      return [];
    }

    return [
      {
        color: readHexColor(input.color) ?? "#ffcc88",
        flicker: false,
        id: `light-${index + 1}`,
        intensity: clamp(readFiniteNumber(input.intensity) ?? 0.75, 0, 1),
        kind: "ambient",
        position,
        radius: Math.max(
          0.5,
          readPositiveNumber(input.range) ??
            readPositiveNumber(input.radius) ??
            6
        )
      }
    ];
  });
}

function extractEmbeddedImage(source: RawDd2Vtt): Dd2VttEmbeddedImage | null {
  const imageValue =
    readString(source.image) ||
    readString(source.imageData) ||
    readString(source.mapImage);

  if (!imageValue) {
    return null;
  }

  const parsed = parseImageData(imageValue);

  if (!parsed) {
    return null;
  }

  return parsed;
}

function parseImageData(value: string): Dd2VttEmbeddedImage | null {
  const dataUrlMatch = value.match(/^data:([^;,]+);base64,(.+)$/su);
  const contentType = dataUrlMatch?.[1] ?? "image/png";
  const payload = dataUrlMatch?.[2] ?? value;

  try {
    const buffer = Buffer.from(payload.replace(/\s+/gu, ""), "base64");

    if (buffer.byteLength === 0) {
      return null;
    }

    return {
      buffer,
      contentType,
      extension: imageExtension(contentType, buffer)
    };
  } catch {
    return null;
  }
}

function createImportedTiles(width: number, height: number): MapTile[] {
  const tiles: MapTile[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push({
        id: `tile-${x}-${y}`,
        kind: "floor",
        x,
        y
      });
    }
  }

  return tiles;
}

function readPointList(value: unknown): Point[] {
  if (!Array.isArray(value)) {
    return [];
  }

  if (
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    return [{ x: value[0], y: value[1] }];
  }

  return value.flatMap((entry) => {
    const point = readPoint(entry);
    return point ? [point] : [];
  });
}

function readPoint(value: unknown): Point | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = readFiniteNumber(value[0]);
    const y = readFiniteNumber(value[1]);
    return x === null || y === null ? null : { x, y };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const input = value as RawPoint;
  const x = readFiniteNumber(input.x);
  const y = readFiniteNumber(input.y);

  return x === null || y === null ? null : { x, y };
}

function midpoint(points: Point[]): Point | null {
  if (points.length === 0) {
    return null;
  }

  const sum = points.reduce(
    (total, point) => ({
      x: total.x + point.x,
      y: total.y + point.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
}

function readOpenState(input: RawPortal): boolean {
  if (typeof input.isOpen === "boolean") {
    return input.isOpen;
  }

  if (typeof input.closed === "boolean") {
    return !input.closed;
  }

  return false;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readHexColor(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/u.test(value)
    ? value
    : null;
}

function samePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
}

function distance(left: Point, right: Point): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(3));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function imageExtension(contentType: string, buffer: Buffer): string {
  if (contentType.includes("webp")) {
    return "webp";
  }

  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return "jpg";
  }

  if (buffer.subarray(0, 4).toString("ascii") === "RIFF") {
    return "webp";
  }

  if (buffer.subarray(0, 3).toString("hex") === "ffd8ff") {
    return "jpg";
  }

  return "png";
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "") || "imported-dd2vtt"
  );
}
