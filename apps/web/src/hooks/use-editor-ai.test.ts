// @vitest-environment happy-dom
import type { MapDocument } from "@dm-instamap/core/browser";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEditorAi } from "./use-editor-ai";

const doc = { name: "Test" } as unknown as MapDocument;

function setup(overrides: Partial<Parameters<typeof useEditorAi>[0]> = {}) {
  const fns = {
    setAiBusy: vi.fn(),
    setAiDescription: vi.fn(),
    setAiSuggestions: vi.fn(),
    setAssetSearchResults: vi.fn(),
    setRecentGenerated: vi.fn(),
    setStatus: vi.fn()
  };
  const view = renderHook(() =>
    useEditorAi({
      aiBusy: false,
      aiRequest: "",
      assetSearchQuery: "",
      document: doc,
      mapTheme: "",
      recentGenerated: [],
      selectedRoom: null,
      ...fns,
      ...overrides
    })
  );

  return { ...fns, view };
}

describe("useEditorAi", () => {
  it("runAiDescribeMap is a no-op while busy", async () => {
    const { setAiBusy, view } = setup({ aiBusy: true });

    await act(async () => {
      await view.result.current.runAiDescribeMap();
    });

    expect(setAiBusy).not.toHaveBeenCalled();
  });

  it("generateAssetFromPrompt rejects an empty prompt", async () => {
    const { setAiBusy, setStatus, view } = setup({ aiRequest: "   " });

    await act(async () => {
      await view.result.current.generateAssetFromPrompt();
    });

    expect(setAiBusy).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(expect.stringMatching(/prompt/iu));
  });

  it("runAiSuggestForSelectedRoom requires a selected room", async () => {
    const { setAiBusy, setStatus, view } = setup({ selectedRoom: null });

    await act(async () => {
      await view.result.current.runAiSuggestForSelectedRoom();
    });

    expect(setAiBusy).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(expect.stringMatching(/stanza/iu));
  });
});
