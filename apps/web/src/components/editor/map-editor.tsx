"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent, WheelEvent } from "react";
import type { DoorSegment, InitiativeEntry, LightSource, MapDocument, MapLayer, MapLayerKind, MapNote, MapTile, RoomNode, WallSegment } from "@dm-instamap/core";
import { matchAssetGroupsForRoom, type MatchableAssetGroup } from "@dm-instamap/assets/matcher";
import { autoFurnishMap, type FurnishingAsset, type FurnishingDensity } from "@dm-instamap/generator";
import {
  addPlacedAsset,
  addInitiativeEntry,
  addMapNote,
  computeVisibleCells,
  createPlacedAssetClipboard,
  deleteInitiativeEntry,
  deleteMapNote,
  deletePlacedAssets,
  duplicatePlacedAssets,
  ensureEditorLayers,
  findRoomAtCell,
  groupPlacedAssets,
  isEditorLayerLocked,
  isEditorLayerVisible,
  movePlacedAsset,
  movePlacedAssets,
  pastePlacedAssetClipboard,
  parseMapDocumentJson,
  selectElementAtCell,
  selectPlacedAssetsInBounds,
  serializeMapDocument,
  ungroupPlacedAssets,
  updateInitiativeEntry,
  updateLightSource,
  updateMapLayer,
  updateMapNote,
  updateDocumentForTool,
  updatePlacedAssetLayer,
  updatePlacedAssetTransform,
  type EditorPaletteAsset,
  type EditorSelection,
  type EditorTool,
  type PlacedAssetClipboard
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
const CLIPBOARD_STORAGE_KEY = "dm-instamap-editor-asset-clipboard";
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3;
const HISTORY_LIMIT = 40;
const DEFAULT_NOTE_TEXT = "GM note";

export function MapEditor({ assetGroups, initialDocument, mapTheme, palette, projectId }: MapEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [document, setDocument] = useState(() => ensureEditorLayers(initialDocument));
  const [undoStack, setUndoStack] = useState<MapDocument[]>([]);
  const [redoStack, setRedoStack] = useState<MapDocument[]>([]);
  const [editorTool, setEditorTool] = useState<EditorTool>("select");
  const [selectedElement, setSelectedElement] = useState<EditorSelection>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>("room-entrance");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ height: 620, width: 900 });
  const [viewport, setViewport] = useState({ offsetX: 24, offsetY: 24, zoom: 1 });
  const [panStart, setPanStart] = useState<{ offsetX: number; offsetY: number; pointerX: number; pointerY: number } | null>(
    null
  );
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [dragStartCell, setDragStartCell] = useState<{ x: number; y: number } | null>(null);
  const [marqueeSelection, setMarqueeSelection] = useState<{
    current: { x: number; y: number };
    start: { x: number; y: number };
  } | null>(null);
  const [fogPreviewEnabled, setFogPreviewEnabled] = useState(true);
  const [furnishingDensity, setFurnishingDensity] = useState<FurnishingDensity>("normal");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportIncludeGrid, setExportIncludeGrid] = useState(true);
  const [exportScale, setExportScale] = useState(1);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetSearchResults, setAssetSearchResults] = useState<AssetSearchApiResult[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [noteDraft, setNoteDraft] = useState(DEFAULT_NOTE_TEXT);
  const [initiativeDraft, setInitiativeDraft] = useState({
    hitPoints: "",
    initiative: "10",
    name: "",
    side: "enemy" as InitiativeEntry["side"]
  });
  const [jsonText, setJsonText] = useState(() => serializeMapDocument(ensureEditorLayers(initialDocument)));
  const [status, setStatus] = useState("Ready");
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiRequest, setAiRequest] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDescription, setAiDescription] = useState<string>("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [recentGenerated, setRecentGenerated] = useState<EditorPaletteAsset[]>(() => loadRecentGeneratedFromStorage());
  const rooms = document.plan?.rooms.filter((room) => room.kind === "room" || room.kind === "entrance") ?? [];
  const editorLayers = [...document.layers].sort((left, right) => left.order - right.order);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedAsset = document.assets.find((asset) => asset.id === selectedAssetId) ?? null;
  const selectedAssets = document.assets.filter((asset) => selectedAssetIds.includes(asset.id));
  const selectedDoor =
    selectedElement?.type === "door" ? document.plan?.doors.find((door) => door.id === selectedElement.id) ?? null : null;
  const selectedLight =
    selectedElement?.type === "light"
      ? document.plan?.lights.find((light) => light.id === selectedElement.id) ?? null
      : null;
  const selectedNote =
    selectedElement?.type === "note" ? document.plan?.gmNotes.find((note) => note.id === selectedElement.id) ?? null : null;
  const visibleCellKeys = useMemo(() => (fogPreviewEnabled ? computeVisibleCells(document) : []), [document, fogPreviewEnabled]);
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

  const commitDocument = useCallback(
    (updater: (current: MapDocument) => MapDocument, message?: string) => {
      setDocument((current) => {
        const normalizedCurrent = ensureEditorLayers(current);
        const next = ensureEditorLayers(updater(normalizedCurrent));

        if (next === current || serializeMapDocument(next) === serializeMapDocument(normalizedCurrent)) {
          return current;
        }

        setUndoStack((history) => [...history.slice(-(HISTORY_LIMIT - 1)), normalizedCurrent]);
        setRedoStack([]);

        if (message) {
          setStatus(message);
        }

        return next;
      });
    },
    []
  );

  const undo = useCallback(() => {
    setUndoStack((history) => {
      const previous = history.at(-1);

      if (!previous) {
        setStatus("Nessuna azione da annullare");
        return history;
      }

      setRedoStack((redoHistory) => [document, ...redoHistory.slice(0, HISTORY_LIMIT - 1)]);
      setDocument(previous);
      setSelectedAssetId(null);
      setSelectedAssetIds([]);
      setSelectedElement(null);
      setStatus("Undo");
      return history.slice(0, -1);
    });
  }, [document]);

  const redo = useCallback(() => {
    setRedoStack((history) => {
      const next = history[0];

      if (!next) {
        setStatus("Nothing to redo");
        return history;
      }

      setUndoStack((undoHistory) => [...undoHistory.slice(-(HISTORY_LIMIT - 1)), document]);
      setDocument(next);
      setSelectedAssetId(null);
      setSelectedAssetIds([]);
      setSelectedElement(null);
      setStatus("Redo");
      return history.slice(1);
    });
  }, [document]);

  const createSnapshot = useCallback(async () => {
    if (!projectId) {
      setStatus("Snapshots require a saved project.");
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
    const label = `editor-${stamp.slice(0, 19)}`;

    setStatus(`Creating snapshot ${label}…`);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/snapshots`, {
        body: JSON.stringify({ label }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as {
        error?: string;
        snapshot?: { written: boolean };
      };

      if (!response.ok || !payload.snapshot) {
        throw new Error(payload.error ?? "Snapshot failed.");
      }

      setStatus(payload.snapshot.written ? `Snapshot ${label} created.` : "Snapshot identical — not written.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Snapshot failed.");
    }
  }, [projectId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextInputTarget(event.target)) {
        return;
      }

      if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "g") {
        event.preventDefault();
        toggleGmLayerVisibility();
        return;
      }

      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }

      if (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }

      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelectedAssets();
      }

      if (event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteAssetClipboard();
      }

      if (event.key.toLowerCase() === "s" && event.shiftKey) {
        event.preventDefault();
        void createSnapshot();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copySelectedAssets, createSnapshot, pasteAssetClipboard, redo, undo]);

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
      layers: editorLayers,
      marqueeSelection,
      selectedAssetId,
      selectedAssetIds,
      selectedDoor,
      selectedLight,
      selectedNote,
      selectedRoomId,
      visibleCellKeys,
      viewport
    });
  }, [
    canvasSize,
    document,
    editorLayers,
    hoverCell,
    marqueeSelection,
    selectedAssetId,
    selectedAssetIds,
    selectedDoor,
    selectedLight,
    selectedNote,
    selectedRoomId,
    visibleCellKeys,
    viewport
  ]);

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
      const visibleSelection = selection && isSelectionVisible(document, selection) ? selection : null;
      setSelectedElement(visibleSelection);
      if (visibleSelection?.type === "asset") {
        const nextAssetIds =
          event.shiftKey || event.ctrlKey || event.metaKey
            ? toggleSelection(selectedAssetIds, visibleSelection.id)
            : [visibleSelection.id];
        setSelectedAssetIds(nextAssetIds);
        setSelectedAssetId(nextAssetIds.at(-1) ?? null);
        setSelectedElement(nextAssetIds.length > 0 ? { id: nextAssetIds.at(-1) ?? visibleSelection.id, type: "asset" } : null);
      } else {
        setSelectedAssetIds([]);
        setSelectedAssetId(null);
      }
      setSelectedRoomId(visibleSelection?.type === "room" ? visibleSelection.id : findRoomAtCell(document, cell)?.id ?? null);

      if (visibleSelection?.type === "asset") {
        const asset = document.assets.find((candidate) => candidate.id === visibleSelection.id);
        if (asset && isEditorLayerLocked(document, assetToLayerKind(asset.layer))) {
          setStatus("Selected asset layer is locked");
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraggingAssetId(visibleSelection.id);
        setDragStartCell(cell);
        setStatus("Drag selected asset to move it");
      } else if (!visibleSelection) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setMarqueeSelection({ current: cell, start: cell });
        setStatus("Selecting assets");
      }
      return;
    }

    if (isEditorLayerLocked(document, toolToLayerKind(editorTool))) {
      setStatus(`${layerLabel(toolToLayerKind(editorTool))} layer is locked`);
      return;
    }

    commitDocument((current) => updateDocumentForTool(current, editorTool, cell), createToolStatus(editorTool, cell));
    setSelectedElement(null);
    setSelectedAssetId(null);
    setSelectedAssetIds([]);
    setSelectedRoomId(findRoomAtCell(document, cell)?.id ?? null);
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
    if (cell && marqueeSelection) {
      setMarqueeSelection((current) => (current ? { ...current, current: cell } : null));
    }
    setHoverCell(cell);
  }

  function handleCanvasPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const cell = screenToCell(event.clientX, event.clientY);

    if (marqueeSelection) {
      const bounds = createSelectionBounds(marqueeSelection.start, marqueeSelection.current);
      const assetIds = selectPlacedAssetsInBounds(document, bounds).filter((assetId) => {
        const asset = document.assets.find((candidate) => candidate.id === assetId);
        return asset ? isEditorLayerVisible(document, assetToLayerKind(asset.layer)) : false;
      });
      const lastAssetId = assetIds.at(-1) ?? null;
      setSelectedAssetIds(assetIds);
      setSelectedAssetId(lastAssetId);
      setSelectedElement(lastAssetId ? { id: lastAssetId, type: "asset" } : null);
      setStatus(`Selected ${assetIds.length} asset${assetIds.length === 1 ? "" : "s"}`);
    } else if (draggingAssetId && cell) {
      const asset = document.assets.find((candidate) => candidate.id === draggingAssetId);
      if (asset && isEditorLayerLocked(document, assetToLayerKind(asset.layer))) {
        setStatus(`${layerLabel(assetToLayerKind(asset.layer))} layer is locked`);
      } else {
        const currentSelection = selectedAssetIds.includes(draggingAssetId) ? selectedAssetIds : [draggingAssetId];
        const delta = dragStartCell ? { x: cell.x - dragStartCell.x, y: cell.y - dragStartCell.y } : null;
        if (delta && currentSelection.length > 1) {
          commitDocument(
            (current) => movePlacedAssets(current, currentSelection, delta),
            `Moved ${currentSelection.length} assets by ${delta.x}, ${delta.y}`
          );
        } else {
          commitDocument((current) => movePlacedAsset(current, draggingAssetId, cell), `Moved asset to ${cell.x}, ${cell.y}`);
        }
      }
      setSelectedAssetId(draggingAssetId);
      setSelectedAssetIds((current) => (current.includes(draggingAssetId) ? current : [draggingAssetId]));
      setSelectedElement({ id: draggingAssetId, type: "asset" });
    }

    setDraggingAssetId(null);
    setDragStartCell(null);
    setMarqueeSelection(null);
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

      const layerKind = paletteAsset.kind === "light" ? "lighting" : "props";

      if (isEditorLayerLocked(document, layerKind)) {
        setStatus(`${layerLabel(layerKind)} layer is locked`);
        return;
      }

      commitDocument((current) => addPlacedAsset(current, paletteAsset, { x, y }), `Placed ${paletteAsset.name}`);
      return;
    }

    const asset = document.assets.find((candidate) => candidate.id === payload.placedAssetId);
    if (asset && isEditorLayerLocked(document, assetToLayerKind(asset.layer))) {
      setStatus(`${layerLabel(assetToLayerKind(asset.layer))} layer is locked`);
      return;
    }

    commitDocument((current) => movePlacedAsset(current, payload.placedAssetId, { x, y }), "Moved asset");
    setSelectedAssetId(payload.placedAssetId);
    setSelectedAssetIds([payload.placedAssetId]);
  }

  function handleCanvasDrop(event: DragEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const cell = screenToCell(event.clientX, event.clientY);

    if (!cell) {
      return;
    }

    handleDrop(event, cell.x, cell.y);
  }

  const exportSessionPackQuick = useCallback(async () => {
    if (!projectId) {
      setStatus("Session pack export requires a saved project.");
      return;
    }

    setStatus("Exporting session pack…");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/export`, {
        body: JSON.stringify({
          description: document.name,
          format: "session-pack",
          includeInitiative: true,
          scale: 1
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Session pack export failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${projectId}-session-pack.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("Session pack downloaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Session pack export failed.");
    }
  }, [document.name, projectId]);

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
      setUndoStack([]);
      setRedoStack([]);
      setSelectedAssetId(null);
      setSelectedAssetIds([]);
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
    setUndoStack([]);
    setRedoStack([]);
    setSelectedAssetId(null);
    setSelectedAssetIds([]);
    setStatus("Loaded local saved document");
  }

  function deleteSelectedAsset() {
    const assetIds = selectedAssetIds.length > 0 ? selectedAssetIds : selectedAssetId ? [selectedAssetId] : [];

    if (assetIds.length === 0) {
      return;
    }

    if (hasLockedSelectedAsset(document, selectedAssets, assetIds)) {
      setStatus("One or more selected asset layers are locked");
      return;
    }

    commitDocument(
      (current) => deletePlacedAssets(current, assetIds),
      `Deleted ${assetIds.length} selected asset${assetIds.length === 1 ? "" : "s"}`
    );
    setSelectedAssetId(null);
    setSelectedAssetIds([]);
  }

  function duplicateSelectedAsset() {
    const assetIds = selectedAssetIds.length > 0 ? selectedAssetIds : selectedAssetId ? [selectedAssetId] : [];

    if (assetIds.length === 0) {
      return;
    }

    if (hasLockedSelectedAsset(document, selectedAssets, assetIds)) {
      setStatus("One or more selected asset layers are locked");
      return;
    }

    commitDocument(
      (current) => duplicatePlacedAssets(current, assetIds),
      `Duplicated ${assetIds.length} selected asset${assetIds.length === 1 ? "" : "s"}`
    );
  }

  function groupSelectedAssets() {
    const assetIds = selectedAssetIds.length > 0 ? selectedAssetIds : selectedAssetId ? [selectedAssetId] : [];

    if (assetIds.length < 2) {
      setStatus("Select at least two assets to group");
      return;
    }

    if (hasLockedSelectedAsset(document, selectedAssets, assetIds)) {
      setStatus("One or more selected asset layers are locked");
      return;
    }

    const grouped = groupPlacedAssets(document, assetIds);
    commitDocument(() => grouped.document, `Grouped ${assetIds.length} assets`);
  }

  function ungroupSelectedAssets() {
    const assetIds = selectedAssetIds.length > 0 ? selectedAssetIds : selectedAssetId ? [selectedAssetId] : [];

    if (assetIds.length === 0) {
      return;
    }

    if (hasLockedSelectedAsset(document, selectedAssets, assetIds)) {
      setStatus("One or more selected asset layers are locked");
      return;
    }

    commitDocument((current) => ungroupPlacedAssets(current, assetIds), "Ungrouped selected assets");
  }

  function copySelectedAssets() {
    const assetIds = selectedAssetIds.length > 0 ? selectedAssetIds : selectedAssetId ? [selectedAssetId] : [];

    if (assetIds.length === 0) {
      return;
    }

    const clipboard = createPlacedAssetClipboard(document, assetIds);
    window.localStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(clipboard));
    setStatus(`Copied ${clipboard.assets.length} selected asset${clipboard.assets.length === 1 ? "" : "s"}`);
  }

  function pasteAssetClipboard() {
    const rawClipboard = window.localStorage.getItem(CLIPBOARD_STORAGE_KEY);

    if (!rawClipboard) {
      setStatus("No copied assets found");
      return;
    }

    try {
      const clipboard = JSON.parse(rawClipboard) as PlacedAssetClipboard;
      const result = pastePlacedAssetClipboard(document, clipboard);
      const lastPastedId = result.pastedIds.at(-1) ?? null;
      commitDocument(() => result.document, `Pasted ${result.pastedIds.length} asset${result.pastedIds.length === 1 ? "" : "s"}`);
      setSelectedAssetIds(result.pastedIds);
      setSelectedAssetId(lastPastedId);
      setSelectedElement(lastPastedId ? { id: lastPastedId, type: "asset" } : null);
    } catch {
      setStatus("Copied asset data is not valid");
    }
  }

  function selectAllVisibleAssets() {
    const assetIds = document.assets
      .filter((asset) => isEditorLayerVisible(document, assetToLayerKind(asset.layer)))
      .map((asset) => asset.id);
    const lastAssetId = assetIds.at(-1) ?? null;

    setSelectedAssetIds(assetIds);
    setSelectedAssetId(lastAssetId);
    setSelectedElement(lastAssetId ? { id: lastAssetId, type: "asset" } : null);
    setStatus(`Selected ${assetIds.length} visible asset${assetIds.length === 1 ? "" : "s"}`);
  }

  function clearAssetSelection() {
    setSelectedAssetIds([]);
    setSelectedAssetId(null);
    setSelectedElement(null);
    setStatus("Asset selection cleared");
  }

  function updateSelectedAssetTransform(transform: Parameters<typeof updatePlacedAssetTransform>[2]) {
    if (!selectedAssetId) {
      return;
    }

    if (selectedAsset && isEditorLayerLocked(document, assetToLayerKind(selectedAsset.layer))) {
      setStatus(`${layerLabel(assetToLayerKind(selectedAsset.layer))} layer is locked`);
      return;
    }

    commitDocument((current) => updatePlacedAssetTransform(current, selectedAssetId, transform), "Updated asset transform");
  }

  function updateSelectedAssetLayer(layer: MapDocument["assets"][number]["layer"]) {
    if (!selectedAssetId) {
      return;
    }

    if (selectedAsset && isEditorLayerLocked(document, assetToLayerKind(selectedAsset.layer))) {
      setStatus(`${layerLabel(assetToLayerKind(selectedAsset.layer))} layer is locked`);
      return;
    }

    commitDocument((current) => updatePlacedAssetLayer(current, selectedAssetId, layer), "Moved asset to layer");
  }

  function updateLayer(layerKind: MapLayerKind, patch: Partial<Pick<MapLayer, "locked" | "opacity" | "visible">>) {
    commitDocument((current) => updateMapLayer(current, layerKind, patch), "Updated layer");
  }

  function toggleGmLayerVisibility() {
    updateLayer("gm-only", { visible: !isEditorLayerVisible(document, "gm-only") });
  }

  function updateSelectedLight(patch: Parameters<typeof updateLightSource>[2]) {
    if (!selectedLight) {
      return;
    }

    if (isEditorLayerLocked(document, "lighting")) {
      setStatus("Lighting layer is locked");
      return;
    }

    commitDocument((current) => updateLightSource(current, selectedLight.id, patch), "Updated light");
  }

  function addNoteAtHoverCell() {
    const position = hoverCell ?? { x: 0, y: 0 };

    if (isEditorLayerLocked(document, "notes")) {
      setStatus("Notes layer is locked");
      return;
    }

    commitDocument((current) => addMapNote(current, position, noteDraft), `Added note at ${position.x}, ${position.y}`);
    setNoteDraft(DEFAULT_NOTE_TEXT);
  }

  function updateSelectedNote(patch: Partial<Pick<MapNote, "text" | "title">>) {
    if (!selectedNote) {
      return;
    }

    if (isEditorLayerLocked(document, "notes")) {
      setStatus("Notes layer is locked");
      return;
    }

    commitDocument((current) => updateMapNote(current, selectedNote.id, patch), "Updated note");
  }

  function deleteSelectedNote() {
    if (!selectedNote) {
      return;
    }

    if (isEditorLayerLocked(document, "notes")) {
      setStatus("Notes layer is locked");
      return;
    }

    commitDocument((current) => deleteMapNote(current, selectedNote.id), "Deleted note");
    setSelectedElement(null);
  }

  function addInitiativeDraft() {
    const name = initiativeDraft.name.trim();

    if (!name) {
      setStatus("Initiative entry needs a name");
      return;
    }

    commitDocument(
      (current) =>
        addInitiativeEntry(current, {
          hitPoints: parseOptionalInteger(initiativeDraft.hitPoints),
          initiative: parseInteger(initiativeDraft.initiative, 10),
          name,
          side: initiativeDraft.side
        }),
      `Added ${name} to initiative`
    );
    setInitiativeDraft({ hitPoints: "", initiative: "10", name: "", side: "enemy" });
  }

  function damageInitiativeEntry(entry: InitiativeEntry, amount: number) {
    commitDocument(
      (current) => updateInitiativeEntry(current, entry.id, { hitPoints: Math.max(0, (entry.hitPoints ?? 0) - amount) }),
      `Updated ${entry.name}`
    );
  }

  function removeInitiativeEntry(entry: InitiativeEntry) {
    commitDocument((current) => deleteInitiativeEntry(current, entry.id), `Removed ${entry.name}`);
  }

  function handleAutoFurnish() {
    const selectedAssets = createFurnishingAssets(assetGroups, palette, assetSearchResults);
    const result = autoFurnishMap(document, {
      assetGroups: createFurnishingAssetGroups(assetGroups),
      assets: selectedAssets,
      density: furnishingDensity,
      styleTags: [mapTheme]
    });

    commitDocument(() => ensureEditorLayers(result.document), `Auto-furnished ${result.summary.placedCount} assets, skipped ${result.summary.skippedCount}`);
    setSelectedAssetId(null);
    setSelectedAssetIds([]);
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

  async function runAiDescribeMap() {
    if (aiBusy) {
      return;
    }

    setAiBusy(true);
    setStatus("Asking AI for a map description…");

    try {
      const response = await fetch("/api/ai/blueprint", {
        body: JSON.stringify({ request: aiRequest.trim() || `Describe ${document.name} for the GM.` }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as {
        blueprint?: { name?: string; mood?: string; structure?: string };
        error?: string;
        errors?: string[];
        ok: boolean;
      };

      if (!response.ok || !payload.ok || !payload.blueprint) {
        throw new Error(payload.error ?? payload.errors?.join("; ") ?? "AI request failed.");
      }

      const blueprint = payload.blueprint;
      const description = `${blueprint.name ?? document.name} — structure ${blueprint.structure ?? "unknown"}, mood ${blueprint.mood ?? "unknown"}.`;
      setAiDescription(description);
      setStatus("AI description ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI request failed.");
    } finally {
      setAiBusy(false);
    }
  }

  async function runAiSuggestForSelectedRoom() {
    if (!selectedRoom) {
      setStatus("Select a room before asking for suggestions.");
      return;
    }

    setAiBusy(true);
    setAiSuggestions([]);
    setStatus(`Asking AI for assets in ${selectedRoom.label}…`);

    try {
      const query =
        aiRequest.trim() || `${selectedRoom.label} ${selectedRoom.tags.join(" ")} ${mapTheme}`.trim();
      const response = await fetch(`/api/assets/search?q=${encodeURIComponent(query)}&limit=8`);
      const payload = (await response.json()) as { error?: string; results?: AssetSearchApiResult[] };

      if (!response.ok || !payload.results) {
        throw new Error(payload.error ?? "Suggestion failed.");
      }

      setAiSuggestions(payload.results.map((result) => `${result.relativePath} (${result.classification})`));
      setStatus(`${payload.results.length} suggestions for ${selectedRoom.label}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Suggestion failed.");
    } finally {
      setAiBusy(false);
    }
  }

  async function generateAssetFromPrompt() {
    const prompt = aiRequest.trim();

    if (!prompt) {
      setStatus("Type a prompt before generating.");
      return;
    }

    setAiBusy(true);
    setStatus(`Generating asset from prompt…`);

    try {
      const response = await fetch("/api/assets/generate", {
        body: JSON.stringify({
          classification: "prop",
          prompt
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as {
        asset?: { filename: string; relativePath: string };
        error?: string;
        manifestEntry?: { id: string; relativePath: string; thumbnailPath: string | null } | null;
      };

      if (!response.ok || !payload.asset) {
        throw new Error(payload.error ?? "Generation failed.");
      }

      const entry = payload.manifestEntry;
      if (entry) {
        const palette: EditorPaletteAsset = {
          id: entry.id,
          kind: "prop",
          name: payload.asset.filename,
          thumbnailUrl: entry.thumbnailPath ? `/${entry.thumbnailPath}` : ""
        };
        const next = [palette, ...recentGenerated.filter((item) => item.id !== entry.id)].slice(0, 12);
        setRecentGenerated(next);
        saveRecentGeneratedToStorage(next);
      }

      setStatus(`Generated ${payload.asset.filename}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setAiBusy(false);
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

        {recentGenerated.length > 0 ? (
          <section className="detail-block">
            <h3>Recently Generated</h3>
            <div className="editor-palette">
              {recentGenerated.map((asset) => (
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
          </section>
        ) : null}

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
              ["light", "Light"],
              ["note", "Note"]
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
            <button disabled={undoStack.length === 0} onClick={undo} type="button">
              Undo
            </button>
            <button disabled={redoStack.length === 0} onClick={redo} type="button">
              Redo
            </button>
            <button
              disabled={!projectId}
              onClick={() => void createSnapshot()}
              title="Snapshot (Ctrl+Shift+S)"
              type="button"
            >
              Snapshot
            </button>
            <button
              disabled={!projectId}
              onClick={() => void exportSessionPackQuick()}
              title="Quick session pack export"
              type="button"
            >
              Session Pack
            </button>
            <button
              aria-pressed={aiPanelOpen}
              className={aiPanelOpen ? "active" : ""}
              onClick={() => setAiPanelOpen((value) => !value)}
              title="Toggle AI assist drawer"
              type="button"
            >
              AI Assist
            </button>
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
          <span>Undo {undoStack.length} / Redo {redoStack.length}</span>
          <span>{hoverCell ? `Cell ${hoverCell.x}, ${hoverCell.y}` : "Cell -"}</span>
          <span>{document.width} x {document.height}</span>
        </footer>
      </section>

      {aiPanelOpen ? (
        <aside className="asset-details editor-ai-drawer" aria-label="AI assist drawer">
          <h2>AI Assist</h2>
          <p className="muted">
            Inline access to the configured AI provider. Configure with <code>AI_PROVIDER</code>, <code>AI_API_KEY</code>.
          </p>
          <label className="field">
            <span>Request</span>
            <textarea
              onChange={(event) => setAiRequest(event.target.value)}
              placeholder="e.g. Add tactical interest to the throne room…"
              rows={3}
              value={aiRequest}
            />
          </label>
          <div className="field-row">
            <button disabled={aiBusy} onClick={() => void runAiDescribeMap()} type="button">
              {aiBusy ? "Working…" : "Describe map"}
            </button>
            <button disabled={aiBusy || !selectedRoom} onClick={() => void runAiSuggestForSelectedRoom()} type="button">
              {aiBusy ? "Working…" : "Suggest assets for room"}
            </button>
            <button disabled={aiBusy || aiRequest.trim().length === 0} onClick={() => void generateAssetFromPrompt()} type="button">
              {aiBusy ? "Working…" : "Generate asset from prompt"}
            </button>
          </div>
          {aiDescription ? (
            <section className="detail-block">
              <h3>Description</h3>
              <p>{aiDescription}</p>
            </section>
          ) : null}
          {aiSuggestions.length > 0 ? (
            <section className="detail-block">
              <h3>Suggestions</h3>
              <ul>
                {aiSuggestions.map((suggestion, index) => (
                  <li key={`${suggestion}-${index}`}>{suggestion}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      ) : null}

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
            <dt>Selected Assets</dt>
            <dd>{selectedAssetIds.length}</dd>
          </div>
          <div>
            <dt>Asset Layer</dt>
            <dd>{selectedAsset ? layerLabel(assetToLayerKind(selectedAsset.layer)) : "none"}</dd>
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
            <dt>Selected Note</dt>
            <dd>{selectedNote?.title ?? "none"}</dd>
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

        <section className="detail-block editor-layer-controls">
          <h3>Layers</h3>
          <div className="editor-layer-list">
            {editorLayers.map((layer) => (
              <article key={layer.id}>
                <header>
                  <strong>{layer.name}</strong>
                  <span>{Math.round(layer.opacity * 100)}%</span>
                </header>
                <div className="editor-layer-row">
                  <label className="editor-checkbox">
                    <input
                      checked={layer.visible}
                      onChange={(event) => updateLayer(layer.kind, { visible: event.target.checked })}
                      type="checkbox"
                    />
                    <span>Visible</span>
                  </label>
                  <label className="editor-checkbox">
                    <input
                      checked={layer.locked}
                      onChange={(event) => updateLayer(layer.kind, { locked: event.target.checked })}
                      type="checkbox"
                    />
                    <span>Lock</span>
                  </label>
                </div>
                <input
                  aria-label={`${layer.name} opacity`}
                  max={1}
                  min={0}
                  onChange={(event) => updateLayer(layer.kind, { opacity: Number(event.target.value) })}
                  step={0.05}
                  type="range"
                  value={layer.opacity}
                />
              </article>
            ))}
          </div>
        </section>

        {selectedAsset ? (
          <section className="detail-block editor-transform-controls">
            <h3>Asset Transform</h3>
            <label>
              <span>Layer</span>
              <select
                onChange={(event) => updateSelectedAssetLayer(event.target.value as MapDocument["assets"][number]["layer"])}
                value={selectedAsset.layer}
              >
                <option value="floor">Floor</option>
                <option value="wall">Wall</option>
                <option value="object">Props</option>
                <option value="lighting">Lighting</option>
                <option value="annotation">GM Only</option>
              </select>
            </label>
            <label>
              <span>Rotation</span>
              <input
                max={359}
                min={0}
                onChange={(event) => updateSelectedAssetTransform({ rotation: Number(event.target.value) })}
                step={1}
                type="number"
                value={Math.round(selectedAsset.rotation)}
              />
            </label>
            <div className="editor-action-row">
              <button
                onClick={() => updateSelectedAssetTransform({ rotation: selectedAsset.rotation - 15 })}
                type="button"
              >
                Rotate -15
              </button>
              <button
                onClick={() => updateSelectedAssetTransform({ rotation: selectedAsset.rotation + 15 })}
                type="button"
              >
                Rotate +15
              </button>
            </div>
            <label>
              <span>Scale</span>
              <input
                max={4}
                min={0.25}
                onChange={(event) => updateSelectedAssetTransform({ scale: Number(event.target.value) })}
                step={0.05}
                type="number"
                value={selectedAsset.scale}
              />
            </label>
            <div className="editor-action-row">
              <button onClick={() => updateSelectedAssetTransform({ flipX: !selectedAsset.flipX })} type="button">
                Flip H
              </button>
              <button onClick={() => updateSelectedAssetTransform({ flipY: !selectedAsset.flipY })} type="button">
                Flip V
              </button>
              <button onClick={duplicateSelectedAsset} type="button">
                Duplicate
              </button>
            </div>
          </section>
        ) : null}

        <section className="detail-block editor-selection-controls">
          <h3>Asset Selection</h3>
          <div className="editor-action-row">
            <button onClick={selectAllVisibleAssets} type="button">
              Select Visible
            </button>
            <button disabled={selectedAssetIds.length === 0} onClick={clearAssetSelection} type="button">
              Clear
            </button>
          </div>
          <div className="editor-action-row">
            <button disabled={selectedAssetIds.length === 0 && !selectedAssetId} onClick={copySelectedAssets} type="button">
              Copy
            </button>
            <button onClick={pasteAssetClipboard} type="button">
              Paste
            </button>
          </div>
          <div className="editor-action-row">
            <button disabled={selectedAssetIds.length < 2} onClick={groupSelectedAssets} type="button">
              Group
            </button>
            <button disabled={selectedAssetIds.length === 0 && !selectedAssetId} onClick={ungroupSelectedAssets} type="button">
              Ungroup
            </button>
          </div>
        </section>

        <section className="detail-block editor-light-controls">
          <h3>Lighting Preview</h3>
          <label className="editor-checkbox">
            <input
              checked={fogPreviewEnabled}
              onChange={(event) => setFogPreviewEnabled(event.target.checked)}
              type="checkbox"
            />
            <span>Fog Preview</span>
          </label>
          {selectedLight ? (
            <>
              <label>
                <span>Radius</span>
                <input
                  max={20}
                  min={1}
                  onChange={(event) => updateSelectedLight({ radius: Number(event.target.value) })}
                  step={0.5}
                  type="number"
                  value={selectedLight.radius}
                />
              </label>
              <label>
                <span>Intensity</span>
                <input
                  max={1}
                  min={0}
                  onChange={(event) => updateSelectedLight({ intensity: Number(event.target.value) })}
                  step={0.05}
                  type="number"
                  value={selectedLight.intensity}
                />
              </label>
              <label>
                <span>Color</span>
                <input
                  onChange={(event) => updateSelectedLight({ color: event.target.value })}
                  type="color"
                  value={selectedLight.color}
                />
              </label>
              <label className="editor-checkbox">
                <input
                  checked={selectedLight.flicker}
                  onChange={(event) => updateSelectedLight({ flicker: event.target.checked })}
                  type="checkbox"
                />
                <span>Flicker</span>
              </label>
            </>
          ) : (
            <p>{document.plan?.lights.length ?? 0} lights on this map.</p>
          )}
        </section>

        <section className="detail-block editor-note-controls">
          <h3>GM Notes</h3>
          <label>
            <span>Draft</span>
            <textarea onChange={(event) => setNoteDraft(event.target.value)} value={noteDraft} />
          </label>
          <button onClick={addNoteAtHoverCell} type="button">
            Add Note
          </button>
          {selectedNote ? (
            <article className="editor-note-card">
              <input
                aria-label="Note title"
                onChange={(event) => updateSelectedNote({ title: event.target.value })}
                value={selectedNote.title}
              />
              <textarea onChange={(event) => updateSelectedNote({ text: event.target.value })} value={selectedNote.text} />
              <button onClick={deleteSelectedNote} type="button">
                Delete Note
              </button>
            </article>
          ) : null}
          <div className="editor-note-list">
            {(document.plan?.gmNotes ?? []).map((note) => (
              <button
                className={selectedNote?.id === note.id ? "active" : ""}
                key={note.id}
                onClick={() => setSelectedElement({ id: note.id, type: "note" })}
                type="button"
              >
                {note.title}
              </button>
            ))}
          </div>
        </section>

        <section className="detail-block editor-initiative-controls">
          <h3>Initiative</h3>
          <div className="editor-initiative-form">
            <input
              aria-label="Initiative name"
              onChange={(event) => setInitiativeDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Name"
              value={initiativeDraft.name}
            />
            <input
              aria-label="Initiative value"
              onChange={(event) => setInitiativeDraft((current) => ({ ...current, initiative: event.target.value }))}
              type="number"
              value={initiativeDraft.initiative}
            />
            <input
              aria-label="Hit points"
              onChange={(event) => setInitiativeDraft((current) => ({ ...current, hitPoints: event.target.value }))}
              placeholder="HP"
              type="number"
              value={initiativeDraft.hitPoints}
            />
            <select
              aria-label="Side"
              onChange={(event) =>
                setInitiativeDraft((current) => ({ ...current, side: event.target.value as InitiativeEntry["side"] }))
              }
              value={initiativeDraft.side}
            >
              <option value="enemy">Enemy</option>
              <option value="player">Player</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
          <button onClick={addInitiativeDraft} type="button">
            Add Turn
          </button>
          <div className="editor-initiative-list">
            {(document.plan?.initiative ?? []).map((entry) => (
              <article key={entry.id}>
                <strong>{entry.initiative} - {entry.name}</strong>
                <span>{entry.side}{entry.hitPoints === undefined ? "" : ` / ${entry.hitPoints} HP`}</span>
                <div className="editor-action-row">
                  <button onClick={() => damageInitiativeEntry(entry, 1)} type="button">
                    -1 HP
                  </button>
                  <button onClick={() => damageInitiativeEntry(entry, 5)} type="button">
                    -5 HP
                  </button>
                  <button onClick={() => removeInitiativeEntry(entry)} type="button">
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

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
          disabled={selectedAssetIds.length === 0 && !selectedAssetId}
          onClick={deleteSelectedAsset}
          type="button"
        >
          Delete Selected Asset{selectedAssetIds.length > 1 ? "s" : ""}
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

const RECENT_GENERATED_STORAGE_KEY = "dm-instamap-editor-recent-generated";

function loadRecentGeneratedFromStorage(): EditorPaletteAsset[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_GENERATED_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry): entry is EditorPaletteAsset =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as EditorPaletteAsset).id === "string" &&
        typeof (entry as EditorPaletteAsset).name === "string"
    );
  } catch {
    return [];
  }
}

function saveRecentGeneratedToStorage(assets: EditorPaletteAsset[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(RECENT_GENERATED_STORAGE_KEY, JSON.stringify(assets));
  } catch {
    /* ignore quota errors */
  }
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
    layers: MapLayer[];
    marqueeSelection: { current: { x: number; y: number }; start: { x: number; y: number } } | null;
    selectedAssetId: string | null;
    selectedAssetIds: string[];
    selectedDoor: DoorSegment | null;
    selectedLight: LightSource | null;
    selectedNote: MapNote | null;
    selectedRoomId: string | null;
    visibleCellKeys: string[];
    viewport: { offsetX: number; offsetY: number; zoom: number };
  }
) {
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
        context.fillRect(x * CANVAS_CELL_SIZE, y * CANVAS_CELL_SIZE, CANVAS_CELL_SIZE, CANVAS_CELL_SIZE);
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
        context.fillRect(x * CANVAS_CELL_SIZE, y * CANVAS_CELL_SIZE, CANVAS_CELL_SIZE, CANVAS_CELL_SIZE);
      }
    }
  });

  drawGrid(context, document, viewport.zoom);
  drawLayer(context, layerState, "notes", () => drawRooms(context, document.plan?.rooms ?? [], selectedRoomId));
  drawLayer(context, layerState, "walls", () => {
    drawWalls(context, document.plan?.walls ?? []);
    drawDoors(context, document.plan?.doors ?? [], selectedDoor?.id ?? null);
  });
  drawLayer(context, layerState, "lighting", () => drawLights(context, document.plan?.lights ?? [], selectedLight?.id ?? null));
  drawPlacedAssets(context, document.assets, selectedAssetId, selectedAssetIds, layerState);
  drawLayer(context, layerState, "notes", () => drawNotes(context, document.plan?.gmNotes ?? [], selectedNote?.id ?? null));
  drawLayer(context, layerState, "lighting", () => drawFogPreview(context, document, visibleCellKeys));

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
    const bounds = createSelectionBounds(marqueeSelection.start, marqueeSelection.current);
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
    const flickerScale = light.flicker ? 0.88 : 1;
    context.beginPath();
    context.fillStyle = light.id === selectedLightId ? "#f4efe7" : light.color;
    context.arc(x, y, CANVAS_CELL_SIZE * 0.28, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(215, 164, 71, 0.25)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(x, y, light.radius * CANVAS_CELL_SIZE * flickerScale, 0, Math.PI * 2);
    context.stroke();
  }
}

function drawNotes(context: CanvasRenderingContext2D, notes: MapNote[], selectedNoteId: string | null) {
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

function drawFogPreview(context: CanvasRenderingContext2D, document: MapDocument, visibleCellKeys: string[]) {
  if (visibleCellKeys.length === 0) {
    return;
  }

  const visibleCells = new Set(visibleCellKeys);
  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.52)";

  for (let y = 0; y < document.height; y += 1) {
    for (let x = 0; x < document.width; x += 1) {
      if (!visibleCells.has(cellKey(x, y))) {
        context.fillRect(x * CANVAS_CELL_SIZE, y * CANVAS_CELL_SIZE, CANVAS_CELL_SIZE, CANVAS_CELL_SIZE);
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
    context.fillStyle = asset.id === selectedAssetId || selectedAssetSet.has(asset.id) ? "#d7a447" : "#78a890";
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

function createLayerState(layers: MapLayer[]): Map<MapLayerKind, { opacity: number; visible: boolean }> {
  return new Map(layers.map((layer) => [layer.kind, { opacity: layer.opacity, visible: layer.visible }]));
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

function isSelectionVisible(document: MapDocument, selection: NonNullable<EditorSelection>): boolean {
  if (selection.type === "asset") {
    const asset = document.assets.find((candidate) => candidate.id === selection.id);
    return asset ? isEditorLayerVisible(document, assetToLayerKind(asset.layer)) : false;
  }

  if (selection.type === "door") {
    return isEditorLayerVisible(document, "walls");
  }

  if (selection.type === "light") {
    return isEditorLayerVisible(document, "lighting");
  }

  if (selection.type === "note") {
    return isEditorLayerVisible(document, "notes");
  }

  return isEditorLayerVisible(document, "notes");
}

function createSelectionBounds(
  start: { x: number; y: number },
  current: { x: number; y: number }
): { maxX: number; maxY: number; minX: number; minY: number } {
  return {
    maxX: Math.max(start.x, current.x),
    maxY: Math.max(start.y, current.y),
    minX: Math.min(start.x, current.x),
    minY: Math.min(start.y, current.y)
  };
}

function toggleSelection(selectedIds: string[], id: string): string[] {
  return selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id];
}

function hasLockedSelectedAsset(
  document: MapDocument,
  selectedAssets: MapDocument["assets"],
  selectedAssetIds: string[]
): boolean {
  const selectedAssetSet = new Set(selectedAssetIds);
  const assets = selectedAssets.length > 0 ? selectedAssets : document.assets.filter((asset) => selectedAssetSet.has(asset.id));
  return assets.some((asset) => isEditorLayerLocked(document, assetToLayerKind(asset.layer)));
}

function isTextInputTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function toolToLayerKind(tool: EditorTool): MapLayerKind {
  switch (tool) {
    case "paint-floor":
    case "paint-empty":
      return "terrain";
    case "paint-wall":
    case "door":
      return "walls";
    case "light":
      return "lighting";
    case "note":
      return "notes";
    case "select":
      return "props";
  }
}

function assetToLayerKind(layer: MapDocument["assets"][number]["layer"]): MapLayerKind {
  switch (layer) {
    case "floor":
      return "terrain";
    case "wall":
      return "walls";
    case "lighting":
      return "lighting";
    case "annotation":
      return "gm-only";
    case "object":
    default:
      return "props";
  }
}

function layerLabel(kind: MapLayerKind): string {
  switch (kind) {
    case "background":
      return "Background";
    case "terrain":
      return "Terrain";
    case "walls":
      return "Walls";
    case "props":
      return "Props";
    case "lighting":
      return "Lighting";
    case "gm-only":
      return "GM Only";
    case "notes":
      return "Notes";
  }
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

function parseInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalInteger(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getFileName(relativePath: string): string {
  return relativePath.split(/[\\/]/u).at(-1) ?? relativePath;
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
