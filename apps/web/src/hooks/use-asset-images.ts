"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Load asset thumbnails (id -> url) into a cache of decoded images. Already
 * loaded or in-flight ids are skipped. Each successful load returns a fresh Map
 * identity so consumers (the canvas redraw effect) re-run by depending on it.
 * Failed loads are left out, so the renderer falls back to its marker.
 */
export function useAssetImages(
  sources: Map<string, string>
): Map<string, HTMLImageElement> {
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const requestedRef = useRef(new Set<string>());
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(
    imagesRef.current
  );

  useEffect(() => {
    if (typeof Image === "undefined") {
      return;
    }

    let cancelled = false;

    for (const [id, src] of sources) {
      if (requestedRef.current.has(id)) {
        continue;
      }

      requestedRef.current.add(id);
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (!cancelled) {
          imagesRef.current.set(id, image);
          setImages(new Map(imagesRef.current));
        }
      };
      image.onerror = () => {
        // Leave the id out of the cache: the renderer keeps its marker.
        requestedRef.current.delete(id);
      };
      image.src = src;
    }

    return () => {
      cancelled = true;
    };
  }, [sources]);

  return images;
}
