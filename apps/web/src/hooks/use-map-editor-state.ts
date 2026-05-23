"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MapDocument,
  MapLayer,
  MapLayerKind
} from "@dm-instamap/core/browser";
import {
  matchAssetGroupsForRoom,
  type MatchableAssetGroup
} from "@dm-instamap/assets/matcher";
import { autoFurnishMap, type FurnishingDensity } from "@dm-instamap/generator";
import {
  computeVisibleCells,
  ensureEditorLayers,
  isEditorLayerVisible,
  serializeMapDocument,
  updateMapLayer,
  type EditorPaletteAsset,
  type EditorSelection,
  type EditorTool
} from "@/lib/map-editor";
import { useAssetImages } from "@/hooks/use-asset-images";
import type { AssetSearchApiResult } from "@/lib/asset-search";
import { drawMapCanvas } from "@/lib/map-canvas-renderer";
import {
  createFurnishingAssetGroups,
  createFurnishingAssets,
  isTextInputTarget,
  loadRecentGeneratedFromStorage,
  type ExportFormat
} from "@/lib/map-editor-view";
import { useAssetClipboard } from "./use-asset-clipboard";
import { useAssetSelection } from "./use-asset-selection";
import { useCanvasInteraction } from "./use-canvas-interaction";
import { useCanvasViewport } from "./use-canvas-viewport";
import { useEditorAi } from "./use-editor-ai";
import { useEditorExport } from "./use-editor-export";
import { useEditorHistory } from "./use-editor-history";
import { useEditorPersistence } from "./use-editor-persistence";
import { useLightingTools } from "./use-lighting-tools";
import { useNotesAndInitiative } from "./use-notes-and-initiative";

export type MapEditorStateOptions = {
  assetGroups: MatchableAssetGroup[];
  initialDocument: MapDocument;
  mapTheme: string;
  palette: EditorPaletteAsset[];
  projectId?: string;
};

export type MapEditorController = ReturnType<typeof useMapEditorState>;

export function useMapEditorState({
  assetGroups,
  initialDocument,
  mapTheme,
  palette,
  projectId
}: MapEditorStateOptions) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [editorTool, setEditorTool] = useState<EditorTool>("select");
  const [selectedElement, setSelectedElement] = useState<EditorSelection>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(
    "room-entrance"
  );
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(
    null
  );
  const [canvasSize, setCanvasSize] = useState({ height: 620, width: 900 });
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [dragStartCell, setDragStartCell] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [marqueeSelection, setMarqueeSelection] = useState<{
    current: { x: number; y: number };
    start: { x: number; y: number };
  } | null>(null);
  const [fogPreviewEnabled, setFogPreviewEnabled] = useState(true);
  const [furnishingDensity, setFurnishingDensity] =
    useState<FurnishingDensity>("rich");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportIncludeGrid, setExportIncludeGrid] = useState(true);
  const [exportScale, setExportScale] = useState(1);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetSearchResults, setAssetSearchResults] = useState<
    AssetSearchApiResult[]
  >([]);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState("Pronto");
  const [isHydrated, setIsHydrated] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiRequest, setAiRequest] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDescription, setAiDescription] = useState<string>("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [recentGenerated, setRecentGenerated] = useState<EditorPaletteAsset[]>(
    () => loadRecentGeneratedFromStorage()
  );

  const clearSelectionState = useCallback(() => {
    setSelectedAssetId(null);
    setSelectedAssetIds([]);
    setSelectedElement(null);
  }, []);

  const {
    commitDocument,
    document,
    redo,
    redoStack,
    resetHistory,
    undo,
    undoStack
  } = useEditorHistory(initialDocument, {
    onNavigate: clearSelectionState,
    setStatus
  });

  const {
    handleWheel,
    panStart,
    resetViewport,
    screenToCell,
    setPanStart,
    setViewport,
    viewport,
    zoomBy
  } = useCanvasViewport({
    canvasRef,
    documentHeight: document.height,
    documentWidth: document.width
  });

  const [jsonText, setJsonText] = useState(() =>
    serializeMapDocument(ensureEditorLayers(initialDocument))
  );

  const rooms =
    document.plan?.rooms.filter(
      (room) => room.kind === "room" || room.kind === "entrance"
    ) ?? [];
  const editorLayers = [...document.layers].sort(
    (left, right) => left.order - right.order
  );
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedAsset =
    document.assets.find((asset) => asset.id === selectedAssetId) ?? null;
  const selectedAssets = document.assets.filter((asset) =>
    selectedAssetIds.includes(asset.id)
  );
  const selectedDoor =
    selectedElement?.type === "door"
      ? (document.plan?.doors.find((door) => door.id === selectedElement.id) ??
        null)
      : null;
  const selectedLight =
    selectedElement?.type === "light"
      ? (document.plan?.lights.find(
          (light) => light.id === selectedElement.id
        ) ?? null)
      : null;
  const selectedNote =
    selectedElement?.type === "note"
      ? (document.plan?.gmNotes.find(
          (note) => note.id === selectedElement.id
        ) ?? null)
      : null;

  const {
    addInitiativeDraft,
    addNoteAtHoverCell,
    damageInitiativeEntry,
    deleteSelectedNote,
    initiativeDraft,
    noteDraft,
    removeInitiativeEntry,
    setInitiativeDraft,
    setNoteDraft,
    updateSelectedNote
  } = useNotesAndInitiative({
    commitDocument,
    document,
    hoverCell,
    selectedNote,
    setSelectedElement,
    setStatus
  });

  const {
    clearAssetSelection,
    deleteSelectedAsset,
    duplicateSelectedAsset,
    groupSelectedAssets,
    selectAllVisibleAssets,
    ungroupSelectedAssets,
    updateSelectedAssetLayer,
    updateSelectedAssetTransform
  } = useAssetSelection({
    commitDocument,
    document,
    selectedAsset,
    selectedAssetId,
    selectedAssetIds,
    selectedAssets,
    setSelectedAssetId,
    setSelectedAssetIds,
    setSelectedElement,
    setStatus
  });

  const { copySelectedAssets, pasteAssetClipboard } = useAssetClipboard({
    commitDocument,
    document,
    selectedAssetId,
    selectedAssetIds,
    setSelectedAssetId,
    setSelectedAssetIds,
    setSelectedElement,
    setStatus
  });

  const { updateSelectedLight } = useLightingTools({
    commitDocument,
    document,
    selectedLight,
    setStatus
  });

  const {
    handleCanvasDrop,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp
  } = useCanvasInteraction({
    assetSearchResults,
    commitDocument,
    document,
    dragStartCell,
    draggingAssetId,
    editorTool,
    marqueeSelection,
    palette,
    panStart,
    screenToCell,
    selectedAssetIds,
    setDragStartCell,
    setDraggingAssetId,
    setHoverCell,
    setMarqueeSelection,
    setPanStart,
    setSelectedAssetId,
    setSelectedAssetIds,
    setSelectedElement,
    setSelectedRoomId,
    setStatus,
    setViewport,
    viewport
  });

  const {
    generateAssetFromPrompt,
    handleFindMatchingAssets,
    runAiDescribeMap,
    runAiSuggestForSelectedRoom
  } = useEditorAi({
    aiBusy,
    aiRequest,
    assetSearchQuery,
    document,
    mapTheme,
    recentGenerated,
    selectedRoom,
    setAiBusy,
    setAiDescription,
    setAiSuggestions,
    setAssetSearchResults,
    setRecentGenerated,
    setStatus
  });

  const { loadJson, loadLocal, saveJson } = useEditorPersistence({
    document,
    jsonText,
    projectId,
    resetHistory,
    setJsonText,
    setSelectedAssetId,
    setSelectedAssetIds,
    setSelectedRoomId,
    setStatus
  });

  const { createSnapshot, exportSessionPackQuick, handleExport } =
    useEditorExport({
      document,
      exportFormat,
      exportIncludeGrid,
      exportScale,
      projectId,
      setIsExporting,
      setStatus
    });

  const visibleCellKeys = useMemo(
    () => (fogPreviewEnabled ? computeVisibleCells(document) : []),
    [document, fogPreviewEnabled]
  );
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

      if (
        event.key.toLowerCase() === "y" ||
        (event.key.toLowerCase() === "z" && event.shiftKey)
      ) {
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
  }, [
    copySelectedAssets,
    createSnapshot,
    pasteAssetClipboard,
    redo,
    undo,
    // biome-ignore lint/correctness/useExhaustiveDependencies: closure non memoizzata, stabilizzazione con useCallback prevista in Fase C
    toggleGmLayerVisibility
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;

    if (!canvas || !container) {
      return;
    }

    const updateSize = () => {
      setCanvasSize({
        height: Math.max(
          460,
          Math.min(760, Math.floor(window.innerHeight * 0.68))
        ),
        width: Math.max(620, container.clientWidth - 28)
      });
    };
    const observer = new ResizeObserver(updateSize);
    updateSize();
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const assetImageSources = useMemo(() => {
    const sources = new Map<string, string>();
    for (const asset of document.assets) {
      if (!sources.has(asset.assetId)) {
        sources.set(
          asset.assetId,
          `/assets/preview/${encodeURIComponent(asset.assetId)}`
        );
      }
    }
    return sources;
  }, [document.assets]);
  const assetImages = useAssetImages(assetImageSources);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    drawMapCanvas(canvas, {
      assetImages,
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
    assetImages,
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

  function updateLayer(
    layerKind: MapLayerKind,
    patch: Partial<Pick<MapLayer, "locked" | "opacity" | "visible">>
  ) {
    commitDocument(
      (current) => updateMapLayer(current, layerKind, patch),
      "Livello aggiornato"
    );
  }

  function toggleGmLayerVisibility() {
    updateLayer("gm-only", {
      visible: !isEditorLayerVisible(document, "gm-only")
    });
  }

  function handleAutoFurnish() {
    const furnishingAssets = createFurnishingAssets(
      assetGroups,
      palette,
      assetSearchResults
    );
    const result = autoFurnishMap(document, {
      assetGroups: createFurnishingAssetGroups(assetGroups),
      assets: furnishingAssets,
      density: furnishingDensity,
      styleTags: [mapTheme]
    });

    commitDocument(
      () => ensureEditorLayers(result.document),
      `Arredamento automatico: ${result.summary.placedCount} asset piazzati, ${result.summary.skippedCount} saltati`
    );
    setSelectedAssetId(null);
    setSelectedAssetIds([]);
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
