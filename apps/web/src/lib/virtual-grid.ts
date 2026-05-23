/**
 * Pure windowing math for a fixed-row virtualized grid.
 *
 * The browser asset palette can hold thousands of entries. Rendering one DOM
 * node per asset makes scrolling janky, so the grid only mounts the rows that
 * intersect the viewport (plus a small overscan). All the geometry lives here
 * as pure functions so it can be unit-tested without a DOM and reused by the
 * thin React hook in `hooks/use-virtual-grid.ts`.
 */

export type VirtualGridInput = {
  columns: number;
  itemCount: number;
  overscanRows?: number;
  rowHeight: number;
  scrollTop: number;
  viewportHeight: number;
};

export type VirtualGridWindow = {
  /** First item index to render (inclusive). */
  startIndex: number;
  /** One past the last item index to render (use as exclusive slice end). */
  endIndex: number;
  /** Spacer height above the rendered rows, in pixels. */
  paddingTop: number;
  /** Spacer height below the rendered rows, in pixels. */
  paddingBottom: number;
  /** Full scrollable height of the grid, in pixels. */
  totalHeight: number;
  /** Number of rows actually rendered in this window. */
  renderedRows: number;
};

const DEFAULT_OVERSCAN_ROWS = 2;

/**
 * Compute how many columns fit in a container of `containerWidth`, given a
 * minimum item width and the inter-item gap. Always returns at least 1 so the
 * grid never collapses to zero columns (which would make row math divide by 0).
 */
export function computeColumns(
  containerWidth: number,
  minItemWidth: number,
  gap: number
): number {
  if (containerWidth <= 0 || minItemWidth <= 0) {
    return 1;
  }

  const columns = Math.floor((containerWidth + gap) / (minItemWidth + gap));
  return Math.max(1, columns);
}

/**
 * Given the scroll offset and viewport size, return the slice of items to
 * render plus the spacer padding that keeps the scrollbar at full size. The
 * rendered window is bounded by the viewport, not by `itemCount`, so a library
 * of 5 or 50 000 assets mounts the same handful of rows.
 */
export function computeGridWindow(input: VirtualGridInput): VirtualGridWindow {
  const columns = Math.max(1, Math.floor(input.columns));
  const rowHeight = input.rowHeight > 0 ? input.rowHeight : 1;
  const itemCount = Math.max(0, Math.floor(input.itemCount));
  const overscanRows = Math.max(0, input.overscanRows ?? DEFAULT_OVERSCAN_ROWS);
  const scrollTop = Math.max(0, input.scrollTop);
  const viewportHeight = Math.max(0, input.viewportHeight);

  const totalRows = Math.ceil(itemCount / columns);
  const totalHeight = totalRows * rowHeight;

  if (totalRows === 0) {
    return {
      endIndex: 0,
      paddingBottom: 0,
      paddingTop: 0,
      renderedRows: 0,
      startIndex: 0,
      totalHeight: 0
    };
  }

  const firstVisibleRow = Math.floor(scrollTop / rowHeight);
  const lastVisibleRow = Math.floor((scrollTop + viewportHeight) / rowHeight);

  const startRow = Math.max(0, firstVisibleRow - overscanRows);
  const endRow = Math.min(totalRows, lastVisibleRow + overscanRows + 1);

  const startIndex = startRow * columns;
  const endIndex = Math.min(itemCount, endRow * columns);

  return {
    endIndex,
    paddingBottom: (totalRows - endRow) * rowHeight,
    paddingTop: startRow * rowHeight,
    renderedRows: endRow - startRow,
    startIndex,
    totalHeight
  };
}
