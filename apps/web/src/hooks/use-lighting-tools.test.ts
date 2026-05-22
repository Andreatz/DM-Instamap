// @vitest-environment happy-dom
import type { MapDocument } from "@dm-instamap/core/browser";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLightingTools } from "./use-lighting-tools";

vi.mock("@/lib/map-editor", () => ({
  isEditorLayerLocked: () => false,
  updateLightSource: vi.fn()
}));

const fakeDocument = { plan: { lights: [] } } as unknown as MapDocument;
const fakeLight = {
  id: "light-1",
  intensity: 0.8,
  kind: "torch",
  position: { x: 1, y: 1 },
  radius: 6
} as unknown as NonNullable<MapDocument["plan"]>["lights"][number];

function setup(selectedLight: typeof fakeLight | null) {
  const commitDocument = vi.fn();
  const setStatus = vi.fn();
  const view = renderHook(() =>
    useLightingTools({
      commitDocument,
      document: fakeDocument,
      selectedLight,
      setStatus
    })
  );

  return { commitDocument, view };
}

describe("useLightingTools", () => {
  it("commits a light update when a light is selected", () => {
    const { commitDocument, view } = setup(fakeLight);

    act(() => {
      view.result.current.updateSelectedLight({ intensity: 1 });
    });

    expect(commitDocument).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a selected light", () => {
    const { commitDocument, view } = setup(null);

    act(() => {
      view.result.current.updateSelectedLight({ intensity: 1 });
    });

    expect(commitDocument).not.toHaveBeenCalled();
  });
});
