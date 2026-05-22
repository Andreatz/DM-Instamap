"use client";

import { formatToolName } from "@/lib/map-editor-view";
import type { MapEditorController } from "@/hooks/use-map-editor-state";

/**
 * Renders the editable canvas element plus its status footer. The actual 2D
 * drawing happens in an effect inside {@link useMapEditorState} via the pure
 * `drawMapCanvas` renderer; this component only wires the DOM node and pointer
 * handlers.
 */
export function MapCanvas({ editor }: { editor: MapEditorController }) {
  const {
    canvasRef,
    canvasSize,
    document,
    editorTool,
    handleCanvasDrop,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    handleWheel,
    hoverCell,
    redoStack,
    setHoverCell,
    undoStack
  } = editor;

  return (
    <>
      <div className="editor-canvas-wrap">
        <canvas
          aria-label="Canvas mappa modificabile"
          className={`editor-canvas editor-tool-${editorTool}`}
          height={canvasSize.height}
          onContextMenu={(event) => event.preventDefault()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleCanvasDrop}
          onPointerDown={handleCanvasPointerDown}
          onPointerLeave={() => setHoverCell(null)}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onWheel={handleWheel}
          ref={canvasRef}
          width={canvasSize.width}
        />
      </div>
      <footer className="editor-canvas-status">
        <span>Strumento: {formatToolName(editorTool)}</span>
        <span>Annulla {undoStack.length} / Ripristina {redoStack.length}</span>
        <span>{hoverCell ? `Cella ${hoverCell.x}, ${hoverCell.y}` : "Cella -"}</span>
        <span>{document.width} x {document.height}</span>
      </footer>
    </>
  );
}
