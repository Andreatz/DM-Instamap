import type { MapDocument, MapTile, PlacedAsset, RoomNode } from "@dm-instamap/core";

export const FURNISHING_DENSITIES = ["sparse", "normal", "rich"] as const;
export type FurnishingDensity = (typeof FURNISHING_DENSITIES)[number];

export const FURNISHING_ROOM_TYPES = [
  "entrance",
  "corridor",
  "crypt",
  "prison",
  "forge",
  "library",
  "chapel",
  "boss_room",
  "treasure_room",
  "storage"
] as const;

export type FurnishingRoomType = (typeof FURNISHING_ROOM_TYPES)[number];

export type FurnishingAsset = {
  assetId: string;
  heightCells?: number;
  kind: string;
  layer?: PlacedAsset["layer"];
  qualityScore?: number;
  tags?: string[];
  usableFor?: string[];
  widthCells?: number;
};

export type AutoFurnishOptions = {
  assets: FurnishingAsset[];
  density?: FurnishingDensity;
  includeCorridors?: boolean;
};

export type FurnishingPlacementDebug = {
  assetId: string;
  footprint: {
    height: number;
    width: number;
  };
  roomId: string;
  roomType: FurnishingRoomType;
};

export type AutoFurnishResult = {
  document: MapDocument;
  placed: FurnishingPlacementDebug[];
  skipped: Array<{
    assetId: string;
    reason: string;
    roomId: string;
  }>;
};

type CandidatePlacement = {
  asset: NormalizedFurnishingAsset;
  room: RoomNode;
  roomType: FurnishingRoomType;
  x: number;
  y: number;
};

type NormalizedFurnishingAsset = {
  area: number;
  assetId: string;
  height: number;
  kind: string;
  layer: PlacedAsset["layer"];
  qualityScore: number;
  tags: string[];
  usableFor: string[];
  width: number;
};

const DENSITY_RATIO: Record<FurnishingDensity, number> = {
  normal: 0.1,
  rich: 0.16,
  sparse: 0.05
};

const ROOM_TYPE_TERMS: Record<FurnishingRoomType, string[]> = {
  boss_room: ["boss", "boss_room", "final", "throne"],
  chapel: ["altar", "chapel", "holy", "pew", "shrine", "temple"],
  corridor: ["corridor", "hall", "light", "torch"],
  crypt: ["bone", "coffin", "crypt", "grave", "sarcophagus", "skull", "tomb"],
  entrance: ["door", "entrance", "gate", "light", "torch"],
  forge: ["anvil", "fire", "forge", "metal", "smith", "tool"],
  library: ["book", "bookshelf", "desk", "library", "shelf", "study"],
  prison: ["bar", "cage", "cell", "chain", "prison"],
  storage: ["barrel", "box", "crate", "sack", "storage"],
  treasure_room: ["chest", "coin", "gold", "hoard", "treasure"]
};

export function autoFurnishMap(document: MapDocument, options: AutoFurnishOptions): AutoFurnishResult {
  const density = options.density ?? "normal";
  const tileLookup = createTileLookup(document.tiles);
  const occupied = createOccupiedSet(document.assets);
  const assets = options.assets.map(normalizeAsset).sort(compareAssetsForPlacement);
  const rooms = selectRooms(document, Boolean(options.includeCorridors));
  const additions: PlacedAsset[] = [];
  const placed: FurnishingPlacementDebug[] = [];
  const skipped: AutoFurnishResult["skipped"] = [];

  for (const room of rooms) {
    const roomType = inferFurnishingRoomType(room);
    const roomBudget = calculateRoomBudget(room, density);
    let usedArea = 0;
    const roomAssets = assets.filter((asset) => assetFitsRoom(asset, roomType));

    for (const asset of roomAssets) {
      if (usedArea >= roomBudget) {
        break;
      }

      const candidate = findPlacement({ asset, occupied, room, roomType, tileLookup });

      if (!candidate) {
        skipped.push({
          assetId: asset.assetId,
          reason: "No collision-free floor position inside room bounds.",
          roomId: room.id
        });
        continue;
      }

      markOccupied(occupied, candidate.x, candidate.y, asset.width, asset.height);
      usedArea += asset.area;
      additions.push(createPlacedAsset(document, additions.length, candidate));
      placed.push({
        assetId: asset.assetId,
        footprint: {
          height: asset.height,
          width: asset.width
        },
        roomId: room.id,
        roomType
      });
    }
  }

  return {
    document: {
      ...document,
      assets: [...document.assets, ...additions],
      plan: document.plan
        ? {
            ...document.plan,
            assetPlacements: [...document.plan.assetPlacements, ...additions]
          }
        : document.plan
    },
    placed,
    skipped
  };
}

export function inferFurnishingRoomType(room: RoomNode): FurnishingRoomType {
  if (room.kind === "entrance") {
    return "entrance";
  }

  if (room.kind === "corridor") {
    return "corridor";
  }

  const text = normalizeTokens([room.label, ...room.tags]).join(" ");

  if (/\b(boss|final)\b/u.test(text)) {
    return "boss_room";
  }

  for (const roomType of FURNISHING_ROOM_TYPES) {
    if (roomType === "entrance" || roomType === "corridor" || roomType === "boss_room") {
      continue;
    }

    const terms = ROOM_TYPE_TERMS[roomType];

    if (terms.some((term) => text.includes(term))) {
      return roomType;
    }
  }

  return "crypt";
}

function selectRooms(document: MapDocument, includeCorridors: boolean): RoomNode[] {
  const supportedKinds = new Set<RoomNode["kind"]>(includeCorridors ? ["corridor", "entrance", "room"] : ["entrance", "room"]);
  return (document.plan?.rooms ?? []).filter((room) => supportedKinds.has(room.kind));
}

function normalizeAsset(asset: FurnishingAsset): NormalizedFurnishingAsset {
  const width = normalizeFootprint(asset.widthCells ?? inferAssetFootprint(asset).width);
  const height = normalizeFootprint(asset.heightCells ?? inferAssetFootprint(asset).height);

  return {
    area: width * height,
    assetId: asset.assetId,
    height,
    kind: normalizeToken(asset.kind),
    layer: asset.layer ?? (asset.kind === "light" ? "lighting" : "object"),
    qualityScore: normalizeQualityScore(asset.qualityScore),
    tags: normalizeTokens(asset.tags ?? []),
    usableFor: normalizeTokens(asset.usableFor ?? []),
    width
  };
}

function inferAssetFootprint(asset: FurnishingAsset): { height: number; width: number } {
  const terms = normalizeTokens([asset.kind, ...(asset.tags ?? []), ...(asset.usableFor ?? [])]);
  const termSet = new Set(terms);

  if (termSet.has("table") || termSet.has("altar") || termSet.has("throne") || termSet.has("sarcophagus")) {
    return { height: 2, width: 2 };
  }

  if (termSet.has("bookshelf") || termSet.has("shelf") || termSet.has("bench")) {
    return { height: 1, width: 2 };
  }

  return { height: 1, width: 1 };
}

function compareAssetsForPlacement(left: NormalizedFurnishingAsset, right: NormalizedFurnishingAsset): number {
  return right.area - left.area || right.qualityScore - left.qualityScore || left.assetId.localeCompare(right.assetId);
}

function assetFitsRoom(asset: NormalizedFurnishingAsset, roomType: FurnishingRoomType): boolean {
  const allowedTerms = new Set([...ROOM_TYPE_TERMS[roomType], roomType]);
  const assetTerms = new Set([asset.kind, ...asset.tags, ...asset.usableFor]);

  if (asset.usableFor.includes(roomType)) {
    return true;
  }

  if (roomType === "corridor") {
    return asset.kind === "light" || asset.kind === "decoration" || asset.usableFor.includes("corridor");
  }

  if (roomType === "entrance" && (asset.kind === "door" || asset.kind === "light")) {
    return true;
  }

  return [...assetTerms].some((term) => allowedTerms.has(term)) || ["furniture", "prop", "decoration", "light"].includes(asset.kind);
}

function calculateRoomBudget(room: RoomNode, density: FurnishingDensity): number {
  const area = room.bounds.width * room.bounds.height;
  return Math.max(1, Math.floor(area * DENSITY_RATIO[density]));
}

function findPlacement(input: {
  asset: NormalizedFurnishingAsset;
  occupied: Set<string>;
  room: RoomNode;
  roomType: FurnishingRoomType;
  tileLookup: Map<string, MapTile>;
}): CandidatePlacement | null {
  const positions = createCandidatePositions(input.room);

  for (const position of positions) {
    if (
      canPlaceFootprint({
        height: input.asset.height,
        occupied: input.occupied,
        room: input.room,
        tileLookup: input.tileLookup,
        width: input.asset.width,
        x: position.x,
        y: position.y
      })
    ) {
      return {
        asset: input.asset,
        room: input.room,
        roomType: input.roomType,
        x: position.x,
        y: position.y
      };
    }
  }

  return null;
}

function createCandidatePositions(room: RoomNode): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const startX = room.bounds.x + (room.bounds.width > 3 ? 1 : 0);
  const startY = room.bounds.y + (room.bounds.height > 3 ? 1 : 0);
  const endX = room.bounds.x + room.bounds.width - (room.bounds.width > 3 ? 1 : 0);
  const endY = room.bounds.y + room.bounds.height - (room.bounds.height > 3 ? 1 : 0);

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      positions.push({ x, y });
    }
  }

  return positions.sort((left, right) => {
    const leftEdge = distanceToRoomEdge(left, room);
    const rightEdge = distanceToRoomEdge(right, room);
    return leftEdge - rightEdge || left.y - right.y || left.x - right.x;
  });
}

function canPlaceFootprint(input: {
  height: number;
  occupied: Set<string>;
  room: RoomNode;
  tileLookup: Map<string, MapTile>;
  width: number;
  x: number;
  y: number;
}): boolean {
  if (input.x + input.width > input.room.bounds.x + input.room.bounds.width) {
    return false;
  }

  if (input.y + input.height > input.room.bounds.y + input.room.bounds.height) {
    return false;
  }

  for (let y = input.y; y < input.y + input.height; y += 1) {
    for (let x = input.x; x < input.x + input.width; x += 1) {
      const key = cellKey(x, y);
      const tile = input.tileLookup.get(key);

      if (input.occupied.has(key) || tile?.kind !== "floor") {
        return false;
      }
    }
  }

  return true;
}

function createPlacedAsset(document: MapDocument, offset: number, placement: CandidatePlacement): PlacedAsset {
  return {
    assetId: placement.asset.assetId,
    id: createPlacedAssetId(document, placement.asset.assetId, offset),
    layer: placement.asset.layer,
    locked: false,
    position: {
      x: placement.x,
      y: placement.y
    },
    rotation: 0,
    scale: 1,
    tags: ["auto-furnished", placement.room.id, placement.roomType, ...placement.asset.tags]
  };
}

function createTileLookup(tiles: MapTile[]): Map<string, MapTile> {
  return new Map(tiles.map((tile) => [cellKey(tile.x, tile.y), tile]));
}

function createOccupiedSet(assets: PlacedAsset[]): Set<string> {
  return new Set(assets.map((asset) => cellKey(asset.position.x, asset.position.y)));
}

function markOccupied(occupied: Set<string>, x: number, y: number, width: number, height: number): void {
  for (let cellY = y; cellY < y + height; cellY += 1) {
    for (let cellX = x; cellX < x + width; cellX += 1) {
      occupied.add(cellKey(cellX, cellY));
    }
  }
}

function distanceToRoomEdge(position: { x: number; y: number }, room: RoomNode): number {
  return Math.min(
    position.x - room.bounds.x,
    position.y - room.bounds.y,
    room.bounds.x + room.bounds.width - 1 - position.x,
    room.bounds.y + room.bounds.height - 1 - position.y
  );
}

function normalizeFootprint(value: number): number {
  return Math.max(1, Math.min(4, Math.floor(value)));
}

function normalizeQualityScore(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 50;
  }

  return Math.min(100, Math.max(0, value > 1 ? value : value * 100));
}

function normalizeTokens(values: string[]): string[] {
  return [...new Set(values.flatMap((value) => value.split(/[^a-z0-9]+/iu).map(normalizeToken)).filter(Boolean))];
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function createPlacedAssetId(document: MapDocument, assetId: string, offset: number): string {
  const safeAssetId = assetId.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  return `auto-${safeAssetId || "asset"}-${document.assets.length + offset + 1}`;
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
