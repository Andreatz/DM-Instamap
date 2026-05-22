// @vitest-environment happy-dom
import type { MapDocument } from "@dm-instamap/core/browser";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DOCUMENT_STORAGE_KEY } from "@/lib/map-editor-view";
import { useEditorPersistence } from "./use-editor-persistence";

vi.mock("@/lib/map-editor", () => ({
  parseMapDocumentJson: vi.fn(() => ({})),
  serializeMapDocument: vi.fn(() => "{}")
}));

const doc = { name: "Test" } as unknown as MapDocument;

function setup(projectId?: string) {
  const fns = {
    resetHistory: vi.fn(),
    setJsonText: vi.fn(),
    setSelectedAssetId: vi.fn(),
    setSelectedAssetIds: vi.fn(),
    setSelectedRoomId: vi.fn(),
    setStatus: vi.fn()
  };
  const view = renderHook(() =>
    useEditorPersistence({ document: doc, jsonText: "{}", projectId, ...fns })
  );

  return { ...fns, view };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("useEditorPersistence", () => {
  it("saveJson without a project saves only locally", async () => {
    const { setJsonText, setStatus, view } = setup(undefined);

    await act(async () => {
      await view.result.current.saveJson();
    });

    expect(setJsonText).toHaveBeenCalledWith("{}");
    expect(window.localStorage.getItem(DOCUMENT_STORAGE_KEY)).toBe("{}");
    expect(setStatus).toHaveBeenCalledWith(expect.stringMatching(/locale/iu));
  });

  it("loadLocal reports a missing saved document", () => {
    const { resetHistory, setStatus, view } = setup(undefined);

    act(() => {
      view.result.current.loadLocal();
    });

    expect(resetHistory).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(expect.stringMatching(/nessun/iu));
  });
});
