import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MapDocument } from "@dm-instamap/core/browser";
import { ensureEditorLayers, serializeMapDocument } from "@/lib/map-editor";
import { HISTORY_LIMIT } from "@/lib/map-editor-view";

export type EditorHistory = {
  commitDocument: (
    updater: (current: MapDocument) => MapDocument,
    message?: string
  ) => void;
  document: MapDocument;
  redo: () => void;
  redoStack: MapDocument[];
  resetHistory: (next: MapDocument) => void;
  setDocument: Dispatch<SetStateAction<MapDocument>>;
  undo: () => void;
  undoStack: MapDocument[];
};

/**
 * Owns the editable MapDocument plus its undo/redo stacks. Selection clearing
 * and status messages are delegated to the caller so the hook stays focused on
 * history mechanics.
 */
export function useEditorHistory(
  initialDocument: MapDocument,
  options: { onNavigate: () => void; setStatus: (message: string) => void }
): EditorHistory {
  const { onNavigate, setStatus } = options;
  const [document, setDocument] = useState(() =>
    ensureEditorLayers(initialDocument)
  );
  const [undoStack, setUndoStack] = useState<MapDocument[]>([]);
  const [redoStack, setRedoStack] = useState<MapDocument[]>([]);

  const commitDocument = useCallback(
    (updater: (current: MapDocument) => MapDocument, message?: string) => {
      setDocument((current) => {
        const normalizedCurrent = ensureEditorLayers(current);
        const next = ensureEditorLayers(updater(normalizedCurrent));

        if (
          next === current ||
          serializeMapDocument(next) === serializeMapDocument(normalizedCurrent)
        ) {
          return current;
        }

        setUndoStack((history) => [
          ...history.slice(-(HISTORY_LIMIT - 1)),
          normalizedCurrent
        ]);
        setRedoStack([]);

        if (message) {
          setStatus(message);
        }

        return next;
      });
    },
    [setStatus]
  );

  const undo = useCallback(() => {
    setUndoStack((history) => {
      const previous = history.at(-1);

      if (!previous) {
        setStatus("Nessuna azione da annullare");
        return history;
      }

      setRedoStack((redoHistory) => [
        document,
        ...redoHistory.slice(0, HISTORY_LIMIT - 1)
      ]);
      setDocument(previous);
      onNavigate();
      setStatus("Annullato");
      return history.slice(0, -1);
    });
  }, [document, onNavigate, setStatus]);

  const redo = useCallback(() => {
    setRedoStack((history) => {
      const next = history[0];

      if (!next) {
        setStatus("Nessuna azione da ripristinare");
        return history;
      }

      setUndoStack((undoHistory) => [
        ...undoHistory.slice(-(HISTORY_LIMIT - 1)),
        document
      ]);
      setDocument(next);
      onNavigate();
      setStatus("Ripristinato");
      return history.slice(1);
    });
  }, [document, onNavigate, setStatus]);

  const resetHistory = useCallback((next: MapDocument) => {
    setDocument(next);
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
    commitDocument,
    document,
    redo,
    redoStack,
    resetHistory,
    setDocument,
    undo,
    undoStack
  };
}
