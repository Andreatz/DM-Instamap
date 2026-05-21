import {
  MapDocumentSchema,
  migrateMapDocument,
  type InitiativeEntry,
  type LightSource,
  type MapDocument,
  type MapLayer,
  type MapLayerKind,
  type MapNote,
  type PlacedAsset,
  type RoomNode,
  type TileKind
} from "@dm-instamap/core/browser";

export type EditorPaletteAsset = {
  id: string;
  kind: string;
  name: string;
  thumbnailUrl: string | null;
};

export type EditorTool = "select" | "paint-floor" | "paint-wall" | "paint-empty" | "door" | "light" | "note";

export const EDITOR_LAYER_KINDS: MapLayerKind[] = ["background", "terrain", "walls", "props", "lighting", "gm-only", "notes"];

export const EDITOR_DEFAULT_LAYERS: MapLayer[] = [
  { id: "layer-background", kind: "background", locked: true, name: "Background", opacity: 1, order: 0, visible: true },
  { id: "layer-terrain", kind: "terrain", locked: false, name: "Terrain", opacity: 1, order: 1, visible: true },
  { id: "layer-walls", kind: "walls", locked: false, name: "Walls", opacity: 1, order: 2, visible: true },
  { id: "layer-props", kind: "props", locked: false, name: "Props", opacity: 1, order: 3, visible: true },
  { id: "layer-lighting", kind: "lighting", locked: false, name: "Lighting", opacity: 1, order: 4, visible: true },
  { id: "layer-gm-only", kind: "gm-only", locked: false, name: "GM Only", opacity: 1, order: 5, visible: true },
  { id: "layer-notes", kind: "notes", locked: false, name: "Notes", opacity: 1, order: 6, visible: true }
];

export type EditorSelection =
  | {
      id: string;
      type: "asset" | "door" | "light" | "note" | "room";
    }
  | null;

export type PlacedAssetClipboard = {
  assets: PlacedAsset[];
  copiedAt: string;
  sourceDocumentId: string;
  version: 1;
};

export function addPlacedAsset(
  document: MapDocument,
  paletteAsset: EditorPaletteAsset,
  position: { x: number; y: number }
): MapDocument {
  const placedAsset: PlacedAsset = {
    assetId: paletteAsset.id,
    flipX: false,
    flipY: false,
    id: createPlacedAssetId(document, paletteAsset.id),
    layer: paletteAsset.kind === "light" ? "lighting" : "object",
    locked: false,
    position,
    rotation: 0,
    scale: 1,
    tags: [paletteAsset.kind]
  };

  return parseEditorDocument({
    ...ensureEditorLayers(document),
    assets: [...document.assets, placedAsset]
  });
}

export function movePlacedAsset(
  document: MapDocument,
  placedAssetId: string,
  position: { x: number; y: number }
): MapDocument {
  return parseEditorDocument({
    ...document,
    assets: document.assets.map((asset) =>
      asset.id === placedAssetId
        ? {
            ...asset,
            position
          }
        : asset
    )
  });
}

export function movePlacedAssets(
  document: MapDocument,
  placedAssetIds: string[],
  delta: { x: number; y: number }
): MapDocument {
  const selectedIds = new Set(placedAssetIds);

  return parseEditorDocument({
    ...document,
    assets: document.assets.map((asset) =>
      selectedIds.has(asset.id)
        ? {
            ...asset,
            position: {
              x: asset.position.x + delta.x,
              y: asset.position.y + delta.y
            }
          }
        : asset
    )
  });
}

export function updatePlacedAssetTransform(
  document: MapDocument,
  placedAssetId: string,
  transform: Partial<Pick<PlacedAsset, "flipX" | "flipY" | "rotation" | "scale">>
): MapDocument {
  return parseEditorDocument({
    ...document,
    assets: document.assets.map((asset) =>
      asset.id === placedAssetId
        ? {
            ...asset,
            flipX: transform.flipX ?? asset.flipX,
            flipY: transform.flipY ?? asset.flipY,
            rotation: normalizeRotation(transform.rotation ?? asset.rotation),
            scale: clampScale(transform.scale ?? asset.scale)
          }
        : asset
    )
  });
}

export function updatePlacedAssetLayer(
  document: MapDocument,
  placedAssetId: string,
  layer: PlacedAsset["layer"]
): MapDocument {
  return parseEditorDocument({
    ...document,
    assets: document.assets.map((asset) => (asset.id === placedAssetId ? { ...asset, layer } : asset))
  });
}

export function duplicatePlacedAsset(document: MapDocument, placedAssetId: string): MapDocument {
  const asset = document.assets.find((candidate) => candidate.id === placedAssetId);

  if (!asset) {
    return document;
  }

  const copy: PlacedAsset = {
    ...asset,
    id: createPlacedAssetId(document, asset.assetId),
    position: {
      x: asset.position.x + 1,
      y: asset.position.y + 1
    }
  };

  return parseEditorDocument({
    ...document,
    assets: [...document.assets, copy]
  });
}

export function duplicatePlacedAssets(document: MapDocument, placedAssetIds: string[]): MapDocument {
  let next = document;

  for (const placedAssetId of placedAssetIds) {
    next = duplicatePlacedAsset(next, placedAssetId);
  }

  return next;
}

export function groupPlacedAssets(document: MapDocument, placedAssetIds: string[]): { document: MapDocument; groupId: string | null } {
  const selectedIds = new Set(placedAssetIds);

  if (selectedIds.size < 2) {
    return { document, groupId: null };
  }

  const groupId = createUniqueId(
    new Set(document.assets.map((asset) => asset.groupId).filter((id): id is string => Boolean(id))),
    `asset-group-${Date.now()}`
  );

  return {
    document: parseEditorDocument({
      ...document,
      assets: document.assets.map((asset) => (selectedIds.has(asset.id) ? { ...asset, groupId } : asset))
    }),
    groupId
  };
}

export function ungroupPlacedAssets(document: MapDocument, placedAssetIds: string[]): MapDocument {
  const selectedIds = new Set(placedAssetIds);
  const selectedGroups = new Set(
    document.assets
      .filter((asset) => selectedIds.has(asset.id) && asset.groupId)
      .map((asset) => asset.groupId)
      .filter((id): id is string => Boolean(id))
  );

  return parseEditorDocument({
    ...document,
    assets: document.assets.map((asset) =>
      selectedIds.has(asset.id) || (asset.groupId && selectedGroups.has(asset.groupId))
        ? { ...asset, groupId: undefined }
        : asset
    )
  });
}

export function deletePlacedAsset(document: MapDocument, placedAssetId: string): MapDocument {
  return parseEditorDocument({
    ...document,
    assets: document.assets.filter((asset) => asset.id !== placedAssetId)
  });
}

export function updateLightSource(
  document: MapDocument,
  lightId: string,
  patch: Partial<Pick<LightSource, "color" | "flicker" | "intensity" | "kind" | "radius">>
): MapDocument {
  const plan = ensurePlan(document);

  return parseEditorDocument({
    ...document,
    plan: {
      ...plan,
      lights: plan.lights.map((light) =>
        light.id === lightId
          ? {
              ...light,
              color: patch.color ?? light.color,
              flicker: patch.flicker ?? light.flicker,
              intensity: patch.intensity === undefined ? light.intensity : clampUnit(patch.intensity),
              kind: patch.kind ?? light.kind,
              radius: patch.radius === undefined ? light.radius : clampPositive(patch.radius, 1)
            }
          : light
      )
    }
  });
}

export function computeVisibleCells(document: MapDocument): string[] {
  const tilesByCell = new Map(document.tiles.map((tile) => [cellKey(tile.x, tile.y), tile.kind]));
  const visibleCells = new Set<string>();

  for (const light of document.plan?.lights ?? []) {
    const origin = { x: Math.floor(light.position.x), y: Math.floor(light.position.y) };
    const radius = Math.ceil(light.radius);

    for (let y = origin.y - radius; y <= origin.y + radius; y += 1) {
      for (let x = origin.x - radius; x <= origin.x + radius; x += 1) {
        if (!isCellInBounds(document, { x, y })) {
          continue;
        }

        const distance = Math.hypot(x + 0.5 - light.position.x, y + 0.5 - light.position.y);

        if (distance <= light.radius && hasLineOfSight(document, tilesByCell, origin, { x, y })) {
          visibleCells.add(cellKey(x, y));
        }
      }
    }
  }

  return [...visibleCells].sort();
}

export function addMapNote(document: MapDocument, position: { x: number; y: number }, text: string, title = "GM Note"): MapDocument {
  const trimmedText = text.trim();

  if (!trimmedText || !isCellInBounds(document, position)) {
    return document;
  }

  const plan = ensurePlan(document);
  const note: MapNote = {
    id: createPlanElementId(plan.gmNotes, "note"),
    position,
    text: trimmedText,
    title: title.trim() || "GM Note"
  };

  return parseEditorDocument({
    ...document,
    plan: {
      ...plan,
      gmNotes: [...plan.gmNotes, note]
    }
  });
}

export function updateMapNote(
  document: MapDocument,
  noteId: string,
  patch: Partial<Pick<MapNote, "position" | "text" | "title">>
): MapDocument {
  const plan = ensurePlan(document);

  return parseEditorDocument({
    ...document,
    plan: {
      ...plan,
      gmNotes: plan.gmNotes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              position: patch.position ?? note.position,
              text: patch.text?.trim() || note.text,
              title: patch.title?.trim() || note.title
            }
          : note
      )
    }
  });
}

export function deleteMapNote(document: MapDocument, noteId: string): MapDocument {
  const plan = ensurePlan(document);

  return parseEditorDocument({
    ...document,
    plan: {
      ...plan,
      gmNotes: plan.gmNotes.filter((note) => note.id !== noteId)
    }
  });
}

export function addInitiativeEntry(
  document: MapDocument,
  entry: Omit<InitiativeEntry, "id">
): MapDocument {
  const plan = ensurePlan(document);
  const nextEntry: InitiativeEntry = {
    ...entry,
    id: createPlanElementId(plan.initiative, "initiative")
  };

  return parseEditorDocument({
    ...document,
    plan: {
      ...plan,
      initiative: sortInitiativeEntries([...plan.initiative, nextEntry])
    }
  });
}

export function updateInitiativeEntry(
  document: MapDocument,
  entryId: string,
  patch: Partial<Omit<InitiativeEntry, "id">>
): MapDocument {
  const plan = ensurePlan(document);

  return parseEditorDocument({
    ...document,
    plan: {
      ...plan,
      initiative: sortInitiativeEntries(
        plan.initiative.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                armorClass: patch.armorClass ?? entry.armorClass,
                hitPoints: patch.hitPoints ?? entry.hitPoints,
                initiative: patch.initiative ?? entry.initiative,
                name: patch.name?.trim() || entry.name,
                notes: patch.notes ?? entry.notes,
                side: patch.side ?? entry.side
              }
            : entry
        )
      )
    }
  });
}

export function deleteInitiativeEntry(document: MapDocument, entryId: string): MapDocument {
  const plan = ensurePlan(document);

  return parseEditorDocument({
    ...document,
    plan: {
      ...plan,
      initiative: plan.initiative.filter((entry) => entry.id !== entryId)
    }
  });
}

export function deletePlacedAssets(document: MapDocument, placedAssetIds: string[]): MapDocument {
  const selectedIds = new Set(placedAssetIds);

  return parseEditorDocument({
    ...document,
    assets: document.assets.filter((asset) => !selectedIds.has(asset.id))
  });
}

export function createPlacedAssetClipboard(document: MapDocument, placedAssetIds: string[]): PlacedAssetClipboard {
  const selectedIds = new Set(placedAssetIds);

  return {
    assets: document.assets.filter((asset) => selectedIds.has(asset.id)),
    copiedAt: new Date().toISOString(),
    sourceDocumentId: document.id,
    version: 1
  };
}

export function pastePlacedAssetClipboard(
  document: MapDocument,
  clipboard: PlacedAssetClipboard,
  offset: { x: number; y: number } = { x: 1, y: 1 }
): { document: MapDocument; pastedIds: string[] } {
  let next = document;
  const pastedIds: string[] = [];

  for (const asset of clipboard.assets) {
    const pasted: PlacedAsset = {
      ...asset,
      id: createPlacedAssetId(next, asset.assetId),
      position: {
        x: asset.position.x + offset.x,
        y: asset.position.y + offset.y
      }
    };
    pastedIds.push(pasted.id);
    next = parseEditorDocument({
      ...next,
      assets: [...next.assets, pasted]
    });
  }

  return { document: next, pastedIds };
}

export function selectPlacedAssetsInBounds(
  document: MapDocument,
  bounds: { maxX: number; maxY: number; minX: number; minY: number }
): string[] {
  const minX = Math.min(bounds.minX, bounds.maxX);
  const maxX = Math.max(bounds.minX, bounds.maxX);
  const minY = Math.min(bounds.minY, bounds.maxY);
  const maxY = Math.max(bounds.minY, bounds.maxY);

  return document.assets
    .filter(
      (asset) =>
        asset.position.x >= minX &&
        asset.position.x <= maxX &&
        asset.position.y >= minY &&
        asset.position.y <= maxY
    )
    .map((asset) => asset.id);
}

export function updateMapLayer(
  document: MapDocument,
  layerKind: MapLayerKind,
  patch: Partial<Pick<MapLayer, "locked" | "opacity" | "visible">>
): MapDocument {
  const withLayers = ensureEditorLayers(document);

  return parseEditorDocument({
    ...withLayers,
    layers: withLayers.layers.map((layer) =>
      layer.kind === layerKind
        ? {
            ...layer,
            locked: patch.locked ?? layer.locked,
            opacity: patch.opacity === undefined ? layer.opacity : clampOpacity(patch.opacity),
            visible: patch.visible ?? layer.visible
          }
        : layer
    )
  });
}

export function isEditorLayerVisible(document: MapDocument, layerKind: MapLayerKind): boolean {
  const layer = ensureEditorLayers(document).layers.find((candidate) => candidate.kind === layerKind);
  return layer?.visible ?? true;
}

export function isEditorLayerLocked(document: MapDocument, layerKind: MapLayerKind): boolean {
  const layer = ensureEditorLayers(document).layers.find((candidate) => candidate.kind === layerKind);
  return layer?.locked ?? false;
}

export function getEditorLayerOpacity(document: MapDocument, layerKind: MapLayerKind): number {
  const layer = ensureEditorLayers(document).layers.find((candidate) => candidate.kind === layerKind);
  return layer?.opacity ?? 1;
}

export function setTileKind(
  document: MapDocument,
  position: { x: number; y: number },
  kind: TileKind
): MapDocument {
  if (!isCellInBounds(document, position)) {
    return document;
  }

  const tileId = createTileId(position);
  const existingTile = document.tiles.find((tile) => tile.x === position.x && tile.y === position.y);
  const tiles = existingTile
    ? document.tiles.map((tile) => (tile.id === existingTile.id ? { ...tile, kind } : tile))
    : [
        ...document.tiles,
        {
          id: tileId,
          kind,
          x: position.x,
          y: position.y
        }
      ];

  return parseEditorDocument({
    ...document,
    tiles
  });
}

export function addDoorAtCell(document: MapDocument, position: { x: number; y: number }): MapDocument {
  if (!isCellInBounds(document, position)) {
    return document;
  }

  const plan = ensurePlan(document);
  const door = {
    id: createPlanElementId(plan.doors, "door"),
    isLocked: false,
    isOpen: false,
    position: { x: position.x + 0.5, y: position.y + 0.5 },
    rotation: 0,
    roomIds: findRoomsTouchingCell(document, position).map((room) => room.id),
    width: 1
  };

  return setTileKind(
    parseEditorDocument({
      ...document,
      plan: {
        ...plan,
        doors: [...plan.doors, door]
      }
    }),
    position,
    "door"
  );
}

export function addLightAtCell(document: MapDocument, position: { x: number; y: number }): MapDocument {
  if (!isCellInBounds(document, position)) {
    return document;
  }

  const plan = ensurePlan(document);
  const light = {
    color: "#d7a447",
    flicker: false,
    id: createPlanElementId(plan.lights, "light"),
    intensity: 0.75,
    kind: "torch" as const,
    position: { x: position.x + 0.5, y: position.y + 0.5 },
    radius: 4
  };

  return parseEditorDocument({
    ...document,
    plan: {
      ...plan,
      lights: [...plan.lights, light]
    }
  });
}

export function selectElementAtCell(
  document: MapDocument,
  position: { x: number; y: number }
): EditorSelection {
  const asset = document.assets.find(
    (placedAsset) => Math.floor(placedAsset.position.x) === position.x && Math.floor(placedAsset.position.y) === position.y
  );

  if (asset) {
    return { id: asset.id, type: "asset" };
  }

  const door = document.plan?.doors.find(
    (candidate) => Math.floor(candidate.position.x) === position.x && Math.floor(candidate.position.y) === position.y
  );

  if (door) {
    return { id: door.id, type: "door" };
  }

  const light = document.plan?.lights.find(
    (candidate) => Math.floor(candidate.position.x) === position.x && Math.floor(candidate.position.y) === position.y
  );

  if (light) {
    return { id: light.id, type: "light" };
  }

  const note = document.plan?.gmNotes.find(
    (candidate) => Math.floor(candidate.position.x) === position.x && Math.floor(candidate.position.y) === position.y
  );

  if (note) {
    return { id: note.id, type: "note" };
  }

  const room = findRoomAtCell(document, position);
  return room ? { id: room.id, type: "room" } : null;
}

export function updateDocumentForTool(
  document: MapDocument,
  tool: EditorTool,
  position: { x: number; y: number }
): MapDocument {
  switch (tool) {
    case "paint-floor":
      return setTileKind(document, position, "floor");
    case "paint-wall":
      return setTileKind(document, position, "wall");
    case "paint-empty":
      return setTileKind(document, position, "empty");
    case "door":
      return addDoorAtCell(document, position);
    case "light":
      return addLightAtCell(document, position);
    case "note":
      return addMapNote(document, position, "GM note");
    case "select":
      return document;
  }
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
  const parsed = JSON.parse(value) as unknown;

  if (!parsed || typeof parsed !== "object" || !("editable" in parsed)) {
    throw new Error("JSON is not an editable MapDocument.");
  }

  return ensureEditorLayers(migrateMapDocument(parsed));
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
  return createUniqueId(
    new Set(document.assets.map((asset) => asset.id)),
    `placed-${safeAssetId || "asset"}-${document.assets.length + 1}`
  );
}

function ensurePlan(document: MapDocument): NonNullable<MapDocument["plan"]> {
  return (
    document.plan ?? {
      assetPlacements: [],
      doors: [],
      gmNotes: [],
      id: `${document.id}-plan`,
      initiative: [],
      lights: [],
      name: document.name,
      notes: [],
      requestId: document.id,
      rooms: [],
      walls: []
    }
  );
}

export function ensureEditorLayers(document: MapDocument): MapDocument {
  const existing = new Map((document.layers ?? []).map((layer) => [layer.kind, layer]));
  const layers = EDITOR_DEFAULT_LAYERS.map((layer) => existing.get(layer.kind) ?? layer).sort((left, right) => left.order - right.order);

  return parseEditorDocument({
    ...document,
    layers
  });
}

function parseEditorDocument(document: unknown): MapDocument {
  return MapDocumentSchema.parse(document);
}

function normalizeRotation(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function clampScale(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(4, Math.max(0.25, value));
}

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}

function clampPositive(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function createTileId(position: { x: number; y: number }): string {
  return `tile-${position.x}-${position.y}`;
}

function createPlanElementId(items: Array<{ id: string }>, prefix: string): string {
  return createUniqueId(new Set(items.map((item) => item.id)), `${prefix}-${items.length + 1}`);
}

function createUniqueId(existingIds: Set<string>, preferredId: string): string {
  if (!existingIds.has(preferredId)) {
    return preferredId;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${preferredId}-${index}`;

    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }

  return `${preferredId}-${Date.now()}`;
}

function findRoomsTouchingCell(document: MapDocument, position: { x: number; y: number }): RoomNode[] {
  const candidates = [
    position,
    { x: position.x - 1, y: position.y },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y - 1 },
    { x: position.x, y: position.y + 1 }
  ];
  const rooms = candidates
    .map((candidate) => findRoomAtCell(document, candidate))
    .filter((room): room is RoomNode => room !== null);

  return [...new Map(rooms.map((room) => [room.id, room])).values()];
}

function isCellInBounds(document: MapDocument, position: { x: number; y: number }): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < document.width && position.y < document.height;
}

function sortInitiativeEntries(entries: InitiativeEntry[]): InitiativeEntry[] {
  return [...entries].sort((left, right) => right.initiative - left.initiative || left.name.localeCompare(right.name));
}

function hasLineOfSight(
  document: MapDocument,
  tilesByCell: Map<string, TileKind>,
  start: { x: number; y: number },
  end: { x: number; y: number }
): boolean {
  const points = bresenhamLine(start, end);

  for (const point of points.slice(1, -1)) {
    if (!isCellInBounds(document, point)) {
      return false;
    }

    if (tilesByCell.get(cellKey(point.x, point.y)) === "wall") {
      return false;
    }
  }

  return true;
}

function bresenhamLine(start: { x: number; y: number }, end: { x: number; y: number }): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  let x = start.x;
  let y = start.y;
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const stepX = start.x < end.x ? 1 : -1;
  const stepY = start.y < end.y ? 1 : -1;
  let error = dx - dy;

  while (true) {
    points.push({ x, y });

    if (x === end.x && y === end.y) {
      break;
    }

    const doubledError = error * 2;

    if (doubledError > -dy) {
      error -= dy;
      x += stepX;
    }

    if (doubledError < dx) {
      error += dx;
      y += stepY;
    }
  }

  return points;
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
