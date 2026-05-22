"use client";

import type { MapDocument } from "@dm-instamap/core/browser";
import {
  deletePlacedAssets,
  duplicatePlacedAssets,
  groupPlacedAssets,
  isEditorLayerLocked,
  isEditorLayerVisible,
  ungroupPlacedAssets,
  updatePlacedAssetLayer,
  updatePlacedAssetTransform,
  type EditorSelection
} from "@/lib/map-editor";
import {
  assetToLayerKind,
  hasLockedSelectedAsset,
  layerLabel
} from "@/lib/map-editor-view";
import type { EditorHistory } from "./use-editor-history";

type PlacedAsset = MapDocument["assets"][number];

type AssetSelectionDeps = {
  commitDocument: EditorHistory["commitDocument"];
  document: MapDocument;
  selectedAsset: PlacedAsset | null;
  selectedAssetId: string | null;
  selectedAssetIds: string[];
  selectedAssets: PlacedAsset[];
  setSelectedAssetId: (id: string | null) => void;
  setSelectedAssetIds: (ids: string[]) => void;
  setSelectedElement: (selection: EditorSelection) => void;
  setStatus: (message: string) => void;
};

/**
 * Selezione e manipolazione degli asset piazzati: elimina, duplica, raggruppa,
 * separa, seleziona visibili, e aggiorna trasformazione/livello dell'asset.
 */
export function useAssetSelection(deps: AssetSelectionDeps) {
  const {
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
  } = deps;

  function deleteSelectedAsset() {
    const assetIds =
      selectedAssetIds.length > 0
        ? selectedAssetIds
        : selectedAssetId
          ? [selectedAssetId]
          : [];

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
    const assetIds =
      selectedAssetIds.length > 0
        ? selectedAssetIds
        : selectedAssetId
          ? [selectedAssetId]
          : [];

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
    const assetIds =
      selectedAssetIds.length > 0
        ? selectedAssetIds
        : selectedAssetId
          ? [selectedAssetId]
          : [];

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
    const assetIds =
      selectedAssetIds.length > 0
        ? selectedAssetIds
        : selectedAssetId
          ? [selectedAssetId]
          : [];

    if (assetIds.length === 0) {
      return;
    }

    if (hasLockedSelectedAsset(document, selectedAssets, assetIds)) {
      setStatus("Uno o piu livelli degli asset selezionati sono bloccati");
      return;
    }

    commitDocument(
      (current) => ungroupPlacedAssets(current, assetIds),
      "Asset selezionati separati"
    );
  }

  function selectAllVisibleAssets() {
    const assetIds = document.assets
      .filter((asset) =>
        isEditorLayerVisible(document, assetToLayerKind(asset.layer))
      )
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

  function updateSelectedAssetTransform(
    transform: Parameters<typeof updatePlacedAssetTransform>[2]
  ) {
    if (!selectedAssetId) {
      return;
    }

    if (
      selectedAsset &&
      isEditorLayerLocked(document, assetToLayerKind(selectedAsset.layer))
    ) {
      setStatus(
        `Il livello ${layerLabel(assetToLayerKind(selectedAsset.layer))} e bloccato`
      );
      return;
    }

    commitDocument(
      (current) =>
        updatePlacedAssetTransform(current, selectedAssetId, transform),
      "Trasformazione asset aggiornata"
    );
  }

  function updateSelectedAssetLayer(
    layer: MapDocument["assets"][number]["layer"]
  ) {
    if (!selectedAssetId) {
      return;
    }

    if (
      selectedAsset &&
      isEditorLayerLocked(document, assetToLayerKind(selectedAsset.layer))
    ) {
      setStatus(
        `Il livello ${layerLabel(assetToLayerKind(selectedAsset.layer))} e bloccato`
      );
      return;
    }

    commitDocument(
      (current) => updatePlacedAssetLayer(current, selectedAssetId, layer),
      "Asset spostato di livello"
    );
  }

  return {
    clearAssetSelection,
    deleteSelectedAsset,
    duplicateSelectedAsset,
    groupSelectedAssets,
    selectAllVisibleAssets,
    ungroupSelectedAssets,
    updateSelectedAssetLayer,
    updateSelectedAssetTransform
  };
}
