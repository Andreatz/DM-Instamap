// @vitest-environment happy-dom
import type { MapDocument } from "@dm-instamap/core/browser";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_NOTE_TEXT } from "@/lib/map-editor-view";
import { useNotesAndInitiative } from "./use-notes-and-initiative";

// La logica documento vive in @/lib/map-editor (testata a parte): qui isoliamo
// il wiring del sotto-hook (commit + gestione draft).
vi.mock("@/lib/map-editor", () => ({
  addInitiativeEntry: vi.fn(),
  addMapNote: vi.fn(),
  deleteInitiativeEntry: vi.fn(),
  deleteMapNote: vi.fn(),
  isEditorLayerLocked: () => false,
  updateInitiativeEntry: vi.fn(),
  updateMapNote: vi.fn()
}));

const fakeDocument = {
  layers: [],
  plan: { gmNotes: [], initiative: [] }
} as unknown as MapDocument;

function setup() {
  const commitDocument = vi.fn();
  const setStatus = vi.fn();
  const setSelectedElement = vi.fn();
  const view = renderHook(() =>
    useNotesAndInitiative({
      commitDocument,
      document: fakeDocument,
      hoverCell: null,
      selectedNote: null,
      setSelectedElement,
      setStatus
    })
  );

  return { commitDocument, setSelectedElement, setStatus, view };
}

describe("useNotesAndInitiative", () => {
  it("commits a note and resets the note draft", () => {
    const { commitDocument, view } = setup();

    act(() => {
      view.result.current.setNoteDraft("Trappola nascosta");
    });
    act(() => {
      view.result.current.addNoteAtHoverCell();
    });

    expect(commitDocument).toHaveBeenCalledTimes(1);
    expect(view.result.current.noteDraft).toBe(DEFAULT_NOTE_TEXT);
  });

  it("rejects an initiative entry without a name", () => {
    const { commitDocument, setStatus, view } = setup();

    act(() => {
      view.result.current.addInitiativeDraft();
    });

    expect(commitDocument).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(expect.stringMatching(/nome/iu));
  });

  it("commits an initiative entry with a name and resets the draft", () => {
    const { commitDocument, view } = setup();

    act(() => {
      view.result.current.setInitiativeDraft({
        hitPoints: "10",
        initiative: "12",
        name: "Goblin",
        side: "enemy"
      });
    });
    act(() => {
      view.result.current.addInitiativeDraft();
    });

    expect(commitDocument).toHaveBeenCalledTimes(1);
    expect(view.result.current.initiativeDraft.name).toBe("");
  });
});
