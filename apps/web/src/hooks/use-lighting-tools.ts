"use client";

import type { MapDocument } from "@dm-instamap/core/browser";
import { isEditorLayerLocked, updateLightSource } from "@/lib/map-editor";
import type { EditorHistory } from "./use-editor-history";

type SelectedLight = NonNullable<MapDocument["plan"]>["lights"][number];

type LightingToolsDeps = {
  commitDocument: EditorHistory["commitDocument"];
  document: MapDocument;
  selectedLight: SelectedLight | null;
  setStatus: (message: string) => void;
};

/**
 * Strumenti di illuminazione dell'editor: aggiornamento della luce selezionata.
 */
export function useLightingTools(deps: LightingToolsDeps) {
  const { commitDocument, document, selectedLight, setStatus } = deps;

  function updateSelectedLight(patch: Parameters<typeof updateLightSource>[2]) {
    if (!selectedLight) {
      return;
    }

    if (isEditorLayerLocked(document, "lighting")) {
      setStatus("Il livello luci e bloccato");
      return;
    }

    commitDocument(
      (current) => updateLightSource(current, selectedLight.id, patch),
      "Luce aggiornata"
    );
  }

  return { updateSelectedLight };
}
