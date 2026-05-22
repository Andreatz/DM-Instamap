"use client";

import type { MapDocument } from "@dm-instamap/core/browser";
import {
  createPlacedAssetClipboard,
  pastePlacedAssetClipboard,
  type EditorSelection,
  type PlacedAssetClipboard
} from "@/lib/map-editor";
import { CLIPBOARD_STORAGE_KEY } from "@/lib/map-editor-view";
import type { EditorHistory } from "./use-editor-history";

type AssetClipboardDeps = {
  commitDocument: EditorHistory["commitDocument"];
  document: MapDocument;
  selectedAssetId: string | null;
  selectedAssetIds: string[];
  setSelectedAssetId: (id: string | null) => void;
  setSelectedAssetIds: (ids: string[]) => void;
  setSelectedElement: (selection: EditorSelection) => void;
  setStatus: (message: string) => void;
};

/**
 * Copia/incolla degli asset piazzati tramite la clipboard locale.
 */
export function useAssetClipboard(deps: AssetClipboardDeps) {
  const {
    commitDocument,
    document,
    selectedAssetId,
    selectedAssetIds,
    setSelectedAssetId,
    setSelectedAssetIds,
    setSelectedElement,
    setStatus
  } = deps;

  function copySelectedAssets() {
    const assetIds =
      selectedAssetIds.length > 0
        ? selectedAssetIds
        : selectedAssetId
          ? [selectedAssetId]
          : [];

    if (assetIds.length === 0) {
      return;
    }

    const clipboard = createPlacedAssetClipboard(document, assetIds);
    window.localStorage.setItem(
      CLIPBOARD_STORAGE_KEY,
      JSON.stringify(clipboard)
    );
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
      commitDocument(
        () => result.document,
        `Pasted ${result.pastedIds.length} asset${result.pastedIds.length === 1 ? "" : "s"}`
      );
      setSelectedAssetIds(result.pastedIds);
      setSelectedAssetId(lastPastedId);
      setSelectedElement(
        lastPastedId ? { id: lastPastedId, type: "asset" } : null
      );
    } catch {
      setStatus("I dati dell'asset copiato non sono validi");
    }
  }

  return { copySelectedAssets, pasteAssetClipboard };
}
