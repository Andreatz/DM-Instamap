import type { MapDocument, PlacedAsset, RoomNode } from "@dm-instamap/core";

export type EditorPaletteAsset = {
  id: string;
  kind: string;
  name: string;
  thumbnailUrl: string | null;
};

export function addPlacedAsset(
  document: MapDocument,
  paletteAsset: EditorPaletteAsset,
  position: { x: number; y: number }
): MapDocument {
  const placedAsset: PlacedAsset = {
    assetId: paletteAsset.id,
    id: createPlacedAssetId(document, paletteAsset.id),
    layer: paletteAsset.kind === "light" ? "lighting" : "object",
    locked: false,
    position,
    rotation: 0,
    scale: 1,
    tags: [paletteAsset.kind]
  };

  return {
    ...document,
    assets: [...document.assets, placedAsset]
  };
}

export function movePlacedAsset(
  document: MapDocument,
  placedAssetId: string,
  position: { x: number; y: number }
): MapDocument {
  return {
    ...document,
    assets: document.assets.map((asset) =>
      asset.id === placedAssetId
        ? {
            ...asset,
            position
          }
        : asset
    )
  };
}

export function deletePlacedAsset(document: MapDocument, placedAssetId: string): MapDocument {
  return {
    ...document,
    assets: document.assets.filter((asset) => asset.id !== placedAssetId)
  };
}

export function findRoomAtCell(
  document: MapDocument,
  position: { x: number; y: number }
): RoomNode | null {
  const rooms = document.plan?.rooms.filter((room) => room.kind === "room" || room.kind === "entrance") ?? [];

  return (
    rooms.find(
      (room) =>
        position.x >= room.bounds.x &&
        position.x < room.bounds.x + room.bounds.width &&
        position.y >= room.bounds.y &&
        position.y < room.bounds.y + room.bounds.height
    ) ?? null
  );
}

export function serializeMapDocument(document: MapDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function parseMapDocumentJson(value: string): MapDocument {
  const parsed = JSON.parse(value) as Partial<MapDocument>;

  if (!parsed || parsed.editable !== true || !Array.isArray(parsed.tiles)) {
    throw new Error("JSON is not an editable MapDocument.");
  }

  return {
    assets: Array.isArray(parsed.assets) ? parsed.assets : [],
    editable: true,
    grid: parsed.grid as MapDocument["grid"],
    height: Number(parsed.height),
    id: String(parsed.id),
    name: String(parsed.name),
    plan: parsed.plan,
    tiles: parsed.tiles,
    version: 1,
    width: Number(parsed.width)
  };
}

export function createFallbackPalette(): EditorPaletteAsset[] {
  return [
    { id: "fallback-torch", kind: "light", name: "Torch", thumbnailUrl: null },
    { id: "fallback-table", kind: "furniture", name: "Table", thumbnailUrl: null },
    { id: "fallback-crate", kind: "prop", name: "Crate", thumbnailUrl: null },
    { id: "fallback-statue", kind: "decoration", name: "Statue", thumbnailUrl: null }
  ];
}

function createPlacedAssetId(document: MapDocument, assetId: string): string {
  const safeAssetId = assetId.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  return `placed-${safeAssetId || "asset"}-${document.assets.length + 1}`;
}
