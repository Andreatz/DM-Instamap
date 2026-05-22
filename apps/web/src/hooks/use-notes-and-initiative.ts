"use client";

import { useState } from "react";
import type {
  InitiativeEntry,
  MapDocument,
  MapNote
} from "@dm-instamap/core/browser";
import {
  addInitiativeEntry,
  addMapNote,
  deleteInitiativeEntry,
  deleteMapNote,
  isEditorLayerLocked,
  updateInitiativeEntry,
  updateMapNote,
  type EditorSelection
} from "@/lib/map-editor";
import {
  DEFAULT_NOTE_TEXT,
  parseInteger,
  parseOptionalInteger
} from "@/lib/map-editor-view";
import type { EditorHistory } from "./use-editor-history";

type NotesAndInitiativeDeps = {
  commitDocument: EditorHistory["commitDocument"];
  document: MapDocument;
  hoverCell: { x: number; y: number } | null;
  selectedNote: MapNote | null;
  setSelectedElement: (selection: EditorSelection) => void;
  setStatus: (message: string) => void;
};

/**
 * Note GM e voci di iniziativa dell'editor. Mantiene i draft di nota e
 * iniziativa e applica le mutazioni al documento tramite commitDocument.
 */
export function useNotesAndInitiative(deps: NotesAndInitiativeDeps) {
  const {
    commitDocument,
    document,
    hoverCell,
    selectedNote,
    setSelectedElement,
    setStatus
  } = deps;
  const [noteDraft, setNoteDraft] = useState(DEFAULT_NOTE_TEXT);
  const [initiativeDraft, setInitiativeDraft] = useState({
    hitPoints: "",
    initiative: "10",
    name: "",
    side: "enemy" as InitiativeEntry["side"]
  });

  function addNoteAtHoverCell() {
    const position = hoverCell ?? { x: 0, y: 0 };

    if (isEditorLayerLocked(document, "notes")) {
      setStatus("Il livello note e bloccato");
      return;
    }

    commitDocument(
      (current) => addMapNote(current, position, noteDraft),
      `Added note at ${position.x}, ${position.y}`
    );
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

    commitDocument(
      (current) => updateMapNote(current, selectedNote.id, patch),
      "Nota aggiornata"
    );
  }

  function deleteSelectedNote() {
    if (!selectedNote) {
      return;
    }

    if (isEditorLayerLocked(document, "notes")) {
      setStatus("Il livello note e bloccato");
      return;
    }

    commitDocument(
      (current) => deleteMapNote(current, selectedNote.id),
      "Nota eliminata"
    );
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
    setInitiativeDraft({
      hitPoints: "",
      initiative: "10",
      name: "",
      side: "enemy"
    });
  }

  function damageInitiativeEntry(entry: InitiativeEntry, amount: number) {
    commitDocument(
      (current) =>
        updateInitiativeEntry(current, entry.id, {
          hitPoints: Math.max(0, (entry.hitPoints ?? 0) - amount)
        }),
      `Updated ${entry.name}`
    );
  }

  function removeInitiativeEntry(entry: InitiativeEntry) {
    commitDocument(
      (current) => deleteInitiativeEntry(current, entry.id),
      `Removed ${entry.name}`
    );
  }

  return {
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
  };
}
