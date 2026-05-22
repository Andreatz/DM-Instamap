"use client";

import type { MapDocument } from "@dm-instamap/core/browser";
import { parseMapDocumentJson, serializeMapDocument } from "@/lib/map-editor";
import { DOCUMENT_STORAGE_KEY } from "@/lib/map-editor-view";
import type { EditorHistory } from "./use-editor-history";

type EditorPersistenceDeps = {
  document: MapDocument;
  jsonText: string;
  projectId?: string;
  resetHistory: EditorHistory["resetHistory"];
  setJsonText: (text: string) => void;
  setSelectedAssetId: (id: string | null) => void;
  setSelectedAssetIds: (ids: string[]) => void;
  setSelectedRoomId: (id: string | null) => void;
  setStatus: (message: string) => void;
};

/**
 * Persistenza del documento dell'editor: salvataggio JSON (locale + progetto),
 * caricamento dal textarea JSON e dal documento salvato in locale.
 */
export function useEditorPersistence(deps: EditorPersistenceDeps) {
  const {
    document,
    jsonText,
    projectId,
    resetHistory,
    setJsonText,
    setSelectedAssetId,
    setSelectedAssetIds,
    setSelectedRoomId,
    setStatus
  } = deps;

  async function saveJson() {
    const serialized = serializeMapDocument(document);
    setJsonText(serialized);
    window.localStorage.setItem(DOCUMENT_STORAGE_KEY, serialized);

    if (!projectId) {
      setStatus("JSON salvato in locale");
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}`,
        {
          body: JSON.stringify({ document }),
          headers: {
            "Content-Type": "application/json"
          },
          method: "PUT"
        }
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Salvataggio progetto fallito");
      }

      setStatus("Progetto salvato");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Salvataggio progetto fallito"
      );
    }
  }

  function loadJson() {
    try {
      const parsed = parseMapDocumentJson(jsonText);
      resetHistory(parsed);
      setSelectedAssetId(null);
      setSelectedAssetIds([]);
      setSelectedRoomId(
        parsed.plan?.rooms.find((room) => room.kind === "entrance")?.id ?? null
      );
      setStatus("JSON MapDocument caricato");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Impossibile caricare il JSON"
      );
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

  return { loadJson, loadLocal, saveJson };
}
