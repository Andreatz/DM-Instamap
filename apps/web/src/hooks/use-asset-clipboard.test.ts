// @vitest-environment happy-dom
import type { MapDocument } from "@dm-instamap/core/browser";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLIPBOARD_STORAGE_KEY } from "@/lib/map-editor-view";
import { useAssetClipboard } from "./use-asset-clipboard";

vi.mock("@/lib/map-editor", () => ({
  createPlacedAssetClipboard: vi.fn(() => ({ assets: [{ id: "a" }] })),
  pastePlacedAssetClipboard: vi.fn(() => ({
    document: {},
    pastedIds: ["a-copy"]
  }))
}));

const fakeDocument = { assets: [] } as unknown as MapDocument;

function setup(selectedAssetIds: string[] = []) {
  const commitDocument = vi.fn();
  const setSelectedAssetId = vi.fn();
  const setSelectedAssetIds = vi.fn();
  const setSelectedElement = vi.fn();
  const setStatus = vi.fn();
  const view = renderHook(() =>
    useAssetClipboard({
      commitDocument,
      document: fakeDocument,
      selectedAssetId: null,
      selectedAssetIds,
      setSelectedAssetId,
      setSelectedAssetIds,
      setSelectedElement,
      setStatus
    })
  );

  return {
    commitDocument,
    setSelectedAssetIds,
    setStatus,
    view
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("useAssetClipboard", () => {
  it("copies the current selection into local storage", () => {
    const { setStatus, view } = setup(["a"]);

    act(() => {
      view.result.current.copySelectedAssets();
    });

    expect(window.localStorage.getItem(CLIPBOARD_STORAGE_KEY)).not.toBeNull();
    expect(setStatus).toHaveBeenCalled();
  });

  it("does nothing when there is no selection", () => {
    const { setStatus, view } = setup([]);

    act(() => {
      view.result.current.copySelectedAssets();
    });

    expect(window.localStorage.getItem(CLIPBOARD_STORAGE_KEY)).toBeNull();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("pastes from a populated clipboard", () => {
    window.localStorage.setItem(
      CLIPBOARD_STORAGE_KEY,
      JSON.stringify({ assets: [{ id: "a" }] })
    );
    const { commitDocument, setSelectedAssetIds, view } = setup([]);

    act(() => {
      view.result.current.pasteAssetClipboard();
    });

    expect(commitDocument).toHaveBeenCalledTimes(1);
    expect(setSelectedAssetIds).toHaveBeenCalledWith(["a-copy"]);
  });

  it("reports a missing clipboard", () => {
    const { commitDocument, setStatus, view } = setup([]);

    act(() => {
      view.result.current.pasteAssetClipboard();
    });

    expect(commitDocument).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(expect.stringMatching(/nessun/iu));
  });
});
