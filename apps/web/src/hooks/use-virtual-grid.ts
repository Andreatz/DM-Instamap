"use client";

import { type UIEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  computeColumns,
  computeGridWindow,
  type VirtualGridWindow
} from "@/lib/virtual-grid";

export type UseVirtualGridInput = {
  itemCount: number;
  /** Minimum width of a grid item, in pixels (drives the column count). */
  minItemWidth: number;
  /** Fixed row height, in pixels (item height + row gap). */
  rowHeight: number;
  /** Gap between items, in pixels. */
  gap: number;
  overscanRows?: number;
};

export type UseVirtualGridResult = {
  containerRef: (node: HTMLDivElement | null) => void;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  columns: number;
  window: VirtualGridWindow;
};

/**
 * Wire the pure windowing math (`lib/virtual-grid`) to a scrollable container.
 * Tracks the container's width/height with a ResizeObserver and its scroll
 * offset with an `onScroll` handler, then derives the slice of items to render.
 * The DOM-free geometry lives in the lib; this hook only owns the measurements.
 */
export function useVirtualGrid({
  itemCount,
  minItemWidth,
  rowHeight,
  gap,
  overscanRows
}: UseVirtualGridInput): UseVirtualGridResult {
  const [scrollTop, setScrollTop] = useState(0);
  const [size, setSize] = useState({ height: 0, width: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();

    if (!node) {
      observerRef.current = null;
      return;
    }

    const measure = () => {
      setSize({ height: node.clientHeight, width: node.clientWidth });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const columns = computeColumns(size.width, minItemWidth, gap);
  const window = computeGridWindow({
    columns,
    itemCount,
    overscanRows,
    rowHeight,
    scrollTop,
    viewportHeight: size.height
  });

  return { columns, containerRef, onScroll, window };
}
