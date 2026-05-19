import sharp from "sharp";
import type { MapDocument, MapTile, PlacedAsset } from "@dm-instamap/core";

export type RasterExportFormat = "png" | "webp";

export type RasterExportOptions = {
  format: RasterExportFormat;
  includeGrid?: boolean;
  scale?: number;
};

export type RasterExportResult = {
  buffer: Buffer;
  contentType: "image/png" | "image/webp";
  filename: string;
  format: RasterExportFormat;
  height: number;
  width: number;
};

const BASE_CELL_PIXELS = 28;

export async function exportMapDocumentRaster(
  document: MapDocument,
  options: RasterExportOptions
): Promise<RasterExportResult> {
  const format = options.format;
  const scale = normalizeScale(options.scale);
  const cellPixels = Math.max(8, Math.round(BASE_CELL_PIXELS * scale));
  const width = document.width * cellPixels;
  const height = document.height * cellPixels;
  const svg = renderMapDocumentSvg(document, {
    cellPixels,
    includeGrid: options.includeGrid ?? true
  });
  const pipeline = sharp(Buffer.from(svg)).resize(width, height, { fit: "fill" });
  const buffer = format === "png" ? await pipeline.png().toBuffer() : await pipeline.webp({ quality: 92 }).toBuffer();

  return {
    buffer,
    contentType: format === "png" ? "image/png" : "image/webp",
    filename: `${slugify(document.name || document.id)}.${format}`,
    format,
    height,
    width
  };
}

export function renderMapDocumentSvg(
  document: MapDocument,
  options: {
    cellPixels?: number;
    includeGrid?: boolean;
  } = {}
): string {
  const cellPixels = Math.max(1, Math.round(options.cellPixels ?? BASE_CELL_PIXELS));
  const width = document.width * cellPixels;
  const height = document.height * cellPixels;
  const tileLookup = new Map(document.tiles.map((tile) => [cellKey(tile.x, tile.y), tile]));
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#080a0b"/>`
  ];

  for (let y = 0; y < document.height; y += 1) {
    for (let x = 0; x < document.width; x += 1) {
      const tile = tileLookup.get(cellKey(x, y));
      parts.push(renderTile(tile, x, y, cellPixels));
    }
  }

  for (const door of document.plan?.doors ?? []) {
    parts.push(
      `<rect x="${door.position.x * cellPixels + cellPixels * 0.2}" y="${door.position.y * cellPixels + cellPixels * 0.2}" width="${cellPixels * 0.6}" height="${cellPixels * 0.6}" fill="#f0b84c"/>`
    );
  }

  for (const asset of document.assets) {
    parts.push(renderPlacedAsset(asset, cellPixels));
  }

  if (options.includeGrid ?? true) {
    parts.push(renderGrid(document.width, document.height, cellPixels));
  }

  parts.push("</svg>");
  return parts.join("");
}

function renderTile(tile: MapTile | undefined, x: number, y: number, cellPixels: number): string {
  const color = tileColor(tile?.kind ?? "empty");
  return `<rect x="${x * cellPixels}" y="${y * cellPixels}" width="${cellPixels}" height="${cellPixels}" fill="${color}"/>`;
}

function renderPlacedAsset(asset: PlacedAsset, cellPixels: number): string {
  const cx = asset.position.x * cellPixels + cellPixels / 2;
  const cy = asset.position.y * cellPixels + cellPixels / 2;
  const radius = cellPixels * 0.34;
  const color = asset.layer === "lighting" ? "#f5cc63" : asset.layer === "floor" ? "#6fa0a8" : "#86b38f";
  const label = escapeXml(getAssetInitial(asset.assetId));

  return [
    `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" stroke="#f7efe2" stroke-width="${Math.max(1, cellPixels * 0.05)}"/>`,
    `<text x="${cx}" y="${cy + cellPixels * 0.13}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(8, cellPixels * 0.42)}" font-weight="700" fill="#101416">${label}</text>`
  ].join("");
}

function renderGrid(widthCells: number, heightCells: number, cellPixels: number): string {
  const width = widthCells * cellPixels;
  const height = heightCells * cellPixels;
  const lines: string[] = [];

  for (let x = 0; x <= widthCells; x += 1) {
    lines.push(`<path d="M${x * cellPixels} 0V${height}" stroke="#f4efe7" stroke-opacity="0.16" stroke-width="1"/>`);
  }

  for (let y = 0; y <= heightCells; y += 1) {
    lines.push(`<path d="M0 ${y * cellPixels}H${width}" stroke="#f4efe7" stroke-opacity="0.16" stroke-width="1"/>`);
  }

  return lines.join("");
}

function tileColor(kind: MapTile["kind"] | "empty"): string {
  switch (kind) {
    case "door":
      return "#d7a447";
    case "floor":
      return "#a88d5d";
    case "wall":
      return "#394348";
    case "empty":
    default:
      return "#080a0b";
  }
}

function normalizeScale(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.min(4, Math.max(0.5, value));
}

function getAssetInitial(assetId: string): string {
  return assetId.replace(/^asset[_-]?/u, "").charAt(0).toUpperCase() || "A";
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "map";
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
