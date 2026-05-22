// @vitest-environment happy-dom
import type { PointerEvent } from "react";
import type { MapDocument } from "@dm-instamap/core/browser";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCanvasInteraction } from "./use-canvas-interaction";

vi.mock("@/lib/map-editor", () => ({
  addPlacedAsset: vi.fn(),
  findRoomAtCell: () => null,
  isEditorLayerLocked: () => false,
  isEditorLayerVisible: () => true,
  movePlacedAsset: vi.fn(),
  movePlacedAssets: vi.fn(),
  selectElementAtCell: () => null,
  selectPlacedAssetsInBounds: () => [],
  updateDocumentForTool: vi.fn((document: unknown) => document)
}));

vi.mock("@/lib/map-editor-view", () => ({
  assetToLayerKind: (layer: string) => layer,
  createPaletteAsset: () => null,
  createSelectionBounds: () => ({}),
  createToolStatus: () => "tool",
  isSelectionVisible: () => true,
  layerLabel: (kind: string) => kind,
  readDragPayload: () => null,
  toggleSelection: (ids: string[]) => ids,
  toolToLayerKind: (tool: string) => tool
}));

const doc = { assets: [] } as unknown as MapDocument;

function setup(overrides: Record<string, unknown> = {}) {
  const deps = {
    assetSearchResults: [],
    commitDocument: vi.fn(),
    document: doc,
    dragStartCell: null,
    draggingAssetId: null,
    editorTool: "wall" as const,
    marqueeSelection: null,
    palette: [],
    panStart: null,
    screenToCell: () => ({ x: 2, y: 3 }),
    selectedAssetIds: [],
    setDragStartCell: vi.fn(),
    setDraggingAssetId: vi.fn(),
    setHoverCell: vi.fn(),
    setMarqueeSelection: vi.fn(),
    setPanStart: vi.fn(),
    setSelectedAssetId: vi.fn(),
    setSelectedAssetIds: vi.fn(),
    setSelectedElement: vi.fn(),
    setSelectedRoomId: vi.fn(),
    setStatus: vi.fn(),
    setViewport: vi.fn(),
    viewport: { offsetX: 0, offsetY: 0, zoom: 1 },
    ...overrides
  };
  // biome-ignore lint/suspicious/noExplicitAny: deps di test con setter mockati
  const view = renderHook(() => useCanvasInteraction(deps as any));
  return { deps, view };
}

const pointerEvent = {
  altKey: false,
  button: 0,
  clientX: 0,
  clientY: 0
} as unknown as PointerEvent<HTMLCanvasElement>;

describe("useCanvasInteraction", () => {
  it("updates the hover cell on pointer move", () => {
    const { deps, view } = setup();

    act(() => {
      view.result.current.handleCanvasPointerMove(pointerEvent);
    });

    expect(deps.setHoverCell).toHaveBeenCalledWith({ x: 2, y: 3 });
  });

  it("commits a paint action with a non-select tool", () => {
    const { deps, view } = setup();

    act(() => {
      view.result.current.handleCanvasPointerDown(pointerEvent);
    });

    expect(deps.commitDocument).toHaveBeenCalledTimes(1);
  });
});
