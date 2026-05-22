import type { MapDocument } from "@dm-instamap/core/server";

export type ProjectThumbnailOptions = {
  cell?: number;
};

const TILE_COLORS: Record<string, string> = {
  door: "#8a6431",
  floor: "#a88d5d",
  wall: "#394348"
};

const BACKGROUND = "#0f1214";
const ROOM_STROKE = "rgba(120, 168, 144, 0.5)";
const DEFAULT_CELL = 8;

/**
 * Builds a lightweight inline SVG mini-map from a MapDocument. Tiles are
 * run-length merged per row so even large grids stay compact, and no
 * user-controlled text is emitted, so the result is safe to inline.
 */
export function buildProjectThumbnailSvg(document: MapDocument, options: ProjectThumbnailOptions = {}): string {
  const cell = options.cell ?? DEFAULT_CELL;
  const width = Math.max(1, document.width);
  const height = Math.max(1, document.height);
  const viewWidth = width * cell;
  const viewHeight = height * cell;

  const tilesByCell = new Map<string, string>();
  for (const tile of document.tiles ?? []) {
    if (tile.kind === "floor" || tile.kind === "wall" || tile.kind === "door") {
      tilesByCell.set(`${tile.x},${tile.y}`, tile.kind);
    }
  }

  const rects: string[] = [];
  for (let y = 0; y < height; y += 1) {
    let runStart = 0;
    let runKind: string | null = null;

    const flush = (endX: number) => {
      if (runKind === null) {
        return;
      }

      const color = TILE_COLORS[runKind];
      const runWidth = (endX - runStart) * cell;
      rects.push(`<rect x="${runStart * cell}" y="${y * cell}" width="${runWidth}" height="${cell}" fill="${color}"/>`);
    };

    for (let x = 0; x < width; x += 1) {
      const kind = tilesByCell.get(`${x},${y}`) ?? null;

      if (kind !== runKind) {
        flush(x);
        runStart = x;
        runKind = kind;
      }
    }

    flush(width);
  }

  const rooms = (document.plan?.rooms ?? []).filter((room) => room.kind === "room" || room.kind === "entrance");
  const roomOutlines = rooms.map(
    (room) =>
      `<rect x="${room.bounds.x * cell}" y="${room.bounds.y * cell}" width="${room.bounds.width * cell}" height="${room.bounds.height * cell}" fill="none" stroke="${ROOM_STROKE}" stroke-width="1"/>`
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewWidth} ${viewHeight}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Anteprima mappa" class="project-thumb-svg">`,
    `<rect x="0" y="0" width="${viewWidth}" height="${viewHeight}" fill="${BACKGROUND}"/>`,
    ...rects,
    ...roomOutlines,
    "</svg>"
  ].join("");
}
