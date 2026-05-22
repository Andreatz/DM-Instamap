"use client";

import type { EditorTool } from "@/lib/map-editor";
import type { MapEditorController } from "@/hooks/use-map-editor-state";

const TOOLS: Array<[EditorTool, string]> = [
  ["select", "Seleziona"],
  ["paint-floor", "Pavimento"],
  ["paint-wall", "Muro"],
  ["paint-empty", "Cancella"],
  ["door", "Porta"],
  ["light", "Luce"],
  ["note", "Note"]
];

export function EditorCanvasToolbar({
  editor
}: {
  editor: MapEditorController;
}) {
  const {
    aiPanelOpen,
    createSnapshot,
    editorTool,
    exportSessionPackQuick,
    projectId,
    redo,
    redoStack,
    resetViewport,
    setAiPanelOpen,
    setEditorTool,
    undo,
    undoStack,
    viewport,
    zoomBy
  } = editor;

  return (
    <div className="editor-canvas-toolbar">
      <div
        className="editor-tool-grid"
        role="toolbar"
        aria-label="Strumenti editor"
      >
        {TOOLS.map(([tool, label]) => (
          <button
            className={editorTool === tool ? "active" : ""}
            key={tool}
            onClick={() => setEditorTool(tool)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="editor-viewport-actions">
        <button disabled={undoStack.length === 0} onClick={undo} type="button">
          Annulla
        </button>
        <button disabled={redoStack.length === 0} onClick={redo} type="button">
          Ripristina
        </button>
        <button
          disabled={!projectId}
          onClick={() => void createSnapshot()}
          title="Snapshot (Ctrl+Shift+S)"
          type="button"
        >
          Snapshot
        </button>
        <button
          disabled={!projectId}
          onClick={() => void exportSessionPackQuick()}
          title="Esportazione rapida Session Pack"
          type="button"
        >
          Session Pack
        </button>
        <button
          aria-pressed={aiPanelOpen}
          className={aiPanelOpen ? "active" : ""}
          onClick={() => setAiPanelOpen((value) => !value)}
          title="Mostra/nascondi pannello assistente AI"
          type="button"
        >
          Assistente AI
        </button>
        <button onClick={() => zoomBy(-0.15)} type="button">
          Zoom -
        </button>
        <span>{Math.round(viewport.zoom * 100)}%</span>
        <button onClick={() => zoomBy(0.15)} type="button">
          Zoom +
        </button>
        <button onClick={resetViewport} type="button">
          Reimposta
        </button>
      </div>
    </div>
  );
}
