"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent } from "react";
import type { InitiativeEntry, MapDocument, MapLayer, MapLayerKind, MapNote } from "@dm-instamap/core/browser";
import { matchAssetGroupsForRoom, type MatchableAssetGroup } from "@dm-instamap/assets/matcher";
import { autoFurnishMap, type FurnishingDensity } from "@dm-instamap/generator";
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
import { drawMapCanvas } from "@/lib/map-canvas-renderer";
import {
  CLIPBOARD_STORAGE_KEY,
  DEFAULT_NOTE_TEXT,
  DOCUMENT_STORAGE_KEY,
  assetToLayerKind,
  createExportFilename,
  createFurnishingAssetGroups,
  createFurnishingAssets,
  createPaletteAsset,
  createSelectionBounds,
  createToolStatus,
  isSelectionVisible,
  isTextInputTarget,
  hasLockedSelectedAsset,
  layerLabel,
  loadRecentGeneratedFromStorage,
  parseInteger,
  parseOptionalInteger,
  readDragPayload,
  saveRecentGeneratedToStorage,
  toggleSelection,
  toolToLayerKind,
  type ExportFormat
} from "@/lib/map-editor-view";
import { useCanvasViewport } from "./use-canvas-viewport";
import { useEditorHistory } from "./use-editor-history";

export type MapEditorStateOptions = {
  assetGroups: MatchableAssetGroup[];
  initialDocument: MapDocument;
  mapTheme: string;
  palette: EditorPaletteAsset[];
  projectId?: string;
};

export type MapEditorController = ReturnType<typeof useMapEditorState>;

export function useMapEditorState({ assetGroups, initialDocument, mapTheme, palette, projectId }: MapEditorStateOptions) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [editorTool, setEditorTool] = useState<EditorTool>("select");
  const [selectedElement, setSelectedElement] = useState<EditorSelection>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>("room-entrance");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ height: 620, width: 900 });
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
  const [status, setStatus] = useState("Pronto");
  const [isHydrated, setIsHydrated] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiRequest, setAiRequest] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDescription, setAiDescription] = useState<string>("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [recentGenerated, setRecentGenerated] = useState<EditorPaletteAsset[]>(() => loadRecentGeneratedFromStorage());

  const clearSelectionState = useCallback(() => {
    setSelectedAssetId(null);
    setSelectedAssetIds([]);
    setSelectedElement(null);
  }, []);

  const { commitDocument, document, redo, redoStack, resetHistory, setDocument, undo, undoStack } = useEditorHistory(
    initialDocument,
    { onNavigate: clearSelectionState, setStatus }
  );

  const { handleWheel, panStart, resetViewport, screenToCell, setPanStart, setViewport, viewport, zoomBy } =
    useCanvasViewport({ canvasRef, documentHeight: document.height, documentWidth: document.width });

  const [jsonText, setJsonText] = useState(() => serializeMapDocument(ensureEditorLayers(initialDocument)));

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

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const createSnapshot = useCallback(async () => {
    if (!projectId) {
      setStatus("Gli snapshot richiedono un progetto salvato.");
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
    const label = `editor-${stamp.slice(0, 19)}`;

    setStatus(`Creazione snapshot ${label}...`);

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
        throw new Error(payload.error ?? "Snapshot fallito.");
      }

      setStatus(payload.snapshot.written ? `Snapshot ${label} creato.` : "Snapshot identico: non scritto.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Snapshot fallito.");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          setStatus("Il livello dell'asset selezionato e bloccato");
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraggingAssetId(visibleSelection.id);
        setDragStartCell(cell);
        setStatus("Trascina l'asset selezionato per spostarlo");
      } else if (!visibleSelection) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setMarqueeSelection({ current: cell, start: cell });
        setStatus("Selezione asset");
      }
      return;
    }

    if (isEditorLayerLocked(document, toolToLayerKind(editorTool))) {
      setStatus(`Il livello ${layerLabel(toolToLayerKind(editorTool))} e bloccato`);
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
      setStatus(`${assetIds.length} asset selezionati`);
    } else if (draggingAssetId && cell) {
      const asset = document.assets.find((candidate) => candidate.id === draggingAssetId);
      if (asset && isEditorLayerLocked(document, assetToLayerKind(asset.layer))) {
        setStatus(`Il livello ${layerLabel(assetToLayerKind(asset.layer))} e bloccato`);
      } else {
        const currentSelection = selectedAssetIds.includes(draggingAssetId) ? selectedAssetIds : [draggingAssetId];
        const delta = dragStartCell ? { x: cell.x - dragStartCell.x, y: cell.y - dragStartCell.y } : null;
        if (delta && currentSelection.length > 1) {
          commitDocument(
            (current) => movePlacedAssets(current, currentSelection, delta),
            `${currentSelection.length} asset spostati di ${delta.x}, ${delta.y}`
          );
        } else {
          commitDocument((current) => movePlacedAsset(current, draggingAssetId, cell), `Asset spostato a ${cell.x}, ${cell.y}`);
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
        setStatus(`Il livello ${layerLabel(layerKind)} e bloccato`);
        return;
      }

      commitDocument((current) => addPlacedAsset(current, paletteAsset, { x, y }), `Placed ${paletteAsset.name}`);
      return;
    }

    const asset = document.assets.find((candidate) => candidate.id === payload.placedAssetId);
    if (asset && isEditorLayerLocked(document, assetToLayerKind(asset.layer))) {
      setStatus(`Il livello ${layerLabel(assetToLayerKind(asset.layer))} e bloccato`);
      return;
    }

    commitDocument((current) => movePlacedAsset(current, payload.placedAssetId, { x, y }), "Asset spostato");
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
      setStatus("L'export Session Pack richiede un progetto salvato.");
      return;
    }

    setStatus("Esportazione Session Pack...");

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
        throw new Error(payload.error ?? "Esportazione Session Pack fallita.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${projectId}-session-pack.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("Session Pack scaricato.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Esportazione Session Pack fallita.");
    }
  }, [document.name, projectId]);

  async function saveJson() {
    const serialized = serializeMapDocument(document);
    setJsonText(serialized);
    window.localStorage.setItem(DOCUMENT_STORAGE_KEY, serialized);

    if (!projectId) {
      setStatus("JSON salvato in locale");
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
        throw new Error(payload.error ?? "Salvataggio progetto fallito");
      }

      setStatus("Progetto salvato");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Salvataggio progetto fallito");
    }
  }

  function loadJson() {
    try {
      const parsed = parseMapDocumentJson(jsonText);
      resetHistory(parsed);
      setSelectedAssetId(null);
      setSelectedAssetIds([]);
      setSelectedRoomId(parsed.plan?.rooms.find((room) => room.kind === "entrance")?.id ?? null);
      setStatus("JSON MapDocument caricato");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Impossibile caricare il JSON");
    }
  }

  function loadLocal() {
    const saved = window.localStorage.getItem(DOCUMENT_STORAGE_KEY);

    if (!saved) {
      setStatus("Nessun documento salvato localmente trovato");
      return;
    }

    setJsonText(saved);
    resetHistory(parseMapDocumentJson(saved));
    setSelectedAssetId(null);
    setSelectedAssetIds([]);
    setStatus("Documento locale salvato caricato");
  }

  function deleteSelectedAsset() {
    const assetIds = selectedAssetIds.length > 0 ? selectedAssetIds : selectedAssetId ? [selectedAssetId] : [];

    if (assetIds.length === 0) {
      return;
    }

    if (hasLockedSelectedAsset(document, selectedAssets, assetIds)) {
      setStatus("Uno o piu livelli degli asset selezionati sono bloccati");
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
      setStatus("Uno o piu livelli degli asset selezionati sono bloccati");
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
      setStatus("Seleziona almeno due asset da raggruppare");
      return;
    }

    if (hasLockedSelectedAsset(document, selectedAssets, assetIds)) {
      setStatus("Uno o piu livelli degli asset selezionati sono bloccati");
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
      setStatus("Uno o piu livelli degli asset selezionati sono bloccati");
      return;
    }

    commitDocument((current) => ungroupPlacedAssets(current, assetIds), "Asset selezionati separati");
  }

  function copySelectedAssets() {
    const assetIds = selectedAssetIds.length > 0 ? selectedAssetIds : selectedAssetId ? [selectedAssetId] : [];

    if (assetIds.length === 0) {
      return;
    }

    const clipboard = createPlacedAssetClipboard(document, assetIds);
    window.localStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(clipboard));
    setStatus(`${clipboard.assets.length} asset selezionati copiati`);
  }

  function pasteAssetClipboard() {
    const rawClipboard = window.localStorage.getItem(CLIPBOARD_STORAGE_KEY);

    if (!rawClipboard) {
      setStatus("Nessun asset copiato trovato");
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
      setStatus("I dati dell'asset copiato non sono validi");
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
    setStatus(`${assetIds.length} asset visibili selezionati`);
  }

  function clearAssetSelection() {
    setSelectedAssetIds([]);
    setSelectedAssetId(null);
    setSelectedElement(null);
    setStatus("Selezione asset cancellata");
  }

  function updateSelectedAssetTransform(transform: Parameters<typeof updatePlacedAssetTransform>[2]) {
    if (!selectedAssetId) {
      return;
    }

    if (selectedAsset && isEditorLayerLocked(document, assetToLayerKind(selectedAsset.layer))) {
      setStatus(`Il livello ${layerLabel(assetToLayerKind(selectedAsset.layer))} e bloccato`);
      return;
    }

    commitDocument((current) => updatePlacedAssetTransform(current, selectedAssetId, transform), "Trasformazione asset aggiornata");
  }

  function updateSelectedAssetLayer(layer: MapDocument["assets"][number]["layer"]) {
    if (!selectedAssetId) {
      return;
    }

    if (selectedAsset && isEditorLayerLocked(document, assetToLayerKind(selectedAsset.layer))) {
      setStatus(`Il livello ${layerLabel(assetToLayerKind(selectedAsset.layer))} e bloccato`);
      return;
    }

    commitDocument((current) => updatePlacedAssetLayer(current, selectedAssetId, layer), "Asset spostato di livello");
  }

  function updateLayer(layerKind: MapLayerKind, patch: Partial<Pick<MapLayer, "locked" | "opacity" | "visible">>) {
    commitDocument((current) => updateMapLayer(current, layerKind, patch), "Livello aggiornato");
  }

  function toggleGmLayerVisibility() {
    updateLayer("gm-only", { visible: !isEditorLayerVisible(document, "gm-only") });
  }

  function updateSelectedLight(patch: Parameters<typeof updateLightSource>[2]) {
    if (!selectedLight) {
      return;
    }

    if (isEditorLayerLocked(document, "lighting")) {
      setStatus("Il livello luci e bloccato");
      return;
    }

    commitDocument((current) => updateLightSource(current, selectedLight.id, patch), "Luce aggiornata");
  }

  function addNoteAtHoverCell() {
    const position = hoverCell ?? { x: 0, y: 0 };

    if (isEditorLayerLocked(document, "notes")) {
      setStatus("Il livello note e bloccato");
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
      setStatus("Il livello note e bloccato");
      return;
    }

    commitDocument((current) => updateMapNote(current, selectedNote.id, patch), "Nota aggiornata");
  }

  function deleteSelectedNote() {
    if (!selectedNote) {
      return;
    }

    if (isEditorLayerLocked(document, "notes")) {
      setStatus("Il livello note e bloccato");
      return;
    }

    commitDocument((current) => deleteMapNote(current, selectedNote.id), "Nota eliminata");
    setSelectedElement(null);
  }

  function addInitiativeDraft() {
    const name = initiativeDraft.name.trim();

    if (!name) {
      setStatus("La voce iniziativa richiede un nome");
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
    const furnishingAssets = createFurnishingAssets(assetGroups, palette, assetSearchResults);
    const result = autoFurnishMap(document, {
      assetGroups: createFurnishingAssetGroups(assetGroups),
      assets: furnishingAssets,
      density: furnishingDensity,
      styleTags: [mapTheme]
    });

    commitDocument(() => ensureEditorLayers(result.document), `Arredamento automatico: ${result.summary.placedCount} asset piazzati, ${result.summary.skippedCount} saltati`);
    setSelectedAssetId(null);
    setSelectedAssetIds([]);
  }

  async function handleExport() {
    setIsExporting(true);
    setStatus(`Esportazione ${exportFormat.toUpperCase()}`);

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
        throw new Error(error.error ?? "Esportazione fallita");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = createExportFilename(document.name, exportFormat);
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`${exportFormat.toUpperCase()} esportato`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Esportazione fallita");
    } finally {
      setIsExporting(false);
    }
  }

  async function runAiDescribeMap() {
    if (aiBusy) {
      return;
    }

    setAiBusy(true);
    setStatus("Richiesta descrizione mappa all'AI...");

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
        throw new Error(payload.error ?? payload.errors?.join("; ") ?? "Richiesta AI fallita.");
      }

      const blueprint = payload.blueprint;
      const description = `${blueprint.name ?? document.name} - struttura ${blueprint.structure ?? "sconosciuta"}, mood ${blueprint.mood ?? "sconosciuto"}.`;
      setAiDescription(description);
      setStatus("Descrizione AI pronta.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Richiesta AI fallita.");
    } finally {
      setAiBusy(false);
    }
  }

  async function runAiSuggestForSelectedRoom() {
    if (!selectedRoom) {
      setStatus("Seleziona una stanza prima di chiedere suggerimenti.");
      return;
    }

    setAiBusy(true);
    setAiSuggestions([]);
    setStatus(`Richiesta asset AI per ${selectedRoom.label}...`);

    try {
      const query =
        aiRequest.trim() || `${selectedRoom.label} ${selectedRoom.tags.join(" ")} ${mapTheme}`.trim();
      const response = await fetch(`/api/assets/search?q=${encodeURIComponent(query)}&limit=8`);
      const payload = (await response.json()) as { error?: string; results?: AssetSearchApiResult[] };

      if (!response.ok || !payload.results) {
        throw new Error(payload.error ?? "Suggerimento fallito.");
      }

      setAiSuggestions(payload.results.map((result) => `${result.relativePath} (${result.classification})`));
      setStatus(`${payload.results.length} suggerimenti per ${selectedRoom.label}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Suggerimento fallito.");
    } finally {
      setAiBusy(false);
    }
  }

  async function generateAssetFromPrompt() {
    const prompt = aiRequest.trim();

    if (!prompt) {
      setStatus("Scrivi un prompt prima di generare.");
      return;
    }

    setAiBusy(true);
    setStatus("Generazione asset da prompt...");

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
        throw new Error(payload.error ?? "Generazione fallita.");
      }

      const entry = payload.manifestEntry;
      if (entry) {
        const generatedAsset: EditorPaletteAsset = {
          id: entry.id,
          kind: "prop",
          name: payload.asset.filename,
          thumbnailUrl: entry.thumbnailPath ? `/${entry.thumbnailPath}` : ""
        };
        const next = [generatedAsset, ...recentGenerated.filter((item) => item.id !== entry.id)].slice(0, 12);
        setRecentGenerated(next);
        saveRecentGeneratedToStorage(next);
      }

      setStatus(`Generato ${payload.asset.filename}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generazione fallita.");
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
      setStatus("Seleziona una stanza o inserisci una ricerca asset");
      return;
    }

    setStatus("Ricerca asset locali");

    try {
      const response = await fetch(`/api/assets/search?q=${encodeURIComponent(query)}&limit=12`);
      const payload = (await response.json()) as { results?: AssetSearchApiResult[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Ricerca asset locale fallita");
      }

      setAssetSearchResults(payload.results ?? []);
      setStatus(`${payload.results?.length ?? 0} suggerimenti asset locali`);
    } catch (error) {
      setAssetSearchResults([]);
      setStatus(error instanceof Error ? error.message : "Ricerca asset locale fallita");
    }
  }

  return {
    // static inputs
    assetGroups,
    mapTheme,
    palette,
    projectId,
    // refs + canvas
    canvasRef,
    canvasSize,
    // document + history
    document,
    redo,
    redoStack,
    undo,
    undoStack,
    // viewport
    handleWheel,
    resetViewport,
    viewport,
    zoomBy,
    // tool + selection state
    editorTool,
    setEditorTool,
    hoverCell,
    setHoverCell,
    selectedRoomId,
    setSelectedRoomId,
    selectedAssetId,
    selectedAssetIds,
    setSelectedElement,
    // derived
    editorLayers,
    roomMatches,
    rooms,
    selectedAsset,
    selectedDoor,
    selectedLight,
    selectedNote,
    selectedRoom,
    // ui state
    aiBusy,
    aiDescription,
    aiPanelOpen,
    aiRequest,
    aiSuggestions,
    assetSearchQuery,
    assetSearchResults,
    exportFormat,
    exportIncludeGrid,
    exportScale,
    fogPreviewEnabled,
    furnishingDensity,
    initiativeDraft,
    isExporting,
    isHydrated,
    jsonText,
    noteDraft,
    recentGenerated,
    status,
    setAiPanelOpen,
    setAiRequest,
    setAssetSearchQuery,
    setExportFormat,
    setExportIncludeGrid,
    setExportScale,
    setFogPreviewEnabled,
    setFurnishingDensity,
    setInitiativeDraft,
    setJsonText,
    setNoteDraft,
    // canvas handlers
    handleCanvasDrop,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    // commands
    addInitiativeDraft,
    addNoteAtHoverCell,
    clearAssetSelection,
    copySelectedAssets,
    createSnapshot,
    damageInitiativeEntry,
    deleteSelectedAsset,
    deleteSelectedNote,
    duplicateSelectedAsset,
    exportSessionPackQuick,
    generateAssetFromPrompt,
    groupSelectedAssets,
    handleAutoFurnish,
    handleExport,
    handleFindMatchingAssets,
    loadJson,
    loadLocal,
    pasteAssetClipboard,
    removeInitiativeEntry,
    runAiDescribeMap,
    runAiSuggestForSelectedRoom,
    saveJson,
    selectAllVisibleAssets,
    ungroupSelectedAssets,
    updateLayer,
    updateSelectedAssetLayer,
    updateSelectedAssetTransform,
    updateSelectedLight,
    updateSelectedNote
  };
}
