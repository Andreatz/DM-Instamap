import type {
  DoorSegment,
  LightSource,
  MapDocument,
  MapLayer,
  MapLayerKind,
  MapNote,
  RenderPalette,
  MapTile,
  RoomNode,
  WallSegment
} from "@dm-instamap/core/browser";
import {
  CANVAS_CELL_SIZE,
  assetToLayerKind,
  createSelectionBounds
} from "./map-editor-view";

export type MapCanvasRenderInput = {
  /** Loaded asset thumbnails keyed by placed-asset id (group or asset id). */
  assetImages?: Map<string, HTMLImageElement>;
  canvasSize: { height: number; width: number };
  document: MapDocument;
  /**
   * Artistic render style. When set, the canvas uses the preset palette and a
   * discreet grid; when omitted it keeps the schematic debug look.
   */
  renderStyle?: { gridOpacity: number; palette: RenderPalette } | null;
  hoverCell: { x: number; y: number } | null;
  layers: MapLayer[];
  marqueeSelection: {
    current: { x: number; y: number };
    start: { x: number; y: number };
  } | null;
  selectedAssetId: string | null;
  selectedAssetIds: string[];
  selectedDoor: DoorSegment | null;
  selectedLight: LightSource | null;
  selectedNote: MapNote | null;
  selectedRoomId: string | null;
  visibleCellKeys: string[];
  viewport: { offsetX: number; offsetY: number; zoom: number };
};

// Theme accents, mirrored from globals.css so the canvas matches the UI.
const ACCENT = "#e0b450";
const ACCENT_SAGE = "#7fb39a";
const HIGHLIGHT = "#f4efe7";
// Reference px-per-cell for sizing real asset thumbnails (mirrors the export).
const ASSET_PIXELS_PER_CELL = 256;
// Cap on the light glow radius (cells) so big lights do not wash out the map.
const MAX_LIGHT_GLOW_CELLS = 6;

export function drawMapCanvas(
  canvas: HTMLCanvasElement,
  input: MapCanvasRenderInput
): void {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const {
    document,
    hoverCell,
    layers,
    marqueeSelection,
    selectedAssetId,
    selectedAssetIds,
    selectedDoor,
    selectedLight,
    selectedNote,
    selectedRoomId,
    visibleCellKeys,
    viewport
  } = input;
  const tilesByCell = createTileLookup(document.tiles);
  const layerState = createLayerState(layers);
  const palette = input.renderStyle?.palette ?? null;

  drawBackdrop(context, input.canvasSize, palette);

  context.save();
  context.translate(viewport.offsetX, viewport.offsetY);
  context.scale(viewport.zoom, viewport.zoom);

  drawLayer(context, layerState, "terrain", () => {
    for (let y = 0; y < document.height; y += 1) {
      for (let x = 0; x < document.width; x += 1) {
        const tile = tilesByCell.get(cellKey(x, y));
        const kind = tile?.kind ?? "empty";

        if (kind === "wall" || kind === "door") {
          continue;
        }

        drawFloorCell(context, x, y, kind, palette);
      }
    }
  });

  drawLayer(context, layerState, "walls", () => {
    for (let y = 0; y < document.height; y += 1) {
      for (let x = 0; x < document.width; x += 1) {
        const tile = tilesByCell.get(cellKey(x, y));

        if (tile?.kind !== "wall" && tile?.kind !== "door") {
          continue;
        }

        drawSolidCell(context, x, y, tile.kind, palette);
      }
    }
  });

  drawGrid(context, document, viewport.zoom, input.renderStyle?.gridOpacity);
  drawLayer(context, layerState, "notes", () =>
    drawRooms(context, document.plan?.rooms ?? [], selectedRoomId)
  );
  drawLayer(context, layerState, "walls", () => {
    drawWalls(context, document.plan?.walls ?? []);
    drawDoors(context, document.plan?.doors ?? [], selectedDoor?.id ?? null);
  });
  drawLayer(context, layerState, "lighting", () =>
    drawLights(context, document.plan?.lights ?? [], selectedLight?.id ?? null)
  );
  drawPlacedAssets(
    context,
    document.assets,
    selectedAssetId,
    selectedAssetIds,
    layerState,
    input.assetImages
  );
  drawLayer(context, layerState, "notes", () =>
    drawNotes(context, document.plan?.gmNotes ?? [], selectedNote?.id ?? null)
  );
  drawLayer(context, layerState, "lighting", () =>
    drawFogPreview(context, document, visibleCellKeys)
  );

  if (hoverCell) {
    context.strokeStyle = "rgba(244, 239, 231, 0.85)";
    context.lineWidth = 2 / viewport.zoom;
    context.strokeRect(
      hoverCell.x * CANVAS_CELL_SIZE + 1,
      hoverCell.y * CANVAS_CELL_SIZE + 1,
      CANVAS_CELL_SIZE - 2,
      CANVAS_CELL_SIZE - 2
    );
  }

  if (marqueeSelection) {
    const bounds = createSelectionBounds(
      marqueeSelection.start,
      marqueeSelection.current
    );
    context.strokeStyle = "rgba(224, 180, 80, 0.95)";
    context.lineWidth = 2 / viewport.zoom;
    context.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
    context.strokeRect(
      bounds.minX * CANVAS_CELL_SIZE,
      bounds.minY * CANVAS_CELL_SIZE,
      (bounds.maxX - bounds.minX + 1) * CANVAS_CELL_SIZE,
      (bounds.maxY - bounds.minY + 1) * CANVAS_CELL_SIZE
    );
    context.setLineDash([]);
  }

  context.restore();
}

export function getTileColor(kind: string): string {
  switch (kind) {
    case "floor":
      return "#ad9160";
    case "wall":
      return "#333c41";
    case "door":
      return "#9b6f35";
    default:
      return "#0a0c0e";
  }
}

/** Screen-space backdrop with a soft radial vignette for depth. */
function drawBackdrop(
  context: CanvasRenderingContext2D,
  size: { height: number; width: number },
  palette: RenderPalette | null
) {
  context.clearRect(0, 0, size.width, size.height);
  const cx = size.width / 2;
  const cy = size.height / 2;
  const outer = Math.hypot(size.width, size.height) * 0.62;
  const vignette = context.createRadialGradient(cx, cy, 0, cx, cy, outer);
  vignette.addColorStop(0, palette?.background ?? "#15191d");
  vignette.addColorStop(1, palette?.backgroundEdge ?? "#080a0b");
  context.fillStyle = vignette;
  context.fillRect(0, 0, size.width, size.height);
}

/** Floor cell: base colour plus a faint deterministic grain for texture. */
function drawFloorCell(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: string,
  palette: RenderPalette | null
) {
  const px = x * CANVAS_CELL_SIZE;
  const py = y * CANVAS_CELL_SIZE;
  context.fillStyle = palette ? palette.floor : getTileColor(kind);
  context.fillRect(px, py, CANVAS_CELL_SIZE, CANVAS_CELL_SIZE);

  if (kind !== "floor") {
    return;
  }

  context.fillStyle = floorGrain(x, y);
  context.fillRect(px, py, CANVAS_CELL_SIZE, CANVAS_CELL_SIZE);
}

/** Solid cell (wall/door) with a top highlight and bottom shadow bevel. */
function drawSolidCell(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: string,
  palette: RenderPalette | null
) {
  const px = x * CANVAS_CELL_SIZE;
  const py = y * CANVAS_CELL_SIZE;
  const fill = palette
    ? kind === "wall"
      ? palette.wall
      : palette.floor
    : null;
  context.fillStyle = fill ?? getTileColor(kind);
  context.fillRect(px, py, CANVAS_CELL_SIZE, CANVAS_CELL_SIZE);

  if (kind !== "wall") {
    return;
  }

  context.fillStyle = "rgba(255, 255, 255, 0.07)";
  context.fillRect(px, py, CANVAS_CELL_SIZE, 2);
  context.fillStyle = palette ? palette.wallBorder : "rgba(0, 0, 0, 0.3)";
  context.fillRect(px, py + CANVAS_CELL_SIZE - 2, CANVAS_CELL_SIZE, 2);
}

function floorGrain(x: number, y: number): string {
  // Stable per-cell hash -> subtle light/dark overlay for a stone-like grain.
  const hash = ((x * 73_856_093) ^ (y * 19_349_663)) >>> 0;
  const bucket = hash % 100;

  if (bucket < 40) {
    return "rgba(0, 0, 0, 0.06)";
  }

  if (bucket > 78) {
    return "rgba(255, 244, 214, 0.05)";
  }

  return "rgba(0, 0, 0, 0)";
}

function createTileLookup(tiles: MapTile[]): Map<string, MapTile> {
  return new Map(tiles.map((tile) => [cellKey(tile.x, tile.y), tile]));
}

function getAssetLabel(assetId: string): string {
  return (
    assetId
      .replace(/^asset[_-]?/u, "")
      .charAt(0)
      .toUpperCase() || "A"
  );
}

function drawGrid(
  context: CanvasRenderingContext2D,
  document: MapDocument,
  zoom: number,
  gridOpacity?: number
) {
  if (zoom < 0.45) {
    return;
  }

  const opacity = Math.max(0, Math.min(0.2, gridOpacity ?? 0.07));
  context.strokeStyle = `rgba(244, 239, 231, ${opacity})`;
  context.lineWidth = 1 / zoom;
  context.beginPath();

  for (let x = 0; x <= document.width; x += 1) {
    context.moveTo(x * CANVAS_CELL_SIZE, 0);
    context.lineTo(x * CANVAS_CELL_SIZE, document.height * CANVAS_CELL_SIZE);
  }

  for (let y = 0; y <= document.height; y += 1) {
    context.moveTo(0, y * CANVAS_CELL_SIZE);
    context.lineTo(document.width * CANVAS_CELL_SIZE, y * CANVAS_CELL_SIZE);
  }

  context.stroke();
}

function drawRooms(
  context: CanvasRenderingContext2D,
  rooms: RoomNode[],
  selectedRoomId: string | null
) {
  for (const room of rooms) {
    context.strokeStyle =
      room.id === selectedRoomId
        ? "rgba(224, 180, 80, 0.95)"
        : "rgba(127, 179, 154, 0.4)";
    context.lineWidth = room.id === selectedRoomId ? 3 : 1.5;
    context.strokeRect(
      room.bounds.x * CANVAS_CELL_SIZE,
      room.bounds.y * CANVAS_CELL_SIZE,
      room.bounds.width * CANVAS_CELL_SIZE,
      room.bounds.height * CANVAS_CELL_SIZE
    );
  }
}

function drawWalls(context: CanvasRenderingContext2D, walls: WallSegment[]) {
  context.strokeStyle = "#1b2125";
  context.lineCap = "round";

  for (const wall of walls) {
    context.lineWidth = Math.max(2, wall.thickness * 2);
    context.beginPath();
    context.moveTo(
      wall.start.x * CANVAS_CELL_SIZE,
      wall.start.y * CANVAS_CELL_SIZE
    );
    context.lineTo(
      wall.end.x * CANVAS_CELL_SIZE,
      wall.end.y * CANVAS_CELL_SIZE
    );
    context.stroke();
  }
}

function drawDoors(
  context: CanvasRenderingContext2D,
  doors: DoorSegment[],
  selectedDoorId: string | null
) {
  for (const door of doors) {
    const size = CANVAS_CELL_SIZE * 0.56;
    const x = door.position.x * CANVAS_CELL_SIZE - size / 2;
    const y = door.position.y * CANVAS_CELL_SIZE - size / 2;
    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.45)";
    context.shadowBlur = 5;
    context.fillStyle = door.id === selectedDoorId ? HIGHLIGHT : ACCENT;
    context.beginPath();
    context.roundRect(x, y, size, size, 3);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = "#5a3c18";
    context.lineWidth = 2;
    context.stroke();
    context.restore();
  }
}

function drawLights(
  context: CanvasRenderingContext2D,
  lights: LightSource[],
  selectedLightId: string | null
) {
  for (const light of lights) {
    const x = light.position.x * CANVAS_CELL_SIZE;
    const y = light.position.y * CANVAS_CELL_SIZE;
    const flickerScale = light.flicker ? 0.88 : 1;
    const glowRadius =
      Math.min(MAX_LIGHT_GLOW_CELLS, Math.max(0.5, light.radius)) *
      CANVAS_CELL_SIZE *
      flickerScale;

    // Subtle additive glow, capped so the map stays readable. Ambient lights
    // tint the whole scene, so they only get a marker (no big blob).
    if (light.kind !== "ambient") {
      context.save();
      context.globalCompositeOperation = "lighter";
      const glow = context.createRadialGradient(x, y, 0, x, y, glowRadius);
      glow.addColorStop(0, hexToRgba(light.color, 0.16));
      glow.addColorStop(0.5, hexToRgba(light.color, 0.05));
      glow.addColorStop(1, hexToRgba(light.color, 0));
      context.fillStyle = glow;
      context.beginPath();
      context.arc(x, y, glowRadius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    // Light source core.
    context.beginPath();
    context.fillStyle = light.id === selectedLightId ? HIGHLIGHT : light.color;
    context.arc(x, y, CANVAS_CELL_SIZE * 0.24, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(224, 180, 80, 0.35)";
    context.lineWidth = 1.5;
    context.stroke();
  }
}

function drawNotes(
  context: CanvasRenderingContext2D,
  notes: MapNote[],
  selectedNoteId: string | null
) {
  for (const note of notes) {
    const x = (note.position.x + 0.5) * CANVAS_CELL_SIZE;
    const y = (note.position.y + 0.5) * CANVAS_CELL_SIZE;
    context.save();
    context.translate(x, y);
    context.shadowColor = "rgba(0, 0, 0, 0.45)";
    context.shadowBlur = 4;
    context.fillStyle = note.id === selectedNoteId ? HIGHLIGHT : ACCENT;
    context.strokeStyle = "#5a3c18";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(0, -8);
    context.lineTo(8, 6);
    context.lineTo(-8, 6);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.stroke();
    context.restore();
  }
}

function drawFogPreview(
  context: CanvasRenderingContext2D,
  document: MapDocument,
  visibleCellKeys: string[]
) {
  if (visibleCellKeys.length === 0) {
    return;
  }

  const visibleCells = new Set(visibleCellKeys);
  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.55)";

  for (let y = 0; y < document.height; y += 1) {
    for (let x = 0; x < document.width; x += 1) {
      if (!visibleCells.has(cellKey(x, y))) {
        context.fillRect(
          x * CANVAS_CELL_SIZE,
          y * CANVAS_CELL_SIZE,
          CANVAS_CELL_SIZE,
          CANVAS_CELL_SIZE
        );
      }
    }
  }

  context.restore();
}

function drawPlacedAssets(
  context: CanvasRenderingContext2D,
  assets: MapDocument["assets"],
  selectedAssetId: string | null,
  selectedAssetIds: string[],
  layerState: Map<MapLayerKind, { opacity: number; visible: boolean }>,
  images?: Map<string, HTMLImageElement>
) {
  const selectedAssetSet = new Set(selectedAssetIds);

  for (const asset of assets) {
    const layerKind = assetToLayerKind(asset.layer);
    const state = layerState.get(layerKind);

    if (state?.visible === false) {
      continue;
    }

    const x = (asset.position.x + 0.5) * CANVAS_CELL_SIZE;
    const y = (asset.position.y + 0.5) * CANVAS_CELL_SIZE;
    const radius = CANVAS_CELL_SIZE * 0.34 * asset.scale;
    const selected =
      asset.id === selectedAssetId || selectedAssetSet.has(asset.id);
    const image = images?.get(asset.assetId);
    context.save();
    context.globalAlpha *= state?.opacity ?? 1;
    context.translate(x, y);
    context.rotate((asset.rotation * Math.PI) / 180);
    context.scale(asset.flipX ? -1 : 1, asset.flipY ? -1 : 1);

    if (image && image.naturalWidth > 0) {
      const { height, width } = imageFootprint(image, asset.scale);
      context.shadowColor = "rgba(0, 0, 0, 0.5)";
      context.shadowBlur = 6;
      context.shadowOffsetY = 1;
      context.drawImage(image, -width / 2, -height / 2, width, height);
      context.shadowBlur = 0;
      context.shadowOffsetY = 0;

      if (selected) {
        context.strokeStyle = ACCENT;
        context.lineWidth = 2;
        context.strokeRect(-width / 2, -height / 2, width, height);
      }

      context.restore();
      continue;
    }

    context.shadowColor = "rgba(0, 0, 0, 0.5)";
    context.shadowBlur = 6;
    context.shadowOffsetY = 1;
    context.beginPath();
    context.fillStyle = selected ? ACCENT : ACCENT_SAGE;
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
    context.strokeStyle = "rgba(244, 239, 231, 0.8)";
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = "#0f1214";
    context.font = "700 10px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(getAssetLabel(asset.assetId), 0, 0);
    context.restore();
  }
}

/** Footprint in canvas pixels from the image's natural size (see export F2). */
function imageFootprint(
  image: HTMLImageElement,
  scale: number
): { height: number; width: number } {
  const rawWidth = image.naturalWidth / ASSET_PIXELS_PER_CELL;
  const rawHeight = image.naturalHeight / ASSET_PIXELS_PER_CELL;
  const span = Math.max(rawWidth, rawHeight);
  const clamped = Math.min(8, Math.max(0.5, span));
  const fit = span > 0 ? clamped / span : 1;

  return {
    height: rawHeight * fit * CANVAS_CELL_SIZE * scale,
    width: rawWidth * fit * CANVAS_CELL_SIZE * scale
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/iu.exec(hex.trim());

  if (!match?.[1]) {
    return `rgba(224, 180, 80, ${alpha})`;
  }

  const value = Number.parseInt(match[1], 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createLayerState(
  layers: MapLayer[]
): Map<MapLayerKind, { opacity: number; visible: boolean }> {
  return new Map(
    layers.map((layer) => [
      layer.kind,
      { opacity: layer.opacity, visible: layer.visible }
    ])
  );
}

function drawLayer(
  context: CanvasRenderingContext2D,
  layerState: Map<MapLayerKind, { opacity: number; visible: boolean }>,
  kind: MapLayerKind,
  draw: () => void
) {
  const state = layerState.get(kind);

  if (state?.visible === false) {
    return;
  }

  context.save();
  context.globalAlpha *= state?.opacity ?? 1;
  draw();
  context.restore();
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
