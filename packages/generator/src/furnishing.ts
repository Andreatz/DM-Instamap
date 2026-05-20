import type { MapDocument, MapTile, PlacedAsset, RoomNode } from "@dm-instamap/core";
import type { NarrativeRoom } from "./blueprint";

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

export type FurnishingAssetGroup = {
  assetIds: string[];
  kind?: string;
  qualityScore?: number;
  tags?: string[];
  theme?: string;
  themes?: string[];
  usableFor?: string[];
};

export type AutoFurnishOptions = {
  assetGroups?: FurnishingAssetGroup[];
  assets: FurnishingAsset[];
  density?: FurnishingDensity;
  includeCorridors?: boolean;
  narrativeRooms?: NarrativeRoom[];
  seed?: string;
  styleTags?: string[];
};

type PlacementPreference = "center" | "light" | "scatter" | "wall";

export type FurnishingPlacementDebug = {
  assetId: string;
  footprint: {
    height: number;
    width: number;
  };
  placement: PlacementPreference;
  reasons: string[];
  roomId: string;
  roomType: FurnishingRoomType;
  score: number;
};

export type AutoFurnishResult = {
  document: MapDocument;
  placed: FurnishingPlacementDebug[];
  skipped: Array<{
    assetId: string;
    reason: string;
    roomId: string;
  }>;
  summary: {
    density: FurnishingDensity;
    placedCount: number;
    roomCount: number;
    skippedCount: number;
  };
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

type RoomFurnishingContext = {
  narrativeRoom: NarrativeRoom | null;
  room: RoomNode;
  roomType: FurnishingRoomType;
  terms: string[];
};

const DENSITY_RATIO: Record<FurnishingDensity, number> = {
  normal: 0.1,
  rich: 0.16,
  sparse: 0.05
};

const ROOM_TYPE_TERMS: Record<FurnishingRoomType, string[]> = {
  boss_room: ["altar", "boss", "boss_room", "final", "ritual", "sarcophagus", "throne"],
  chapel: ["altar", "candle", "chapel", "holy", "pew", "reliquary", "shrine", "temple"],
  corridor: ["corridor", "hall", "light", "torch"],
  crypt: ["bone", "coffin", "crypt", "grave", "sarcophagus", "skull", "tomb"],
  entrance: ["door", "entrance", "gate", "light", "stairs", "torch"],
  forge: ["anvil", "fire", "forge", "metal", "smith", "tool"],
  library: ["book", "bookshelf", "desk", "library", "shelf", "study"],
  prison: ["bar", "bars", "cage", "cell", "chain", "chains", "prison"],
  storage: ["barrel", "box", "crate", "sack", "storage"],
  treasure_room: ["chest", "coin", "gold", "hoard", "reliquary", "treasure"]
};

export function autoFurnishMap(document: MapDocument, options: AutoFurnishOptions): AutoFurnishResult {
  const density = options.density ?? "normal";
  const tileLookup = createTileLookup(document.tiles);
  const occupied = createOccupiedSet(document.assets);
  const assets = [...options.assets, ...createAssetsFromGroups(options.assetGroups ?? [])]
    .map(normalizeAsset)
    .sort(compareAssetsForPlacement);
  const rooms = selectRooms(document, Boolean(options.includeCorridors)).sort(compareRoomsForFurnishing);
  const styleTags = normalizeTokens(options.styleTags ?? []);
  const additions: PlacedAsset[] = [];
  const placed: FurnishingPlacementDebug[] = [];
  const skipped: AutoFurnishResult["skipped"] = [];

  for (const room of rooms) {
    const narrativeRoom = findNarrativeRoomForRoom(room, options.narrativeRooms ?? []);
    const roomType = inferFurnishingRoomType(room, narrativeRoom);
    const context = createRoomFurnishingContext(room, roomType, narrativeRoom);
    const roomBudget = calculateRoomBudget(room, density);
    let usedArea = 0;
    const roomAssets = assets
      .map((asset) => ({
        asset,
        score: scoreAssetForRoom(asset, context, styleTags)
      }))
      .filter((candidate) => candidate.score > 0)
      .sort(compareRoomAssetCandidates);

    for (const { asset, score } of roomAssets) {
      if (usedArea >= roomBudget) {
        break;
      }

      const placement = inferPlacementPreference(asset, context);
      const candidate = findPlacement({ asset, occupied, placement, room, roomType, tileLookup });

      if (!candidate) {
        skipped.push({
          assetId: asset.assetId,
          reason: `No ${placement} collision-free floor position inside room bounds.`,
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
        placement,
        reasons: explainAssetRoomMatch(asset, context, styleTags),
        roomId: room.id,
        roomType,
        score
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
    skipped,
    summary: {
      density,
      placedCount: placed.length,
      roomCount: rooms.length,
      skippedCount: skipped.length
    }
  };
}

export function inferFurnishingRoomType(room: RoomNode, narrativeRoom?: NarrativeRoom | null): FurnishingRoomType {
  if (room.kind === "entrance") {
    return "entrance";
  }

  if (room.kind === "corridor") {
    return "corridor";
  }

  const text = normalizeTokens([
    room.label,
    ...room.tags,
    narrativeRoom?.label ?? "",
    narrativeRoom?.tacticalRole ?? "",
    ...(narrativeRoom?.tags ?? [])
  ]).join(" ");

  if (/\b(boss|boss_room|final|ritual)\b/u.test(text)) {
    return "boss_room";
  }

  if (/\b(treasure|hoard|reliquary)\b/u.test(text)) {
    return "treasure_room";
  }

  const specificRoomTypes: FurnishingRoomType[] = ["prison", "forge", "library", "chapel", "storage", "crypt"];

  for (const roomType of specificRoomTypes) {
    const terms = ROOM_TYPE_TERMS[roomType];

    if (terms.some((term) => text.includes(term))) {
      return roomType;
    }
  }

  return "crypt";
}

export function inferPlacementPreference(
  asset: FurnishingAsset | NormalizedFurnishingAsset,
  context?: RoomFurnishingContext
): PlacementPreference {
  const terms = new Set(
    "area" in asset
      ? [asset.kind, ...asset.tags, ...asset.usableFor]
      : normalizeTokens([asset.kind, ...(asset.tags ?? []), ...(asset.usableFor ?? [])])
  );

  if (terms.has("light") || terms.has("torch") || terms.has("lantern") || asset.kind === "light") {
    return "light";
  }

  if (
    terms.has("bookshelf") ||
    terms.has("shelf") ||
    terms.has("banner") ||
    terms.has("rack") ||
    terms.has("weapon") ||
    terms.has("bar") ||
    terms.has("bars")
  ) {
    return "wall";
  }

  if (
    terms.has("altar") ||
    terms.has("sarcophagus") ||
    terms.has("coffin") ||
    terms.has("table") ||
    terms.has("throne") ||
    terms.has("ritual") ||
    context?.roomType === "boss_room"
  ) {
    return "center";
  }

  return "scatter";
}

function createAssetsFromGroups(groups: FurnishingAssetGroup[]): FurnishingAsset[] {
  return groups
    .filter((group) => group.assetIds[0])
    .map((group) => ({
      assetId: group.assetIds[0] as string,
      kind: group.kind ?? "prop",
      qualityScore: group.qualityScore,
      tags: [...(group.tags ?? []), ...(group.themes ?? []), ...(group.theme ? [group.theme] : [])],
      usableFor: group.usableFor
    }));
}

function selectRooms(document: MapDocument, includeCorridors: boolean): RoomNode[] {
  const supportedKinds = new Set<RoomNode["kind"]>(
    includeCorridors ? ["corridor", "entrance", "room"] : ["entrance", "room"]
  );
  return (document.plan?.rooms ?? []).filter((room) => supportedKinds.has(room.kind));
}

function compareRoomsForFurnishing(left: RoomNode, right: RoomNode): number {
  return roomKindPriority(left) - roomKindPriority(right) || left.id.localeCompare(right.id);
}

function roomKindPriority(room: RoomNode): number {
  if (room.kind === "room") {
    return room.tags.some((tag) => tag === "boss" || tag === "final" || tag === "role-boss") ? 0 : 1;
  }

  if (room.kind === "entrance") {
    return 2;
  }

  return 3;
}

function normalizeAsset(asset: FurnishingAsset): NormalizedFurnishingAsset {
  const inferredFootprint = inferAssetFootprint(asset);
  const width = normalizeFootprint(asset.widthCells ?? inferredFootprint.width);
  const height = normalizeFootprint(asset.heightCells ?? inferredFootprint.height);

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

  if (termSet.has("bookshelf") || termSet.has("shelf") || termSet.has("bench") || termSet.has("bars")) {
    return { height: 1, width: 2 };
  }

  return { height: 1, width: 1 };
}

function compareAssetsForPlacement(left: NormalizedFurnishingAsset, right: NormalizedFurnishingAsset): number {
  return right.area - left.area || right.qualityScore - left.qualityScore || left.assetId.localeCompare(right.assetId);
}

function compareRoomAssetCandidates(
  left: { asset: NormalizedFurnishingAsset; score: number },
  right: { asset: NormalizedFurnishingAsset; score: number }
): number {
  return (
    right.score - left.score ||
    right.asset.area - left.asset.area ||
    right.asset.qualityScore - left.asset.qualityScore ||
    left.asset.assetId.localeCompare(right.asset.assetId)
  );
}

function scoreAssetForRoom(
  asset: NormalizedFurnishingAsset,
  context: RoomFurnishingContext,
  styleTags: string[]
): number {
  const assetTerms = new Set([asset.kind, ...asset.tags, ...asset.usableFor]);
  let score = 0;

  if (asset.usableFor.includes(context.roomType)) {
    score += 8;
  }

  for (const term of assetTerms) {
    if (context.terms.includes(term) || ROOM_TYPE_TERMS[context.roomType].includes(term)) {
      score += 3;
    }

    if (styleTags.includes(term)) {
      score += 1;
    }
  }

  if (context.narrativeRoom) {
    const suggestedTerms = normalizeTokens([
      ...context.narrativeRoom.suggestedAssets,
      ...context.narrativeRoom.suggestedLights
    ]);

    for (const term of assetTerms) {
      if (suggestedTerms.includes(term)) {
        score += 4;
      }
    }
  }

  if (context.roomType === "corridor" && (asset.kind === "light" || asset.usableFor.includes("corridor"))) {
    score += 5;
  }

  if (context.roomType === "entrance" && (asset.kind === "door" || asset.kind === "light")) {
    score += 4;
  }

  if (["furniture", "prop", "decoration", "light"].includes(asset.kind)) {
    score += 1;
  }

  return score + asset.qualityScore / 100;
}

function explainAssetRoomMatch(
  asset: NormalizedFurnishingAsset,
  context: RoomFurnishingContext,
  styleTags: string[]
): string[] {
  const assetTerms = new Set([asset.kind, ...asset.tags, ...asset.usableFor]);
  const reasons: string[] = [];

  if (asset.usableFor.includes(context.roomType)) {
    reasons.push(`usableFor:${context.roomType}`);
  }

  for (const term of assetTerms) {
    if (context.terms.includes(term) || ROOM_TYPE_TERMS[context.roomType].includes(term)) {
      reasons.push(`term:${term}`);
    }

    if (styleTags.includes(term)) {
      reasons.push(`style:${term}`);
    }
  }

  if (context.narrativeRoom) {
    const suggestedTerms = normalizeTokens([
      ...context.narrativeRoom.suggestedAssets,
      ...context.narrativeRoom.suggestedLights
    ]);
    const matchedSuggestion = [...assetTerms].find((term) => suggestedTerms.includes(term));

    if (matchedSuggestion) {
      reasons.push(`narrative:${matchedSuggestion}`);
    }
  }

  return reasons.length > 0 ? [...new Set(reasons)].slice(0, 5) : ["generic-usable"];
}

function calculateRoomBudget(room: RoomNode, density: FurnishingDensity): number {
  const area = room.bounds.width * room.bounds.height;
  return Math.max(1, Math.floor(area * DENSITY_RATIO[density]));
}

function findPlacement(input: {
  asset: NormalizedFurnishingAsset;
  occupied: Set<string>;
  placement: PlacementPreference;
  room: RoomNode;
  roomType: FurnishingRoomType;
  tileLookup: Map<string, MapTile>;
}): CandidatePlacement | null {
  const positions = createCandidatePositions(input.room, input.placement);

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

function createCandidatePositions(room: RoomNode, placement: PlacementPreference): Array<{ x: number; y: number }> {
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

  return positions.sort((left, right) => comparePositionsForPlacement(left, right, room, placement));
}

function comparePositionsForPlacement(
  left: { x: number; y: number },
  right: { x: number; y: number },
  room: RoomNode,
  placement: PlacementPreference
): number {
  const leftEdge = distanceToRoomEdge(left, room);
  const rightEdge = distanceToRoomEdge(right, room);
  const leftCenter = distanceToRoomCenter(left, room);
  const rightCenter = distanceToRoomCenter(right, room);

  if (placement === "center") {
    return leftCenter - rightCenter || rightEdge - leftEdge || left.y - right.y || left.x - right.x;
  }

  if (placement === "wall" || placement === "light") {
    return leftEdge - rightEdge || leftCenter - rightCenter || left.y - right.y || left.x - right.x;
  }

  return Math.abs(leftEdge - 1) - Math.abs(rightEdge - 1) || leftCenter - rightCenter || left.y - right.y || left.x - right.x;
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

function distanceToRoomCenter(position: { x: number; y: number }, room: RoomNode): number {
  const centerX = room.bounds.x + room.bounds.width / 2;
  const centerY = room.bounds.y + room.bounds.height / 2;
  return Math.abs(position.x + 0.5 - centerX) + Math.abs(position.y + 0.5 - centerY);
}

function createRoomFurnishingContext(
  room: RoomNode,
  roomType: FurnishingRoomType,
  narrativeRoom: NarrativeRoom | null
): RoomFurnishingContext {
  return {
    narrativeRoom,
    room,
    roomType,
    terms: normalizeTokens([
      room.label,
      ...room.tags,
      roomType,
      narrativeRoom?.label ?? "",
      narrativeRoom?.purpose ?? "",
      narrativeRoom?.tacticalRole ?? "",
      ...(narrativeRoom?.tags ?? [])
    ])
  };
}

function findNarrativeRoomForRoom(room: RoomNode, narrativeRooms: NarrativeRoom[]): NarrativeRoom | null {
  if (narrativeRooms.length === 0) {
    return null;
  }

  const blueprintTag = room.tags.find((tag) => tag.startsWith("blueprint-"))?.replace(/^blueprint-/u, "");

  if (blueprintTag) {
    const byTag = narrativeRooms.find((narrativeRoom) => narrativeRoom.id === blueprintTag);

    if (byTag) {
      return byTag;
    }
  }

  const normalizedLabel = normalizeToken(room.label);
  return (
    narrativeRooms.find((narrativeRoom) => normalizeToken(narrativeRoom.label) === normalizedLabel) ??
    narrativeRooms.find((narrativeRoom) => room.tags.includes(`role-${narrativeRoom.tacticalRole}`)) ??
    null
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
  return [
    ...new Set(
      values
        .flatMap((value) => [normalizeToken(value), ...value.split(/[^a-z0-9]+/iu).map(normalizeToken)])
        .filter(Boolean)
    )
  ];
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
