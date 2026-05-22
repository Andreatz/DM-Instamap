import type {
  DoorSegment,
  LightSource,
  MapDocument,
  MapLayer,
  MapLayerKind,
  MapNote,
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
  canvasSize: { height: number; width: number };
  document: MapDocument;
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

  context.clearRect(0, 0, input.canvasSize.width, input.canvasSize.height);
  context.fillStyle = "#080a0b";
  context.fillRect(0, 0, input.canvasSize.width, input.canvasSize.height);

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

        context.fillStyle = getTileColor(kind);
        context.fillRect(
          x * CANVAS_CELL_SIZE,
          y * CANVAS_CELL_SIZE,
          CANVAS_CELL_SIZE,
          CANVAS_CELL_SIZE
        );
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

        context.fillStyle = getTileColor(tile.kind);
        context.fillRect(
          x * CANVAS_CELL_SIZE,
          y * CANVAS_CELL_SIZE,
          CANVAS_CELL_SIZE,
          CANVAS_CELL_SIZE
        );
      }
    }
  });

  drawGrid(context, document, viewport.zoom);
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
    layerState
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
    context.strokeStyle = "rgba(215, 164, 71, 0.95)";
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
      return "#a88d5d";
    case "wall":
      return "#394348";
    case "door":
      return "#8a6431";
    default:
      return "#080a0b";
  }
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
  zoom: number
) {
  if (zoom < 0.45) {
    return;
  }

  context.strokeStyle = "rgba(244, 239, 231, 0.08)";
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
        ? "rgba(215, 164, 71, 0.95)"
        : "rgba(120, 168, 144, 0.4)";
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
  context.strokeStyle = "#20272b";
  context.lineCap = "square";

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
    context.fillStyle = door.id === selectedDoorId ? "#f4efe7" : "#d7a447";
    context.fillRect(x, y, size, size);
    context.strokeStyle = "#5a3c18";
    context.lineWidth = 2;
    context.strokeRect(x, y, size, size);
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
    context.beginPath();
    context.fillStyle = light.id === selectedLightId ? "#f4efe7" : light.color;
    context.arc(x, y, CANVAS_CELL_SIZE * 0.28, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(215, 164, 71, 0.25)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(
      x,
      y,
      light.radius * CANVAS_CELL_SIZE * flickerScale,
      0,
      Math.PI * 2
    );
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
    context.fillStyle = note.id === selectedNoteId ? "#f4efe7" : "#d7a447";
    context.strokeStyle = "#5a3c18";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(0, -8);
    context.lineTo(8, 6);
    context.lineTo(-8, 6);
    context.closePath();
    context.fill();
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
  context.fillStyle = "rgba(0, 0, 0, 0.52)";

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
  layerState: Map<MapLayerKind, { opacity: number; visible: boolean }>
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
    context.save();
    context.globalAlpha *= state?.opacity ?? 1;
    context.translate(x, y);
    context.rotate((asset.rotation * Math.PI) / 180);
    context.scale(asset.flipX ? -1 : 1, asset.flipY ? -1 : 1);
    context.beginPath();
    context.fillStyle =
      asset.id === selectedAssetId || selectedAssetSet.has(asset.id)
        ? "#d7a447"
        : "#78a890";
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(244, 239, 231, 0.8)";
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = "#0f1214";
    context.font = "700 10px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(getAssetLabel(asset.assetId), 0, 0);
    context.restore();
  }
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
