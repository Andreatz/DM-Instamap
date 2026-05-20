"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent, WheelEvent } from "react";
import type { DoorSegment, LightSource, MapDocument, MapTile, RoomNode, WallSegment } from "@dm-instamap/core";
import { matchAssetGroupsForRoom, type MatchableAssetGroup } from "@dm-instamap/assets/matcher";
import { autoFurnishMap, type FurnishingAsset, type FurnishingDensity } from "@dm-instamap/generator";
import {
  addPlacedAsset,
  deletePlacedAsset,
  findRoomAtCell,
  movePlacedAsset,
  parseMapDocumentJson,
  selectElementAtCell,
  serializeMapDocument,
  updateDocumentForTool,
  type EditorPaletteAsset,
  type EditorSelection,
  type EditorTool
} from "@/lib/map-editor";
import type { AssetSearchApiResult } from "@/lib/asset-search";

type MapEditorProps = {
  assetGroups: MatchableAssetGroup[];
  initialDocument: MapDocument;
  mapTheme: string;
  palette: EditorPaletteAsset[];
  projectId?: string;
};

type DragPayload =
  | {
      assetId: string;
      type: "palette";
    }
  | {
      placedAssetId: string;
      type: "placed";
    };

type ExportFormat = "png" | "webp";

const CANVAS_CELL_SIZE = 24;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3;

export function MapEditor({ assetGroups, initialDocument, mapTheme, palette, projectId }: MapEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [document, setDocument] = useState(initialDocument);
  const [editorTool, setEditorTool] = useState<EditorTool>("select");
  const [selectedElement, setSelectedElement] = useState<EditorSelection>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>("room-entrance");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ height: 620, width: 900 });
  const [viewport, setViewport] = useState({ offsetX: 24, offsetY: 24, zoom: 1 });
  const [panStart, setPanStart] = useState<{ offsetX: number; offsetY: number; pointerX: number; pointerY: number } | null>(
    null
  );
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [furnishingDensity, setFurnishingDensity] = useState<FurnishingDensity>("normal");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportIncludeGrid, setExportIncludeGrid] = useState(true);
  const [exportScale, setExportScale] = useState(1);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetSearchResults, setAssetSearchResults] = useState<AssetSearchApiResult[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [jsonText, setJsonText] = useState(() => serializeMapDocument(initialDocument));
  const [status, setStatus] = useState("Ready");
  const rooms = document.plan?.rooms.filter((room) => room.kind === "room" || room.kind === "entrance") ?? [];
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedAsset = document.assets.find((asset) => asset.id === selectedAssetId) ?? null;
  const selectedDoor =
    selectedElement?.type === "door" ? document.plan?.doors.find((door) => door.id === selectedElement.id) ?? null : null;
  const selectedLight =
    selectedElement?.type === "light"
      ? document.plan?.lights.find((light) => light.id === selectedElement.id) ?? null
      : null;
  const roomMatches = useMemo(
    () =>
      selectedRoom
        ? matchAssetGroupsForRoom({
            groups: assetGroups,
            limit: 5,
            room: selectedRoom,
            theme: mapTheme
          })
        : [],
    [assetGroups, mapTheme, selectedRoom]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;

    if (!canvas || !container) {
      return;
    }

    const updateSize = () => {
      setCanvasSize({
        height: Math.max(460, Math.min(760, Math.floor(window.innerHeight * 0.68))),
        width: Math.max(620, container.clientWidth - 28)
      });
    };
    const observer = new ResizeObserver(updateSize);
    updateSize();
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    drawMapCanvas(canvas, {
      canvasSize,
      document,
      hoverCell,
      selectedAssetId,
      selectedDoor,
      selectedLight,
      selectedRoomId,
      viewport
    });
  }, [canvasSize, document, hoverCell, selectedAssetId, selectedDoor, selectedLight, selectedRoomId, viewport]);

  const screenToCell = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return null;
      }

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (clientX - rect.left) * scaleX;
      const canvasY = (clientY - rect.top) * scaleY;
      const x = Math.floor((canvasX - viewport.offsetX) / viewport.zoom / CANVAS_CELL_SIZE);
      const y = Math.floor((canvasY - viewport.offsetY) / viewport.zoom / CANVAS_CELL_SIZE);

      if (x < 0 || y < 0 || x >= document.width || y >= document.height) {
        return null;
      }

      return { x, y };
    },
    [document.height, document.width, viewport.offsetX, viewport.offsetY, viewport.zoom]
  );

  function handleCanvasPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const cell = screenToCell(event.clientX, event.clientY);

    if (event.button === 1 || event.altKey) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setPanStart({
        offsetX: viewport.offsetX,
        offsetY: viewport.offsetY,
        pointerX: event.clientX,
        pointerY: event.clientY
      });
      return;
    }

    if (!cell) {
      return;
    }

    if (editorTool === "select") {
      const selection = selectElementAtCell(document, cell);
      setSelectedElement(selection);
      setSelectedAssetId(selection?.type === "asset" ? selection.id : null);
      setSelectedRoomId(selection?.type === "room" ? selection.id : findRoomAtCell(document, cell)?.id ?? null);

      if (selection?.type === "asset") {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraggingAssetId(selection.id);
        setStatus("Drag selected asset to move it");
      }
      return;
    }

    setDocument((current) => updateDocumentForTool(current, editorTool, cell));
    setSelectedElement(null);
    setSelectedAssetId(null);
    setSelectedRoomId(findRoomAtCell(document, cell)?.id ?? null);
    setStatus(createToolStatus(editorTool, cell));
  }

  function handleCanvasPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (panStart) {
      const rect = event.currentTarget.getBoundingClientRect();
      const scaleX = event.currentTarget.width / rect.width;
      const scaleY = event.currentTarget.height / rect.height;
      setViewport((current) => ({
        ...current,
        offsetX: panStart.offsetX + (event.clientX - panStart.pointerX) * scaleX,
        offsetY: panStart.offsetY + (event.clientY - panStart.pointerY) * scaleY
      }));
      return;
    }

    const cell = screenToCell(event.clientX, event.clientY);
    setHoverCell(cell);
  }

  function handleCanvasPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const cell = screenToCell(event.clientX, event.clientY);

    if (draggingAssetId && cell) {
      setDocument((current) => movePlacedAsset(current, draggingAssetId, cell));
      setSelectedAssetId(draggingAssetId);
      setSelectedElement({ id: draggingAssetId, type: "asset" });
      setStatus(`Moved asset to ${cell.x}, ${cell.y}`);
    }

    setDraggingAssetId(null);
    setPanStart(null);
  }

  function handleCanvasWheel(event: WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    const nextZoom = clamp(viewport.zoom + delta, MIN_ZOOM, MAX_ZOOM);
    setViewport((current) => ({
      ...current,
      zoom: nextZoom
    }));
  }

  function resetViewport() {
    setViewport({ offsetX: 24, offsetY: 24, zoom: 1 });
  }

  function handleDrop(event: DragEvent, x: number, y: number) {
    event.preventDefault();
    const payload = readDragPayload(event);

    if (!payload) {
      return;
    }

    if (payload.type === "palette") {
      const paletteAsset = createPaletteAsset(payload.assetId, palette, assetSearchResults);

      if (!paletteAsset) {
        return;
      }

      setDocument((current) => addPlacedAsset(current, paletteAsset, { x, y }));
      setStatus(`Placed ${paletteAsset.name}`);
      return;
    }

    setDocument((current) => movePlacedAsset(current, payload.placedAssetId, { x, y }));
    setSelectedAssetId(payload.placedAssetId);
    setStatus("Moved asset");
  }

  function handleCanvasDrop(event: DragEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const cell = screenToCell(event.clientX, event.clientY);

    if (!cell) {
      return;
    }

    handleDrop(event, cell.x, cell.y);
  }

  async function saveJson() {
    const serialized = serializeMapDocument(document);
    setJsonText(serialized);
    window.localStorage.setItem("dm-instamap-editor-document", serialized);

    if (!projectId) {
      setStatus("Saved JSON locally");
      return;
    }

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        body: JSON.stringify({ document }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PUT"
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Project save failed");
      }

      setStatus("Saved project");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Project save failed");
    }
  }

  function loadJson() {
    try {
      const parsed = parseMapDocumentJson(jsonText);
      setDocument(parsed);
      setSelectedAssetId(null);
      setSelectedRoomId(parsed.plan?.rooms.find((room) => room.kind === "entrance")?.id ?? null);
      setStatus("Loaded MapDocument JSON");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load JSON");
    }
  }

  function loadLocal() {
    const saved = window.localStorage.getItem("dm-instamap-editor-document");

    if (!saved) {
      setStatus("No local saved document found");
      return;
    }

    setJsonText(saved);
    setDocument(parseMapDocumentJson(saved));
    setStatus("Loaded local saved document");
  }

  function deleteSelectedAsset() {
    if (!selectedAssetId) {
      return;
    }

    setDocument((current) => deletePlacedAsset(current, selectedAssetId));
    setSelectedAssetId(null);
    setStatus("Deleted asset");
  }

  function handleAutoFurnish() {
    const selectedAssets = createFurnishingAssets(assetGroups, palette, assetSearchResults);
    const result = autoFurnishMap(document, {
      assetGroups: createFurnishingAssetGroups(assetGroups),
      assets: selectedAssets,
      density: furnishingDensity,
      styleTags: [mapTheme]
    });

    setDocument(result.document);
    setSelectedAssetId(null);
    setStatus(`Auto-furnished ${result.summary.placedCount} assets, skipped ${result.summary.skippedCount}`);
  }

  async function handleExport() {
    setIsExporting(true);
    setStatus(`Exporting ${exportFormat.toUpperCase()}`);

    try {
      const response = await fetch("/api/export", {
        body: JSON.stringify({
          document,
          format: exportFormat,
          includeGrid: exportIncludeGrid,
          scale: exportScale
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = createExportFilename(document.name, exportFormat);
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`Exported ${exportFormat.toUpperCase()}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleFindMatchingAssets() {
    const query = (
      assetSearchQuery.trim() ||
      [mapTheme, selectedRoom?.label ?? "", ...(selectedRoom?.tags ?? [])].join(" ")
    ).trim();

    if (!query) {
      setAssetSearchResults([]);
      setStatus("Select a room or enter an asset search query");
      return;
    }

    setStatus("Searching local assets");

    try {
      const response = await fetch(`/api/assets/search?q=${encodeURIComponent(query)}&limit=12`);
      const payload = (await response.json()) as { results?: AssetSearchApiResult[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Local asset search failed");
      }

      setAssetSearchResults(payload.results ?? []);
      setStatus(`${payload.results?.length ?? 0} local asset suggestions`);
    } catch (error) {
      setAssetSearchResults([]);
      setStatus(error instanceof Error ? error.message : "Local asset search failed");
    }
  }

  return (
    <section className="editor-shell" aria-label="Map editor">
      <aside className="asset-filters editor-sidebar">
        <h2>Assets</h2>
        <div className="editor-palette">
          {palette.map((asset) => (
            <button
              draggable
              key={asset.id}
              onDragStart={(event) => writeDragPayload(event, { assetId: asset.id, type: "palette" })}
              type="button"
            >
              <span className="palette-thumb">
                {asset.thumbnailUrl ? <img alt="" src={asset.thumbnailUrl} /> : <b>{asset.name.charAt(0)}</b>}
              </span>
              <span>{asset.name}</span>
            </button>
          ))}
        </div>

        <section className="detail-block">
          <h3>Rooms</h3>
          <div className="editor-room-list">
            {rooms.map((room) => (
              <button
                className={selectedRoomId === room.id ? "active" : ""}
                key={room.id}
                onClick={() => setSelectedRoomId(room.id)}
                type="button"
              >
                {room.label}
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="editor-map-panel">
        <div className="editor-canvas-toolbar">
          <div className="editor-tool-grid" aria-label="Editor tools">
            {[
              ["select", "Select"],
              ["paint-floor", "Floor"],
              ["paint-wall", "Wall"],
              ["paint-empty", "Erase"],
              ["door", "Door"],
              ["light", "Light"]
            ].map(([tool, label]) => (
              <button
                className={editorTool === tool ? "active" : ""}
                key={tool}
                onClick={() => setEditorTool(tool as EditorTool)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="editor-viewport-actions">
            <button
              onClick={() =>
                setViewport((current) => ({ ...current, zoom: clamp(current.zoom - 0.15, MIN_ZOOM, MAX_ZOOM) }))
              }
              type="button"
            >
              Zoom -
            </button>
            <span>{Math.round(viewport.zoom * 100)}%</span>
            <button
              onClick={() =>
                setViewport((current) => ({ ...current, zoom: clamp(current.zoom + 0.15, MIN_ZOOM, MAX_ZOOM) }))
              }
              type="button"
            >
              Zoom +
            </button>
            <button onClick={resetViewport} type="button">
              Reset
            </button>
          </div>
        </div>
        <div className="editor-canvas-wrap">
          <canvas
            aria-label="Editable map canvas"
            className={`editor-canvas editor-tool-${editorTool}`}
            height={canvasSize.height}
            onContextMenu={(event) => event.preventDefault()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleCanvasDrop}
            onPointerDown={handleCanvasPointerDown}
            onPointerLeave={() => setHoverCell(null)}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onWheel={handleCanvasWheel}
            ref={canvasRef}
            width={canvasSize.width}
          />
        </div>
        <footer className="editor-canvas-status">
          <span>Tool: {formatToolName(editorTool)}</span>
          <span>{hoverCell ? `Cell ${hoverCell.x}, ${hoverCell.y}` : "Cell -"}</span>
          <span>{document.width} x {document.height}</span>
        </footer>
      </section>

      <aside className="asset-details editor-inspector">
        <h2>Inspector</h2>
        <dl>
          <div>
            <dt>Selected Room</dt>
            <dd>{selectedRoom?.label ?? "none"}</dd>
          </div>
          <div>
            <dt>Selected Asset</dt>
            <dd>{selectedAsset?.assetId ?? "none"}</dd>
          </div>
          <div>
            <dt>Selected Door</dt>
            <dd>{selectedDoor?.id ?? "none"}</dd>
          </div>
          <div>
            <dt>Selected Light</dt>
            <dd>{selectedLight?.id ?? "none"}</dd>
          </div>
          <div>
            <dt>Doors</dt>
            <dd>{document.plan?.doors.length ?? 0}</dd>
          </div>
          <div>
            <dt>Walls</dt>
            <dd>{document.plan?.walls.length ?? 0}</dd>
          </div>
        </dl>

        <section className="detail-block asset-match-debug">
          <h3>Room Asset Matches</h3>
          {selectedRoom ? (
            <p>
              Matching {selectedRoom.label} against {assetGroups.length} local groups.
            </p>
          ) : (
            <p>Select a room to inspect local asset matches.</p>
          )}
          <div className="asset-match-list">
            {roomMatches.map((match) => (
              <article key={match.group.id}>
                <header>
                  <strong>{match.group.name}</strong>
                  <span>{Math.round(match.score * 100)}%</span>
                </header>
                <p>
                  {match.group.kind ?? "unknown"} - {match.group.assetIds?.length ?? 0} assets
                </p>
                <ul>
                  {match.reasons.map((reason) => (
                    <li key={`${match.group.id}-${reason.label}`}>
                      {reason.label}: {reason.value} (+{Math.round(reason.score * 100)})
                    </li>
                  ))}
                </ul>
              </article>
            ))}
            {selectedRoom && roomMatches.length === 0 ? <p>No matching groups found yet.</p> : null}
          </div>
        </section>

        <section className="detail-block asset-match-debug">
          <h3>Find Matching Assets</h3>
          <label>
            <span>Search</span>
            <input
              onChange={(event) => setAssetSearchQuery(event.target.value)}
              placeholder={selectedRoom ? `${selectedRoom.label} ${selectedRoom.tags.join(" ")}` : "crypt coffin"}
              type="search"
              value={assetSearchQuery}
            />
          </label>
          <button className="save-correction" onClick={handleFindMatchingAssets} type="button">
            Search Local Assets
          </button>
          <div className="asset-match-list">
            {assetSearchResults.map((result) => (
              <article key={result.assetId}>
                <header>
                  <strong>{getFileName(result.relativePath)}</strong>
                  <span>{Math.round(result.score * 100)}%</span>
                </header>
                <p>{result.reason}</p>
                <button
                  draggable
                  onDragStart={(event) => writeDragPayload(event, { assetId: result.assetId, type: "palette" })}
                  type="button"
                >
                  Drag To Map
                </button>
              </article>
            ))}
          </div>
        </section>

        <button
          className="save-correction"
          disabled={!selectedAssetId}
          onClick={deleteSelectedAsset}
          type="button"
        >
          Delete Selected Asset
        </button>

        <section className="detail-block editor-furnish-controls">
          <h3>Auto-Furnish</h3>
          <label>
            <span>Density</span>
            <select
              onChange={(event) => setFurnishingDensity(event.target.value as FurnishingDensity)}
              value={furnishingDensity}
            >
              <option value="sparse">Sparse</option>
              <option value="normal">Normal</option>
              <option value="rich">Rich</option>
            </select>
          </label>
          <button className="save-correction" onClick={handleAutoFurnish} type="button">
            Place Room Assets
          </button>
        </section>

        <section className="detail-block editor-export-controls">
          <h3>Export</h3>
          <label>
            <span>Format</span>
            <select onChange={(event) => setExportFormat(event.target.value as ExportFormat)} value={exportFormat}>
              <option value="png">PNG</option>
              <option value="webp">WEBP</option>
            </select>
          </label>
          <label>
            <span>Scale</span>
            <select onChange={(event) => setExportScale(Number(event.target.value))} value={exportScale}>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={3}>3x</option>
              <option value={4}>4x</option>
            </select>
          </label>
          <label className="editor-checkbox">
            <input
              checked={exportIncludeGrid}
              onChange={(event) => setExportIncludeGrid(event.target.checked)}
              type="checkbox"
            />
            <span>Include grid</span>
          </label>
          <button className="save-correction" disabled={isExporting} onClick={handleExport} type="button">
            {isExporting ? "Exporting" : "Export Map"}
          </button>
        </section>

        <section className="detail-block">
          <h3>MapDocument JSON</h3>
          <div className="editor-json-actions">
            <button onClick={() => void saveJson()} type="button">
              {projectId ? "Save Project" : "Save JSON"}
            </button>
            <button onClick={loadJson} type="button">
              Load JSON
            </button>
            <button onClick={loadLocal} type="button">
              Load Local
            </button>
          </div>
          <textarea
            className="editor-json"
            onChange={(event) => setJsonText(event.target.value)}
            spellCheck={false}
            value={jsonText}
          />
          <p>{status}</p>
        </section>
      </aside>
    </section>
  );
}

function createTileLookup(tiles: MapTile[]): Map<string, MapTile> {
  return new Map(tiles.map((tile) => [cellKey(tile.x, tile.y), tile]));
}

function writeDragPayload(event: DragEvent, payload: DragPayload) {
  event.dataTransfer.setData("application/json", JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "move";
}

function readDragPayload(event: DragEvent): DragPayload | null {
  try {
    const parsed = JSON.parse(event.dataTransfer.getData("application/json")) as DragPayload;
    return parsed.type === "palette" || parsed.type === "placed" ? parsed : null;
  } catch {
    return null;
  }
}

function getAssetLabel(assetId: string): string {
  return assetId.replace(/^asset[_-]?/u, "").charAt(0).toUpperCase() || "A";
}

function createFurnishingAssets(
  assetGroups: MatchableAssetGroup[],
  palette: EditorPaletteAsset[],
  searchResults: AssetSearchApiResult[] = []
): FurnishingAsset[] {
  const searchedAssets = searchResults.map((result) => ({
    assetId: result.assetId,
    kind: result.classification,
    qualityScore: Math.round(result.score * 100),
    tags: result.tags
  }));
  const groupAssets = assetGroups
    .filter((group) => group.assetIds?.[0])
    .map((group) => ({
      assetId: group.assetIds?.[0] as string,
      kind: group.kind ?? "prop",
      qualityScore: group.qualityScore ?? undefined,
      tags: group.tags ?? [],
      usableFor: group.usableFor ?? []
    }));

  if (searchedAssets.length > 0 || groupAssets.length > 0) {
    return [...searchedAssets, ...groupAssets];
  }

  return palette.map((asset) => ({
    assetId: asset.id,
    kind: asset.kind,
    tags: tokenizeText(asset.name)
  }));
}

function createFurnishingAssetGroups(assetGroups: MatchableAssetGroup[]) {
  return assetGroups
    .filter((group) => group.assetIds?.[0])
    .map((group) => ({
      assetIds: group.assetIds ?? [],
      kind: group.kind ?? undefined,
      qualityScore: group.qualityScore ?? undefined,
      tags: group.tags ?? [],
      theme: group.theme ?? undefined,
      themes: group.themes ?? [],
      usableFor: group.usableFor ?? []
    }));
}

function createPaletteAsset(
  assetId: string,
  palette: EditorPaletteAsset[],
  searchResults: AssetSearchApiResult[]
): EditorPaletteAsset | null {
  const paletteAsset = palette.find((asset) => asset.id === assetId);

  if (paletteAsset) {
    return paletteAsset;
  }

  const searchResult = searchResults.find((result) => result.assetId === assetId);

  if (!searchResult) {
    return null;
  }

  return {
    id: searchResult.assetId,
    kind: searchResult.classification,
    name: getFileName(searchResult.relativePath),
    thumbnailUrl: searchResult.thumbnailUrl
  };
}

function tokenizeText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

function createExportFilename(name: string, format: ExportFormat): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "map";
  return `${slug}.${format}`;
}

function drawMapCanvas(
  canvas: HTMLCanvasElement,
  input: {
    canvasSize: { height: number; width: number };
    document: MapDocument;
    hoverCell: { x: number; y: number } | null;
    selectedAssetId: string | null;
    selectedDoor: DoorSegment | null;
    selectedLight: LightSource | null;
    selectedRoomId: string | null;
    viewport: { offsetX: number; offsetY: number; zoom: number };
  }
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const { document, hoverCell, selectedAssetId, selectedDoor, selectedLight, selectedRoomId, viewport } = input;
  const tilesByCell = createTileLookup(document.tiles);

  context.clearRect(0, 0, input.canvasSize.width, input.canvasSize.height);
  context.fillStyle = "#080a0b";
  context.fillRect(0, 0, input.canvasSize.width, input.canvasSize.height);

  context.save();
  context.translate(viewport.offsetX, viewport.offsetY);
  context.scale(viewport.zoom, viewport.zoom);

  for (let y = 0; y < document.height; y += 1) {
    for (let x = 0; x < document.width; x += 1) {
      const tile = tilesByCell.get(cellKey(x, y));
      context.fillStyle = getTileColor(tile?.kind ?? "empty");
      context.fillRect(x * CANVAS_CELL_SIZE, y * CANVAS_CELL_SIZE, CANVAS_CELL_SIZE, CANVAS_CELL_SIZE);
    }
  }

  drawGrid(context, document, viewport.zoom);
  drawRooms(context, document.plan?.rooms ?? [], selectedRoomId);
  drawWalls(context, document.plan?.walls ?? []);
  drawDoors(context, document.plan?.doors ?? [], selectedDoor?.id ?? null);
  drawLights(context, document.plan?.lights ?? [], selectedLight?.id ?? null);
  drawPlacedAssets(context, document.assets, selectedAssetId);

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

  context.restore();
}

function drawGrid(context: CanvasRenderingContext2D, document: MapDocument, zoom: number) {
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

function drawRooms(context: CanvasRenderingContext2D, rooms: RoomNode[], selectedRoomId: string | null) {
  for (const room of rooms) {
    context.strokeStyle = room.id === selectedRoomId ? "rgba(215, 164, 71, 0.95)" : "rgba(120, 168, 144, 0.4)";
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
    context.moveTo(wall.start.x * CANVAS_CELL_SIZE, wall.start.y * CANVAS_CELL_SIZE);
    context.lineTo(wall.end.x * CANVAS_CELL_SIZE, wall.end.y * CANVAS_CELL_SIZE);
    context.stroke();
  }
}

function drawDoors(context: CanvasRenderingContext2D, doors: DoorSegment[], selectedDoorId: string | null) {
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

function drawLights(context: CanvasRenderingContext2D, lights: LightSource[], selectedLightId: string | null) {
  for (const light of lights) {
    const x = light.position.x * CANVAS_CELL_SIZE;
    const y = light.position.y * CANVAS_CELL_SIZE;
    context.beginPath();
    context.fillStyle = light.id === selectedLightId ? "#f4efe7" : light.color;
    context.arc(x, y, CANVAS_CELL_SIZE * 0.28, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(215, 164, 71, 0.25)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(x, y, light.radius * CANVAS_CELL_SIZE, 0, Math.PI * 2);
    context.stroke();
  }
}

function drawPlacedAssets(context: CanvasRenderingContext2D, assets: MapDocument["assets"], selectedAssetId: string | null) {
  for (const asset of assets) {
    const x = (asset.position.x + 0.5) * CANVAS_CELL_SIZE;
    const y = (asset.position.y + 0.5) * CANVAS_CELL_SIZE;
    const radius = CANVAS_CELL_SIZE * 0.34 * asset.scale;
    context.beginPath();
    context.fillStyle = asset.id === selectedAssetId ? "#d7a447" : "#78a890";
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(244, 239, 231, 0.8)";
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = "#0f1214";
    context.font = "700 10px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(getAssetLabel(asset.assetId), x, y);
  }
}

function getTileColor(kind: string): string {
  switch (kind) {
    case "floor":
      return "#a88d5d";
    case "wall":
      return "#394348";
    case "door":
      return "#8a6431";
    case "empty":
    default:
      return "#080a0b";
  }
}

function createToolStatus(tool: EditorTool, cell: { x: number; y: number }): string {
  return `${formatToolName(tool)} at ${cell.x}, ${cell.y}`;
}

function formatToolName(tool: EditorTool): string {
  return tool
    .replace(/^paint-/u, "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getFileName(relativePath: string): string {
  return relativePath.split(/[\\/]/u).at(-1) ?? relativePath;
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
