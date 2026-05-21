export function migrateV0ToV1(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const document = input as Record<string, unknown>;
  const width = readPositiveInteger(document.width, 1);
  const height = readPositiveInteger(document.height, 1);
  const grid = readObject(document.grid) ?? {};

  return {
    ...document,
    assets: Array.isArray(document.assets) ? document.assets : [],
    editable: true,
    grid: {
      cellSize: readPositiveNumber(grid.cellSize, 5),
      height: readPositiveInteger(grid.height, height),
      origin: readObject(grid.origin) ?? { x: 0, y: 0 },
      pixelsPerCell: readPositiveInteger(grid.pixelsPerCell, 70),
      type: grid.type === "square" ? "square" : "square",
      unit: grid.unit === "m" ? "m" : "ft",
      width: readPositiveInteger(grid.width, width)
    },
    height,
    layers: Array.isArray(document.layers) ? document.layers : undefined,
    tiles: Array.isArray(document.tiles) ? document.tiles : [],
    version: 1,
    width
  };
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function readPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
