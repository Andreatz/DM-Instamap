import { useCallback, useState } from "react";
import type { Dispatch, RefObject, SetStateAction, WheelEvent } from "react";
import { CANVAS_CELL_SIZE, MAX_ZOOM, MIN_ZOOM, clamp } from "@/lib/map-editor-view";

export type Viewport = { offsetX: number; offsetY: number; zoom: number };

export type PanStart = { offsetX: number; offsetY: number; pointerX: number; pointerY: number } | null;

export type CanvasViewport = {
  handleWheel: (event: WheelEvent<HTMLCanvasElement>) => void;
  panStart: PanStart;
  resetViewport: () => void;
  screenToCell: (clientX: number, clientY: number) => { x: number; y: number } | null;
  setPanStart: Dispatch<SetStateAction<PanStart>>;
  setViewport: Dispatch<SetStateAction<Viewport>>;
  viewport: Viewport;
  zoomBy: (delta: number) => void;
};

const DEFAULT_VIEWPORT: Viewport = { offsetX: 24, offsetY: 24, zoom: 1 };

/**
 * Manages pan/zoom state for the editor canvas and converts screen coordinates
 * into map cells. Pointer interaction (drag, marquee) stays with the editor
 * state hook; this hook only owns the viewport transform.
 */
export function useCanvasViewport(options: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  documentHeight: number;
  documentWidth: number;
}): CanvasViewport {
  const { canvasRef, documentHeight, documentWidth } = options;
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [panStart, setPanStart] = useState<PanStart>(null);

  const screenToCell = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return null;
      }

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (clientX - rect.left) * scaleX;
      const canvasY = (clientY - rect.top) * scaleY;
      const x = Math.floor((canvasX - viewport.offsetX) / viewport.zoom / CANVAS_CELL_SIZE);
      const y = Math.floor((canvasY - viewport.offsetY) / viewport.zoom / CANVAS_CELL_SIZE);

      if (x < 0 || y < 0 || x >= documentWidth || y >= documentHeight) {
        return null;
      }

      return { x, y };
    },
    [canvasRef, documentHeight, documentWidth, viewport.offsetX, viewport.offsetY, viewport.zoom]
  );

  const zoomBy = useCallback((delta: number) => {
    setViewport((current) => ({ ...current, zoom: clamp(current.zoom + delta, MIN_ZOOM, MAX_ZOOM) }));
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      zoomBy(event.deltaY > 0 ? -0.1 : 0.1);
    },
    [zoomBy]
  );

  const resetViewport = useCallback(() => {
    setViewport(DEFAULT_VIEWPORT);
  }, []);

  return { handleWheel, panStart, resetViewport, screenToCell, setPanStart, setViewport, viewport, zoomBy };
}
