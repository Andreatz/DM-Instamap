import { describe, expect, it } from "vitest";
import {
  computeColumns,
  computeGridWindow,
  type VirtualGridInput
} from "./virtual-grid";

const baseInput: VirtualGridInput = {
  columns: 4,
  itemCount: 100,
  overscanRows: 2,
  rowHeight: 120,
  scrollTop: 0,
  viewportHeight: 600
};

describe("computeColumns", () => {
  it("fits as many fixed-width items as the container allows", () => {
    // (840 + 12) / (132 + 12) = 5.91 -> 5 columns.
    expect(computeColumns(840, 132, 12)).toBe(5);
  });

  it("never collapses below one column", () => {
    expect(computeColumns(0, 132, 12)).toBe(1);
    expect(computeColumns(80, 132, 12)).toBe(1);
    expect(computeColumns(-50, 132, 12)).toBe(1);
  });
});

describe("computeGridWindow", () => {
  it("renders only the top rows plus overscan at scrollTop 0", () => {
    const window = computeGridWindow(baseInput);

    // 600 / 120 = 5 visible rows, +2 overscan +1 inclusive = 8 rows.
    expect(window.startIndex).toBe(0);
    expect(window.renderedRows).toBe(8);
    expect(window.endIndex).toBe(32);
    expect(window.paddingTop).toBe(0);
    expect(window.totalHeight).toBe((100 / 4) * 120);
  });

  it("shifts the window and spacers when scrolled into the middle", () => {
    const window = computeGridWindow({ ...baseInput, scrollTop: 1200 });

    // firstVisibleRow = 10, overscan 2 -> startRow 8 -> startIndex 32.
    expect(window.startIndex).toBe(32);
    expect(window.paddingTop).toBe(8 * 120);
    expect(window.paddingTop + window.paddingBottom).toBeLessThan(
      window.totalHeight
    );
  });

  it("clamps the window to the last row at the bottom", () => {
    const window = computeGridWindow({ ...baseInput, scrollTop: 100_000 });

    expect(window.endIndex).toBe(baseInput.itemCount);
    expect(window.paddingBottom).toBe(0);
  });

  it("returns an empty window for an empty library", () => {
    const window = computeGridWindow({ ...baseInput, itemCount: 0 });

    expect(window).toMatchObject({
      endIndex: 0,
      paddingBottom: 0,
      paddingTop: 0,
      renderedRows: 0,
      startIndex: 0,
      totalHeight: 0
    });
  });

  it("keeps the rendered window bounded for very large libraries", () => {
    // The performance invariant behind Fase K: the number of mounted items is
    // a function of the viewport, never of the total asset count.
    const small = computeGridWindow({ ...baseInput, itemCount: 200 });
    const huge = computeGridWindow({ ...baseInput, itemCount: 5_000 });
    const enormous = computeGridWindow({ ...baseInput, itemCount: 50_000 });

    const renderedSmall = small.endIndex - small.startIndex;
    const renderedHuge = huge.endIndex - huge.startIndex;
    const renderedEnormous = enormous.endIndex - enormous.startIndex;

    expect(renderedSmall).toBe(renderedHuge);
    expect(renderedHuge).toBe(renderedEnormous);
    expect(renderedHuge).toBeLessThanOrEqual(40);
  });

  it("guards against zero columns or zero row height", () => {
    const window = computeGridWindow({
      ...baseInput,
      columns: 0,
      rowHeight: 0
    });

    expect(window.startIndex).toBe(0);
    expect(Number.isFinite(window.totalHeight)).toBe(true);
  });
});
