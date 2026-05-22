"use client";

import type { Dispatch, DragEvent, PointerEvent, SetStateAction } from "react";
import type { MapDocument } from "@dm-instamap/core/browser";
import type { AssetSearchApiResult } from "@/lib/asset-search";
import {
  addPlacedAsset,
  findRoomAtCell,
  isEditorLayerLocked,
  isEditorLayerVisible,
  movePlacedAsset,
  movePlacedAssets,
  selectElementAtCell,
  selectPlacedAssetsInBounds,
  updateDocumentForTool,
  type EditorPaletteAsset,
  type EditorSelection,
  type EditorTool
} from "@/lib/map-editor";
import {
  assetToLayerKind,
  createPaletteAsset,
  createSelectionBounds,
  createToolStatus,
  isSelectionVisible,
  layerLabel,
  readDragPayload,
  toggleSelection,
  toolToLayerKind
} from "@/lib/map-editor-view";
import type { EditorHistory } from "./use-editor-history";
import type { PanStart, Viewport } from "./use-canvas-viewport";

type Cell = { x: number; y: number };
type MarqueeSelection = { current: Cell; start: Cell };

type CanvasInteractionDeps = {
  assetSearchResults: AssetSearchApiResult[];
  commitDocument: EditorHistory["commitDocument"];
  document: MapDocument;
  dragStartCell: Cell | null;
  draggingAssetId: string | null;
  editorTool: EditorTool;
  marqueeSelection: MarqueeSelection | null;
  palette: EditorPaletteAsset[];
  panStart: PanStart;
  screenToCell: (clientX: number, clientY: number) => Cell | null;
  selectedAssetIds: string[];
  setDragStartCell: (cell: Cell | null) => void;
  setDraggingAssetId: (id: string | null) => void;
  setHoverCell: (cell: Cell | null) => void;
  setMarqueeSelection: Dispatch<SetStateAction<MarqueeSelection | null>>;
  setPanStart: Dispatch<SetStateAction<PanStart>>;
  setSelectedAssetId: (id: string | null) => void;
  setSelectedAssetIds: Dispatch<SetStateAction<string[]>>;
  setSelectedElement: (selection: EditorSelection) => void;
  setSelectedRoomId: (id: string | null) => void;
  setStatus: (message: string) => void;
  setViewport: Dispatch<SetStateAction<Viewport>>;
  viewport: Viewport;
};

/**
 * Interazione col canvas: pointer down/move/up (pittura, selezione, drag,
 * marquee, pan) e drop di asset dalla palette o riposizionamento.
 */
export function useCanvasInteraction(deps: CanvasInteractionDeps) {
  const {
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
  } = deps;

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
      const visibleSelection =
        selection && isSelectionVisible(document, selection) ? selection : null;
      setSelectedElement(visibleSelection);
      if (visibleSelection?.type === "asset") {
        const nextAssetIds =
          event.shiftKey || event.ctrlKey || event.metaKey
            ? toggleSelection(selectedAssetIds, visibleSelection.id)
            : [visibleSelection.id];
        setSelectedAssetIds(nextAssetIds);
        setSelectedAssetId(nextAssetIds.at(-1) ?? null);
        setSelectedElement(
          nextAssetIds.length > 0
            ? { id: nextAssetIds.at(-1) ?? visibleSelection.id, type: "asset" }
            : null
        );
      } else {
        setSelectedAssetIds([]);
        setSelectedAssetId(null);
      }
      setSelectedRoomId(
        visibleSelection?.type === "room"
          ? visibleSelection.id
          : (findRoomAtCell(document, cell)?.id ?? null)
      );

      if (visibleSelection?.type === "asset") {
        const asset = document.assets.find(
          (candidate) => candidate.id === visibleSelection.id
        );
        if (
          asset &&
          isEditorLayerLocked(document, assetToLayerKind(asset.layer))
        ) {
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
      setStatus(
        `Il livello ${layerLabel(toolToLayerKind(editorTool))} e bloccato`
      );
      return;
    }

    commitDocument(
      (current) => updateDocumentForTool(current, editorTool, cell),
      createToolStatus(editorTool, cell)
    );
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
        offsetX:
          panStart.offsetX + (event.clientX - panStart.pointerX) * scaleX,
        offsetY: panStart.offsetY + (event.clientY - panStart.pointerY) * scaleY
      }));
      return;
    }

    const cell = screenToCell(event.clientX, event.clientY);
    if (cell && marqueeSelection) {
      setMarqueeSelection((current) =>
        current ? { ...current, current: cell } : null
      );
    }
    setHoverCell(cell);
  }

  function handleCanvasPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const cell = screenToCell(event.clientX, event.clientY);

    if (marqueeSelection) {
      const bounds = createSelectionBounds(
        marqueeSelection.start,
        marqueeSelection.current
      );
      const assetIds = selectPlacedAssetsInBounds(document, bounds).filter(
        (assetId) => {
          const asset = document.assets.find(
            (candidate) => candidate.id === assetId
          );
          return asset
            ? isEditorLayerVisible(document, assetToLayerKind(asset.layer))
            : false;
        }
      );
      const lastAssetId = assetIds.at(-1) ?? null;
      setSelectedAssetIds(assetIds);
      setSelectedAssetId(lastAssetId);
      setSelectedElement(
        lastAssetId ? { id: lastAssetId, type: "asset" } : null
      );
      setStatus(`${assetIds.length} asset selezionati`);
    } else if (draggingAssetId && cell) {
      const asset = document.assets.find(
        (candidate) => candidate.id === draggingAssetId
      );
      if (
        asset &&
        isEditorLayerLocked(document, assetToLayerKind(asset.layer))
      ) {
        setStatus(
          `Il livello ${layerLabel(assetToLayerKind(asset.layer))} e bloccato`
        );
      } else {
        const currentSelection = selectedAssetIds.includes(draggingAssetId)
          ? selectedAssetIds
          : [draggingAssetId];
        const delta = dragStartCell
          ? { x: cell.x - dragStartCell.x, y: cell.y - dragStartCell.y }
          : null;
        if (delta && currentSelection.length > 1) {
          commitDocument(
            (current) => movePlacedAssets(current, currentSelection, delta),
            `${currentSelection.length} asset spostati di ${delta.x}, ${delta.y}`
          );
        } else {
          commitDocument(
            (current) => movePlacedAsset(current, draggingAssetId, cell),
            `Asset spostato a ${cell.x}, ${cell.y}`
          );
        }
      }
      setSelectedAssetId(draggingAssetId);
      setSelectedAssetIds((current) =>
        current.includes(draggingAssetId) ? current : [draggingAssetId]
      );
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
      const paletteAsset = createPaletteAsset(
        payload.assetId,
        palette,
        assetSearchResults
      );

      if (!paletteAsset) {
        return;
      }

      const layerKind = paletteAsset.kind === "light" ? "lighting" : "props";

      if (isEditorLayerLocked(document, layerKind)) {
        setStatus(`Il livello ${layerLabel(layerKind)} e bloccato`);
        return;
      }

      commitDocument(
        (current) => addPlacedAsset(current, paletteAsset, { x, y }),
        `Placed ${paletteAsset.name}`
      );
      return;
    }

    const asset = document.assets.find(
      (candidate) => candidate.id === payload.placedAssetId
    );
    if (asset && isEditorLayerLocked(document, assetToLayerKind(asset.layer))) {
      setStatus(
        `Il livello ${layerLabel(assetToLayerKind(asset.layer))} e bloccato`
      );
      return;
    }

    commitDocument(
      (current) => movePlacedAsset(current, payload.placedAssetId, { x, y }),
      "Asset spostato"
    );
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

  return {
    handleCanvasDrop,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp
  };
}
