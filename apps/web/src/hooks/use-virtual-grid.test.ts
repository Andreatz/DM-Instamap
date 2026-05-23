// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import type { UIEvent } from "react";
import { describe, expect, it } from "vitest";
import { useVirtualGrid } from "./use-virtual-grid";

function sizedDiv(width: number, height: number): HTMLDivElement {
  const node = document.createElement("div");
  Object.defineProperty(node, "clientWidth", {
    configurable: true,
    value: width
  });
  Object.defineProperty(node, "clientHeight", {
    configurable: true,
    value: height
  });
  return node;
}

function scrollEvent(scrollTop: number): UIEvent<HTMLDivElement> {
  return {
    currentTarget: { scrollTop }
  } as unknown as UIEvent<HTMLDivElement>;
}

describe("useVirtualGrid", () => {
  it("derives a column count from the measured container width", () => {
    const { result } = renderHook(() =>
      useVirtualGrid({
        gap: 12,
        itemCount: 5_000,
        minItemWidth: 132,
        rowHeight: 200
      })
    );

    act(() => {
      result.current.containerRef(sizedDiv(840, 600));
    });

    // (840 + 12) / (132 + 12) = 5.91 -> 5 columns.
    expect(result.current.columns).toBe(5);
    expect(result.current.window.totalHeight).toBeGreaterThan(0);
  });

  it("keeps the rendered window bounded for a huge library", () => {
    const { result } = renderHook(() =>
      useVirtualGrid({
        gap: 12,
        itemCount: 5_000,
        minItemWidth: 132,
        rowHeight: 200
      })
    );

    act(() => {
      result.current.containerRef(sizedDiv(840, 600));
    });

    const rendered =
      result.current.window.endIndex - result.current.window.startIndex;
    expect(rendered).toBeLessThan(5_000);
    expect(rendered).toBeGreaterThan(0);
  });

  it("shifts the window when the container scrolls", () => {
    const { result } = renderHook(() =>
      useVirtualGrid({
        gap: 12,
        itemCount: 5_000,
        minItemWidth: 132,
        rowHeight: 200
      })
    );

    act(() => {
      result.current.containerRef(sizedDiv(840, 600));
    });
    const initialStart = result.current.window.startIndex;

    act(() => {
      result.current.onScroll(scrollEvent(4_000));
    });

    expect(result.current.window.startIndex).toBeGreaterThan(initialStart);
  });
});
