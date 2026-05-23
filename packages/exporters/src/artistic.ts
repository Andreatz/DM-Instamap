import type {
  LightSource,
  MapDocument,
  MapTile,
  PlacedAsset,
  RenderStylePreset
} from "@dm-instamap/core/browser";
import { artisticLightStyle } from "@dm-instamap/core/browser";
import type { RasterExportLayer } from "./raster";

export type ArtisticSvgOptions = {
  /** Draw sober placeholder markers for assets (when no real artwork). */
  assetMarkers?: boolean;
  cellPixels: number;
  /** Placed-asset ids that should still get a marker even with markers off. */
  fallbackAssetIds?: readonly string[];
  /** Base64 data URI of the floor tile texture, if a real one is available. */
  floorPattern?: string | null;
  includeGrid?: boolean;
  layers?: readonly RasterExportLayer[];
  preset: RenderStylePreset;
  /** Base64 data URI of the wall tile texture, if a real one is available. */
  wallPattern?: string | null;
};

export type ArtisticSvgResult = {
  svg: string;
  /** True when no real floor/wall texture was available (procedural look). */
  usedProceduralFallback: boolean;
};

const DEFAULT_LAYERS: RasterExportLayer[] = [
  "floor",
  "walls",
  "doors",
  "props",
  "lighting"
];

/**
 * Build the artistic base SVG: textured (or procedural) floor and walls, warm
 * clamped lights, a discreet grid and sober prop placeholders. Real asset
 * artwork is composited on top by the raster exporter; here we only render the
 * scene base plus markers for assets that could not be resolved.
 */
export function renderArtisticMapSvg(
  document: MapDocument,
  options: ArtisticSvgOptions
): ArtisticSvgResult {
  const cellPixels = Math.max(1, Math.round(options.cellPixels));
  const width = document.width * cellPixels;
  const height = document.height * cellPixels;
  const layers = new Set(options.layers ?? DEFAULT_LAYERS);
  const fallback = new Set(options.fallbackAssetIds ?? []);
  const preset = options.preset;
  const palette = preset.palette;
  const floorPatternId = options.floorPattern ? "art-floor-tex" : null;
  const wallPatternId = options.wallPattern ? "art-wall-tex" : null;
  const usedProceduralFallback = !floorPatternId || !wallPatternId;
  const tileLookup = new Map(
    document.tiles.map((tile) => [cellKey(tile.x, tile.y), tile])
  );

  const defs: string[] = [
    `<radialGradient id="art-backdrop" cx="50%" cy="48%" r="78%">` +
      `<stop offset="0%" stop-color="${palette.background}"/>` +
      `<stop offset="100%" stop-color="${palette.backgroundEdge}"/>` +
      "</radialGradient>"
  ];
  if (options.floorPattern && floorPatternId) {
    defs.push(texturePattern(floorPatternId, options.floorPattern, cellPixels));
  }
  if (options.wallPattern && wallPatternId) {
    defs.push(texturePattern(wallPatternId, options.wallPattern, cellPixels));
  }

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs>${defs.join("")}</defs>`,
    `<rect width="100%" height="100%" fill="url(#art-backdrop)"/>`
  ];

  for (let y = 0; y < document.height; y += 1) {
    for (let x = 0; x < document.width; x += 1) {
      const tile = tileLookup.get(cellKey(x, y));
      const rendered = renderTile(tile, x, y, cellPixels, layers, preset, {
        floorPatternId,
        wallPatternId
      });
      if (rendered) {
        parts.push(rendered);
      }
    }
  }

  if (layers.has("walls")) {
    for (const wall of document.plan?.walls ?? []) {
      parts.push(
        `<path d="M${wall.start.x * cellPixels} ${wall.start.y * cellPixels}L${wall.end.x * cellPixels} ${wall.end.y * cellPixels}" stroke="${palette.wallBorder}" stroke-width="${Math.max(2, wall.thickness * cellPixels * 0.14)}" stroke-linecap="round"/>`
      );
    }
  }

  if (layers.has("doors")) {
    for (const door of document.plan?.doors ?? []) {
      parts.push(renderDoor(door, cellPixels, palette));
    }
  }

  for (const asset of document.assets) {
    if (
      ((options.assetMarkers ?? true) || fallback.has(asset.id)) &&
      shouldRenderAsset(asset.layer, layers)
    ) {
      parts.push(renderPropPlaceholder(asset, cellPixels, preset));
    }
  }

  if (layers.has("lighting")) {
    for (const [index, light] of (document.plan?.lights ?? []).entries()) {
      const rendered = renderLight(light, cellPixels, index);
      if (rendered) {
        parts.push(rendered);
      }
    }
  }

  if (options.includeGrid ?? true) {
    parts.push(renderGrid(document.width, document.height, cellPixels, preset));
  }

  parts.push("</svg>");
  return { svg: parts.join(""), usedProceduralFallback };
}

function renderTile(
  tile: MapTile | undefined,
  x: number,
  y: number,
  cellPixels: number,
  layers: Set<RasterExportLayer>,
  preset: RenderStylePreset,
  patterns: { floorPatternId: string | null; wallPatternId: string | null }
): string | null {
  const kind = tile?.kind ?? "empty";
  // Empty cells (outside the building) stay as the dark backdrop so the map
  // reads as a structure on a black field, like an illustrated battlemap.
  if (kind === "empty") {
    return null;
  }
  if (kind === "wall") {
    if (!layers.has("walls")) {
      return null;
    }
    return renderWallCell(x, y, cellPixels, preset, patterns.wallPatternId);
  }
  if (kind === "door") {
    return layers.has("doors")
      ? cellRect(x, y, cellPixels, preset.palette.floor)
      : null;
  }
  if (!layers.has("floor")) {
    return null;
  }
  return renderFloorCell(x, y, cellPixels, preset, patterns.floorPatternId);
}

function renderFloorCell(
  x: number,
  y: number,
  cellPixels: number,
  preset: RenderStylePreset,
  patternId: string | null
): string {
  const base = cellRect(x, y, cellPixels, preset.palette.floor);
  if (patternId) {
    return base + cellRect(x, y, cellPixels, `url(#${patternId})`);
  }
  // Procedural noise: blend floor/floorAlt and a faint speckle per cell.
  const grain = cellNoise(x, y);
  const px = x * cellPixels;
  const py = y * cellPixels;
  const layersOut = [base];
  if (grain.useAlt) {
    layersOut.push(
      `<rect x="${px}" y="${py}" width="${cellPixels}" height="${cellPixels}" fill="${preset.palette.floorAlt}" fill-opacity="${(0.5 * preset.contrast).toFixed(3)}"/>`
    );
  }
  layersOut.push(
    `<rect x="${px}" y="${py}" width="${cellPixels}" height="${cellPixels}" fill="${grain.dark ? "#000000" : "#ffffff"}" fill-opacity="${grain.alpha.toFixed(3)}"/>`
  );
  return layersOut.join("");
}

function renderWallCell(
  x: number,
  y: number,
  cellPixels: number,
  preset: RenderStylePreset,
  patternId: string | null
): string {
  const px = x * cellPixels;
  const py = y * cellPixels;
  const base = patternId
    ? cellRect(x, y, cellPixels, preset.palette.wall) +
      cellRect(x, y, cellPixels, `url(#${patternId})`)
    : cellRect(x, y, cellPixels, preset.palette.wall);
  // Top highlight + bottom/right shadow for a chiselled stone-block look.
  const edge = Math.max(1, Math.round(cellPixels * 0.12));
  return (
    base +
    `<rect x="${px}" y="${py}" width="${cellPixels}" height="${edge}" fill="#ffffff" fill-opacity="${(0.06 * preset.contrast).toFixed(3)}"/>` +
    `<rect x="${px}" y="${py + cellPixels - edge}" width="${cellPixels}" height="${edge}" fill="${preset.palette.wallBorder}" fill-opacity="0.75"/>`
  );
}

function renderDoor(
  door: { position: { x: number; y: number }; width: number },
  cellPixels: number,
  palette: RenderStylePreset["palette"]
): string {
  const x = door.position.x * cellPixels + cellPixels * 0.22;
  const y = door.position.y * cellPixels + cellPixels * 0.22;
  const size = cellPixels * 0.56;
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${cellPixels * 0.08}" fill="${palette.accentWarm}" fill-opacity="0.85" stroke="${palette.wallBorder}" stroke-width="${Math.max(1, cellPixels * 0.05)}"/>`;
}

function renderPropPlaceholder(
  asset: PlacedAsset,
  cellPixels: number,
  preset: RenderStylePreset
): string {
  const cx = (asset.position.x + 0.5) * cellPixels;
  const cy = (asset.position.y + 0.5) * cellPixels;
  const radius = cellPixels * 0.32 * Math.max(0.4, asset.scale);
  const fill =
    asset.layer === "lighting"
      ? preset.palette.accentWarm
      : preset.palette.wall;
  // Soft contact shadow + a muted rounded shape: reads as an object, not a
  // debug icon. No bright letters.
  return (
    `<ellipse cx="${cx}" cy="${cy + radius * 0.35}" rx="${radius}" ry="${radius * 0.5}" fill="#000000" fill-opacity="0.32"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}" fill-opacity="0.85" stroke="${preset.palette.wallBorder}" stroke-width="${Math.max(1, cellPixels * 0.04)}"/>` +
    `<circle cx="${cx - radius * 0.3}" cy="${cy - radius * 0.3}" r="${radius * 0.35}" fill="#ffffff" fill-opacity="0.08"/>`
  );
}

function renderLight(
  light: LightSource,
  cellPixels: number,
  index: number
): string {
  if (light.kind === "ambient") {
    return "";
  }
  // Same warm, clamped, no-white-core style as the editor canvas.
  const style = artisticLightStyle(light.kind, light.color);
  const cx = light.position.x * cellPixels;
  const cy = light.position.y * cellPixels;
  const radius =
    Math.min(style.radiusCells, Math.max(0.5, light.radius)) * cellPixels;
  const id = `art-light-${index}`;
  const peak = style.alpha;
  const core = cellPixels * 0.14;
  return (
    `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">` +
    `<stop offset="0%" stop-color="${style.color}" stop-opacity="${peak.toFixed(3)}"/>` +
    `<stop offset="55%" stop-color="${style.color}" stop-opacity="${(peak * 0.35).toFixed(3)}"/>` +
    `<stop offset="100%" stop-color="${style.color}" stop-opacity="0"/>` +
    "</radialGradient>" +
    `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#${id})"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${core}" fill="${style.color}" fill-opacity="0.5"/>`
  );
}

function renderGrid(
  widthCells: number,
  heightCells: number,
  cellPixels: number,
  preset: RenderStylePreset
): string {
  const width = widthCells * cellPixels;
  const height = heightCells * cellPixels;
  const opacity = Math.min(0.08, preset.gridOpacity).toFixed(3);
  const lines: string[] = [];
  for (let x = 0; x <= widthCells; x += 1) {
    lines.push(
      `<path d="M${x * cellPixels} 0V${height}" stroke="#ffffff" stroke-opacity="${opacity}" stroke-width="1"/>`
    );
  }
  for (let y = 0; y <= heightCells; y += 1) {
    lines.push(
      `<path d="M0 ${y * cellPixels}H${width}" stroke="#ffffff" stroke-opacity="${opacity}" stroke-width="1"/>`
    );
  }
  return lines.join("");
}

function texturePattern(
  id: string,
  dataUri: string,
  cellPixels: number
): string {
  return (
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${cellPixels}" height="${cellPixels}">` +
    `<image xlink:href="${dataUri}" width="${cellPixels}" height="${cellPixels}"/>` +
    "</pattern>"
  );
}

function shouldRenderAsset(
  layer: PlacedAsset["layer"],
  layers: Set<RasterExportLayer>
): boolean {
  if (layer === "lighting") {
    return layers.has("lighting");
  }
  if (layer === "floor") {
    return layers.has("floor");
  }
  if (layer === "wall") {
    return layers.has("walls");
  }
  return layers.has("props");
}

function cellRect(
  x: number,
  y: number,
  cellPixels: number,
  fill: string
): string {
  return `<rect x="${x * cellPixels}" y="${y * cellPixels}" width="${cellPixels}" height="${cellPixels}" fill="${fill}"/>`;
}

function cellNoise(
  x: number,
  y: number
): { alpha: number; dark: boolean; useAlt: boolean } {
  const hash = ((x * 73_856_093) ^ (y * 19_349_663)) >>> 0;
  const bucket = hash % 100;
  return {
    alpha: bucket < 45 ? 0.06 : bucket > 80 ? 0.04 : 0,
    dark: bucket < 45,
    useAlt: bucket % 3 === 0
  };
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
