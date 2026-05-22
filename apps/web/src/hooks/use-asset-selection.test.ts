// @vitest-environment happy-dom
import type { MapDocument } from "@dm-instamap/core/browser";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAssetSelection } from "./use-asset-selection";

vi.mock("@/lib/map-editor", () => ({
  deletePlacedAssets: vi.fn(),
  duplicatePlacedAssets: vi.fn(),
  groupPlacedAssets: vi.fn(() => ({ document: {} })),
  isEditorLayerLocked: () => false,
  isEditorLayerVisible: () => true,
  ungroupPlacedAssets: vi.fn(),
  updatePlacedAssetLayer: vi.fn(),
  updatePlacedAssetTransform: vi.fn()
}));

vi.mock("@/lib/map-editor-view", () => ({
  assetToLayerKind: (layer: string) => layer,
  hasLockedSelectedAsset: () => false,
  layerLabel: (kind: string) => kind
}));

const fakeDocument = {
  assets: [
    { id: "a", layer: "object" },
    { id: "b", layer: "object" }
  ]
} as unknown as MapDocument;

function setup(selectedAssetIds: string[] = []) {
  const commitDocument = vi.fn();
  const setSelectedAssetId = vi.fn();
  const setSelectedAssetIds = vi.fn();
  const setSelectedElement = vi.fn();
  const setStatus = vi.fn();
  const view = renderHook(() =>
    useAssetSelection({
      commitDocument,
      document: fakeDocument,
      selectedAsset: null,
      selectedAssetId: null,
      selectedAssetIds,
      selectedAssets: [],
      setSelectedAssetId,
      setSelectedAssetIds,
      setSelectedElement,
      setStatus
    })
  );

  return {
    commitDocument,
    setSelectedAssetId,
    setSelectedAssetIds,
    setStatus,
    view
  };
}

describe("useAssetSelection", () => {
  it("deletes the current selection and clears it", () => {
    const { commitDocument, setSelectedAssetId, setSelectedAssetIds, view } =
      setup(["a"]);

    act(() => {
      view.result.current.deleteSelectedAsset();
    });

    expect(commitDocument).toHaveBeenCalledTimes(1);
    expect(setSelectedAssetId).toHaveBeenCalledWith(null);
    expect(setSelectedAssetIds).toHaveBeenCalledWith([]);
  });

  it("requires at least two assets to group", () => {
    const { commitDocument, setStatus, view } = setup(["a"]);

    act(() => {
      view.result.current.groupSelectedAssets();
    });

    expect(commitDocument).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(expect.stringMatching(/due/iu));
  });

  it("selects all visible assets", () => {
    const { setSelectedAssetIds, view } = setup([]);

    act(() => {
      view.result.current.selectAllVisibleAssets();
    });

    expect(setSelectedAssetIds).toHaveBeenCalledWith(["a", "b"]);
  });
});
