import JSZip from "jszip";
import sharp from "sharp";
import type {
  MapDocument,
  MapTile,
  PlacedAsset
} from "@dm-instamap/core/browser";
import type { AssetResolver, RasterAssetSource } from "./asset-resolver";

export type RasterExportFormat = "png" | "webp";
export type RasterExportLayer =
  | "floor"
  | "walls"
  | "doors"
  | "props"
  | "lighting";

export type RasterExportOptions = {
  assetResolver?: AssetResolver;
  background?: "default" | "transparent";
  /**
   * Explicit pixels-per-cell. Overrides `scale` when set. Used by the VTT
   * exporters to render the battlemap at the document's true grid resolution so
   * the embedded image lines up with `pixels_per_grid`.
   */
  cellPixels?: number;
  format: RasterExportFormat;
  includeGrid?: boolean;
  layers?: readonly RasterExportLayer[];
  filenameSuffix?: string;
  scale?: number;
  webpQuality?: number;
};

export type RasterExportResult = {
  buffer: Buffer;
  contentType: "image/png" | "image/webp";
  filename: string;
  format: RasterExportFormat;
  height: number;
  missingAssets: string[];
  usedAssets: string[];
  warnings: string[];
  width: number;
};

export type RasterLayerBundleResult = {
  buffer: Buffer;
  contentType: "application/zip";
  filename: string;
  format: RasterExportFormat;
  layers: RasterExportLayer[];
};

const BASE_CELL_PIXELS = 28;
const DEFAULT_LAYERS: RasterExportLayer[] = [
  "floor",
  "walls",
  "doors",
  "props",
  "lighting"
];

export async function exportMapDocumentRaster(
  document: MapDocument,
  options: RasterExportOptions
): Promise<RasterExportResult> {
  const format = options.format;
  const scale = normalizeScale(options.scale);
  const cellPixels =
    options.cellPixels !== undefined
      ? Math.max(8, Math.round(options.cellPixels))
      : Math.max(8, Math.round(BASE_CELL_PIXELS * scale));
  const width = document.width * cellPixels;
  const height = document.height * cellPixels;
  const assetRenderPlan = await resolveRasterAssets(document, {
    assetResolver: options.assetResolver,
    cellPixels,
    layers: options.layers
  });
  const svg = renderMapDocumentSvg(document, {
    assetMarkers: !options.assetResolver,
    background: options.background ?? "default",
    cellPixels,
    fallbackAssetIds: assetRenderPlan.missingPlacedAssetIds,
    includeGrid: options.includeGrid ?? true,
    layers: options.layers
  });
  const base = await sharp(Buffer.from(svg))
    .resize(width, height, { fit: "fill" })
    .png()
    .toBuffer();
  const compositeInputs = await buildAssetCompositeInputs(
    assetRenderPlan,
    cellPixels
  );
  const pipeline =
    compositeInputs.length > 0
      ? sharp(base).composite(compositeInputs.map((input) => input.composite))
      : sharp(base);
  const buffer =
    format === "png"
      ? await pipeline.png().toBuffer()
      : await pipeline
          .webp({ quality: normalizeWebpQuality(options.webpQuality) })
          .toBuffer();

  return {
    buffer,
    contentType: format === "png" ? "image/png" : "image/webp",
    filename: `${slugify(document.name || document.id)}${options.filenameSuffix ?? ""}.${format}`,
    format,
    height,
    missingAssets: unique(assetRenderPlan.missingAssets),
    usedAssets: unique(compositeInputs.map((input) => input.assetId)),
    warnings: assetRenderPlan.warnings,
    width
  };
}

export async function exportMapDocumentRasterLayers(
  document: MapDocument,
  options: Omit<
    RasterExportOptions,
    "background" | "filenameSuffix" | "layers"
  > & {
    layers?: readonly RasterExportLayer[];
  }
): Promise<Partial<Record<RasterExportLayer, RasterExportResult>>> {
  const requestedLayers = options.layers ?? DEFAULT_LAYERS;
  const entries = await Promise.all(
    DEFAULT_LAYERS.map(async (layer) => {
      if (!requestedLayers.includes(layer)) {
        return [layer, null] as const;
      }

      const result = await exportMapDocumentRaster(document, {
        ...options,
        background: "transparent",
        filenameSuffix: `-${layer}`,
        includeGrid: options.includeGrid ?? false,
        layers: [layer]
      });

      return [layer, result] as const;
    })
  );

  return Object.fromEntries(
    entries.filter(
      (entry): entry is [RasterExportLayer, RasterExportResult] =>
        entry[1] !== null
    )
  ) as Partial<Record<RasterExportLayer, RasterExportResult>>;
}

export async function exportMapDocumentRasterLayerBundle(
  document: MapDocument,
  options: Omit<RasterExportOptions, "background" | "filenameSuffix"> & {
    layers?: readonly RasterExportLayer[];
  }
): Promise<RasterLayerBundleResult> {
  const layers = await exportMapDocumentRasterLayers(document, options);
  const zip = new JSZip();
  const layerNames = Object.keys(layers) as RasterExportLayer[];

  for (const layer of layerNames) {
    const result = layers[layer];
    if (result) {
      zip.file(result.filename, result.buffer);
    }
  }

  zip.file(
    "manifest.json",
    `${JSON.stringify(
      {
        documentId: document.id,
        format: options.format,
        generatedBy: "DM-Instamap",
        layers: layerNames,
        map: {
          height: document.height,
          width: document.width
        }
      },
      null,
      2
    )}\n`
  );

  return {
    buffer: await zip.generateAsync({
      compression: "DEFLATE",
      type: "nodebuffer"
    }),
    contentType: "application/zip",
    filename: `${slugify(document.name || document.id)}-${options.format}-layers.zip`,
    format: options.format,
    layers: layerNames
  };
}

export function renderMapDocumentSvg(
  document: MapDocument,
  options: {
    assetMarkers?: boolean;
    background?: "default" | "transparent";
    cellPixels?: number;
    fallbackAssetIds?: readonly string[];
    includeGrid?: boolean;
    layers?: readonly RasterExportLayer[];
  } = {}
): string {
  const cellPixels = Math.max(
    1,
    Math.round(options.cellPixels ?? BASE_CELL_PIXELS)
  );
  const width = document.width * cellPixels;
  const height = document.height * cellPixels;
  const layers = new Set(options.layers ?? DEFAULT_LAYERS);
  const fallbackAssetIds = new Set(options.fallbackAssetIds ?? []);
  const tileLookup = new Map(
    document.tiles.map((tile) => [cellKey(tile.x, tile.y), tile])
  );
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
  ];

  if ((options.background ?? "default") === "default") {
    parts.push(`<rect width="100%" height="100%" fill="#080a0b"/>`);
  }

  for (let y = 0; y < document.height; y += 1) {
    for (let x = 0; x < document.width; x += 1) {
      const tile = tileLookup.get(cellKey(x, y));
      const renderedTile = renderTile(tile, x, y, cellPixels, layers);
      if (renderedTile) {
        parts.push(renderedTile);
      }
    }
  }

  if (layers.has("walls")) {
    for (const wall of document.plan?.walls ?? []) {
      parts.push(
        `<path d="M${wall.start.x * cellPixels} ${wall.start.y * cellPixels}L${wall.end.x * cellPixels} ${wall.end.y * cellPixels}" stroke="#2f383d" stroke-width="${Math.max(3, wall.thickness * cellPixels * 0.16)}" stroke-linecap="round"/>`
      );
    }
  }

  if (layers.has("doors")) {
    for (const door of document.plan?.doors ?? []) {
      parts.push(
        `<rect x="${door.position.x * cellPixels + cellPixels * 0.2}" y="${door.position.y * cellPixels + cellPixels * 0.2}" width="${cellPixels * 0.6}" height="${cellPixels * 0.6}" fill="#f0b84c"/>`
      );
    }
  }

  for (const asset of document.assets) {
    if (
      ((options.assetMarkers ?? true) || fallbackAssetIds.has(asset.id)) &&
      shouldRenderAsset(asset, layers)
    ) {
      parts.push(renderPlacedAsset(asset, cellPixels));
    }
  }

  if (layers.has("lighting")) {
    for (const light of document.plan?.lights ?? []) {
      parts.push(renderLight(light, cellPixels));
    }
  }

  if (options.includeGrid ?? true) {
    parts.push(renderGrid(document.width, document.height, cellPixels));
  }

  parts.push("</svg>");
  return parts.join("");
}

function renderTile(
  tile: MapTile | undefined,
  x: number,
  y: number,
  cellPixels: number,
  layers: Set<RasterExportLayer>
): string | null {
  const kind = tile?.kind ?? "empty";
  if (!shouldRenderTile(kind, layers)) {
    return null;
  }

  const color = tileColor(kind);
  return `<rect x="${x * cellPixels}" y="${y * cellPixels}" width="${cellPixels}" height="${cellPixels}" fill="${color}"/>`;
}

function renderPlacedAsset(asset: PlacedAsset, cellPixels: number): string {
  const cx = asset.position.x * cellPixels + cellPixels / 2;
  const cy = asset.position.y * cellPixels + cellPixels / 2;
  const radius = cellPixels * 0.34;
  const color =
    asset.layer === "lighting"
      ? "#f5cc63"
      : asset.layer === "floor"
        ? "#6fa0a8"
        : "#86b38f";
  const label = escapeXml(getAssetInitial(asset.assetId));
  const scaleX = (asset.flipX ? -1 : 1) * asset.scale;
  const scaleY = (asset.flipY ? -1 : 1) * asset.scale;

  return [
    `<g transform="translate(${cx} ${cy}) rotate(${asset.rotation}) scale(${scaleX} ${scaleY})">`,
    `<circle cx="0" cy="0" r="${radius}" fill="${color}" stroke="#f7efe2" stroke-width="${Math.max(1, cellPixels * 0.05)}"/>`,
    `<text x="0" y="${cellPixels * 0.13}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(8, cellPixels * 0.42)}" font-weight="700" fill="#101416">${label}</text>`,
    "</g>"
  ].join("");
}

type AssetRenderPlan = {
  assets: Array<{ asset: PlacedAsset; source: RasterAssetSource }>;
  missingAssets: string[];
  missingPlacedAssetIds: string[];
  warnings: string[];
};

async function resolveRasterAssets(
  document: MapDocument,
  options: {
    assetResolver?: AssetResolver;
    cellPixels: number;
    layers?: readonly RasterExportLayer[];
  }
): Promise<AssetRenderPlan> {
  const layers = new Set(options.layers ?? DEFAULT_LAYERS);
  const plan: AssetRenderPlan = {
    assets: [],
    missingAssets: [],
    missingPlacedAssetIds: [],
    warnings: []
  };

  if (!options.assetResolver) {
    return plan;
  }

  for (const asset of document.assets) {
    if (!shouldRenderAsset(asset, layers)) {
      continue;
    }

    try {
      const source = await options.assetResolver.resolveAsset(asset.assetId);

      if (!source) {
        plan.missingAssets.push(asset.assetId);
        plan.missingPlacedAssetIds.push(asset.id);
        plan.warnings.push(
          `Asset ${asset.assetId} non trovato dal resolver: uso marker di fallback.`
        );
        continue;
      }

      plan.assets.push({ asset, source });
    } catch (error) {
      plan.missingAssets.push(asset.assetId);
      plan.missingPlacedAssetIds.push(asset.id);
      plan.warnings.push(
        `Asset ${asset.assetId} non renderizzato: ${error instanceof Error ? error.message : "errore sconosciuto"}.`
      );
    }
  }

  return plan;
}

async function buildAssetCompositeInputs(
  plan: AssetRenderPlan,
  cellPixels: number
): Promise<Array<{ assetId: string; composite: sharp.OverlayOptions }>> {
  const inputs: Array<{ assetId: string; composite: sharp.OverlayOptions }> =
    [];

  for (const entry of plan.assets) {
    try {
      const image = await renderAssetImage(
        entry.asset,
        entry.source,
        cellPixels
      );
      const metadata = await sharp(image).metadata();
      const width = metadata.width ?? cellPixels;
      const height = metadata.height ?? cellPixels;
      const centerX = entry.asset.position.x * cellPixels + cellPixels / 2;
      const centerY = entry.asset.position.y * cellPixels + cellPixels / 2;

      inputs.push({
        assetId: entry.asset.assetId,
        composite: {
          input: image,
          left: Math.round(centerX - width / 2),
          top: Math.round(centerY - height / 2)
        }
      });
    } catch (error) {
      plan.missingAssets.push(entry.asset.assetId);
      plan.missingPlacedAssetIds.push(entry.asset.id);
      plan.warnings.push(
        `Asset ${entry.asset.assetId} non renderizzato: ${error instanceof Error ? error.message : "errore sconosciuto"}.`
      );
    }
  }

  return inputs;
}

async function renderAssetImage(
  asset: PlacedAsset,
  source: RasterAssetSource,
  cellPixels: number
): Promise<Buffer> {
  const targetSize = Math.max(1, Math.round(cellPixels * asset.scale));
  let pipeline = sharp(source.absolutePath).resize({
    background: { alpha: 0, b: 0, g: 0, r: 0 },
    fit: "contain",
    height: targetSize,
    width: targetSize
  });

  if (asset.flipX) {
    pipeline = pipeline.flop();
  }

  if (asset.flipY) {
    pipeline = pipeline.flip();
  }

  if (asset.rotation !== 0) {
    pipeline = pipeline.rotate(asset.rotation, {
      background: { alpha: 0, b: 0, g: 0, r: 0 }
    });
  }

  return pipeline.png().toBuffer();
}

function renderLight(
  light: {
    color: string;
    intensity: number;
    position: { x: number; y: number };
    radius: number;
  },
  cellPixels: number
): string {
  const cx = light.position.x * cellPixels;
  const cy = light.position.y * cellPixels;
  const radius = light.radius * cellPixels;
  return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${escapeXml(light.color)}" fill-opacity="${Math.min(0.55, Math.max(0.08, light.intensity * 0.45))}"/>`;
}

function renderGrid(
  widthCells: number,
  heightCells: number,
  cellPixels: number
): string {
  const width = widthCells * cellPixels;
  const height = heightCells * cellPixels;
  const lines: string[] = [];

  for (let x = 0; x <= widthCells; x += 1) {
    lines.push(
      `<path d="M${x * cellPixels} 0V${height}" stroke="#f4efe7" stroke-opacity="0.16" stroke-width="1"/>`
    );
  }

  for (let y = 0; y <= heightCells; y += 1) {
    lines.push(
      `<path d="M0 ${y * cellPixels}H${width}" stroke="#f4efe7" stroke-opacity="0.16" stroke-width="1"/>`
    );
  }

  return lines.join("");
}

function shouldRenderTile(
  kind: MapTile["kind"] | "empty",
  layers: Set<RasterExportLayer>
): boolean {
  if (kind === "floor" || kind === "empty") {
    return layers.has("floor");
  }

  if (kind === "wall") {
    return layers.has("walls");
  }

  return layers.has("doors");
}

function shouldRenderAsset(
  asset: PlacedAsset,
  layers: Set<RasterExportLayer>
): boolean {
  if (asset.layer === "lighting") {
    return layers.has("lighting");
  }

  if (asset.layer === "floor") {
    return layers.has("floor");
  }

  if (asset.layer === "wall") {
    return layers.has("walls");
  }

  return layers.has("props");
}

function tileColor(kind: MapTile["kind"] | "empty"): string {
  switch (kind) {
    case "door":
      return "#d7a447";
    case "floor":
      return "#a88d5d";
    case "wall":
      return "#394348";
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

function normalizeWebpQuality(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 92;
  }

  return Math.round(Math.min(100, Math.max(1, value)));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function getAssetInitial(assetId: string): string {
  return (
    assetId
      .replace(/^asset[_-]?/u, "")
      .charAt(0)
      .toUpperCase() || "A"
  );
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "") || "map"
  );
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
