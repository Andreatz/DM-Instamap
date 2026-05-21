import { z } from "zod";

const IdSchema = z.string().trim().min(1);
const NameSchema = z.string().trim().min(1);
const LocalPathSchema = z.string().trim().min(1);
const TagsSchema = z.array(z.string().trim().min(1)).default([]);
const CoordinateSchema = z.number().finite();
const PositiveNumberSchema = z.number().finite().positive();
const NonNegativeNumberSchema = z.number().finite().nonnegative();
const PositiveIntegerSchema = z.number().int().positive();
const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const TimestampSchema = z.string().datetime();

export const DominantColorSchema = z
  .object({
    hex: HexColorSchema,
    population: z.number().int().nonnegative()
  })
  .strict();

export type DominantColor = z.infer<typeof DominantColorSchema>;

export const ReferenceMapTypeSchema = z.enum([
  "dungeon",
  "building",
  "city",
  "wilderness",
  "cave",
  "coast",
  "ship",
  "region",
  "world",
  "battlemap",
  "unknown"
]);

export type ReferenceMapType = z.infer<typeof ReferenceMapTypeSchema>;

export const PointSchema = z
  .object({
    x: CoordinateSchema,
    y: CoordinateSchema
  })
  .strict();

export type Point = z.infer<typeof PointSchema>;

export const BoundsSchema = z
  .object({
    height: PositiveNumberSchema,
    width: PositiveNumberSchema,
    x: CoordinateSchema,
    y: CoordinateSchema
  })
  .strict();

export type Bounds = z.infer<typeof BoundsSchema>;

export const TileKindSchema = z.enum(["floor", "wall", "door", "empty"]);

export type TileKind = z.infer<typeof TileKindSchema>;

export const MapTileSchema = z
  .object({
    id: IdSchema,
    kind: TileKindSchema,
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative()
  })
  .strict();

export type MapTile = z.infer<typeof MapTileSchema>;

export const GridConfigSchema = z
  .object({
    cellSize: PositiveNumberSchema,
    height: PositiveIntegerSchema,
    origin: PointSchema.default({ x: 0, y: 0 }),
    pixelsPerCell: PositiveIntegerSchema,
    type: z.enum(["square"]),
    unit: z.enum(["ft", "m"]),
    width: PositiveIntegerSchema
  })
  .strict();

export type GridConfig = z.infer<typeof GridConfigSchema>;

export const AssetMetadataSchema = z
  .object({
    classification: z.enum(["texture", "tile", "prop", "wall", "door", "light", "reference", "unknown"]),
    discoveredAt: TimestampSchema.optional(),
    height: PositiveIntegerSchema.optional(),
    id: IdSchema,
    name: NameSchema,
    path: LocalPathSchema,
    source: z.literal("local"),
    tags: TagsSchema,
    width: PositiveIntegerSchema.optional()
  })
  .strict();

export type AssetMetadata = z.infer<typeof AssetMetadataSchema>;

export const AssetGroupSchema = z
  .object({
    assetIds: z.array(IdSchema).min(1),
    assetCount: PositiveIntegerSchema.optional(),
    id: IdSchema,
    kind: z
      .enum([
        "floor",
        "wall",
        "door",
        "window",
        "prop",
        "furniture",
        "terrain",
        "water",
        "light",
        "roof",
        "decoration",
        "unknown"
      ])
      .optional(),
    name: NameSchema,
    notes: z.string().trim().optional(),
    qualityScore: z.number().finite().min(0).max(100).optional(),
    representativeAssetId: IdSchema.optional(),
    representativeThumbnail: LocalPathSchema.optional(),
    tags: TagsSchema,
    theme: z.string().trim().max(120).optional(),
    themes: TagsSchema,
    usableFor: TagsSchema
  })
  .strict();

export type AssetGroup = z.infer<typeof AssetGroupSchema>;

export const ReferenceMapMetadataSchema = z
  .object({
    dominantColors: z.array(DominantColorSchema).default([]),
    grid: GridConfigSchema.optional(),
    height: PositiveIntegerSchema,
    id: IdSchema,
    mapType: ReferenceMapTypeSchema.optional(),
    mapTypeConfidence: z.number().finite().min(0).max(1).optional(),
    name: NameSchema,
    path: LocalPathSchema,
    source: z.literal("local"),
    tags: TagsSchema,
    thumbnailPath: LocalPathSchema.optional(),
    width: PositiveIntegerSchema
  })
  .strict();

export type ReferenceMapMetadata = z.infer<typeof ReferenceMapMetadataSchema>;

export const MapRequestSchema = z
  .object({
    assetGroupIds: z.array(IdSchema).default([]),
    description: z.string().trim().max(2000).optional(),
    grid: GridConfigSchema,
    id: IdSchema,
    mapKind: z.enum(["dungeon", "building", "city"]),
    name: NameSchema,
    referenceMapIds: z.array(IdSchema).default([]),
    requestedExports: z.array(z.enum(["png", "webp", "dd2vtt", "foundry"])).default([]),
    requiredRooms: z.array(NameSchema).default([]),
    theme: z.string().trim().max(120).optional()
  })
  .strict();

export type MapRequest = z.infer<typeof MapRequestSchema>;

export const RoomNodeSchema = z
  .object({
    bounds: BoundsSchema,
    connections: z.array(IdSchema).default([]),
    id: IdSchema,
    kind: z.enum(["entrance", "room", "corridor", "stairs", "secret", "service"]),
    label: NameSchema,
    tags: TagsSchema
  })
  .strict();

export type RoomNode = z.infer<typeof RoomNodeSchema>;

export const WallSegmentSchema = z
  .object({
    blocksMovement: z.boolean().default(true),
    id: IdSchema,
    material: z.string().trim().optional(),
    roomIds: z.array(IdSchema).default([]),
    start: PointSchema,
    end: PointSchema,
    thickness: PositiveNumberSchema
  })
  .strict();

export type WallSegment = z.infer<typeof WallSegmentSchema>;

export const DoorSegmentSchema = z
  .object({
    id: IdSchema,
    isLocked: z.boolean().default(false),
    isOpen: z.boolean().default(false),
    position: PointSchema,
    rotation: z.number().finite().default(0),
    roomIds: z.array(IdSchema).default([]),
    wallId: IdSchema.optional(),
    width: PositiveNumberSchema
  })
  .strict();

export type DoorSegment = z.infer<typeof DoorSegmentSchema>;

export const LightSourceSchema = z
  .object({
    color: HexColorSchema,
    flicker: z.boolean().default(false),
    id: IdSchema,
    intensity: z.number().finite().min(0).max(1),
    kind: z.enum(["torch", "lantern", "magic", "daylight", "ambient"]),
    position: PointSchema,
    radius: PositiveNumberSchema
  })
  .strict();

export type LightSource = z.infer<typeof LightSourceSchema>;

export const MapNoteSchema = z
  .object({
    id: IdSchema,
    position: PointSchema,
    text: z.string().trim().min(1).max(2000),
    title: z.string().trim().min(1).max(120)
  })
  .strict();

export type MapNote = z.infer<typeof MapNoteSchema>;

export const InitiativeEntrySchema = z
  .object({
    armorClass: z.number().int().positive().optional(),
    hitPoints: z.number().int().optional(),
    id: IdSchema,
    initiative: z.number().int(),
    name: NameSchema,
    notes: z.string().trim().max(500).optional(),
    side: z.enum(["player", "enemy", "neutral"]).default("enemy")
  })
  .strict();

export type InitiativeEntry = z.infer<typeof InitiativeEntrySchema>;

export const MapLayerKindSchema = z.enum(["background", "terrain", "walls", "props", "lighting", "gm-only", "notes"]);

export type MapLayerKind = z.infer<typeof MapLayerKindSchema>;

export const MapLayerSchema = z
  .object({
    id: IdSchema,
    kind: MapLayerKindSchema,
    locked: z.boolean().default(false),
    name: NameSchema,
    opacity: z.number().finite().min(0).max(1).default(1),
    order: z.number().int().nonnegative(),
    visible: z.boolean().default(true)
  })
  .strict();

export type MapLayer = z.infer<typeof MapLayerSchema>;

export const PlacedAssetSchema = z
  .object({
    assetId: IdSchema,
    flipX: z.boolean().default(false),
    flipY: z.boolean().default(false),
    groupId: IdSchema.optional(),
    id: IdSchema,
    layer: z.enum(["floor", "wall", "object", "lighting", "annotation"]),
    locked: z.boolean().default(false),
    position: PointSchema,
    rotation: z.number().finite().default(0),
    scale: PositiveNumberSchema.default(1),
    tags: TagsSchema
  })
  .strict();

export type PlacedAsset = z.infer<typeof PlacedAssetSchema>;

export const MapPlanSchema = z
  .object({
    assetPlacements: z.array(PlacedAssetSchema).default([]),
    doors: z.array(DoorSegmentSchema).default([]),
    gmNotes: z.array(MapNoteSchema).default([]),
    id: IdSchema,
    initiative: z.array(InitiativeEntrySchema).default([]),
    lights: z.array(LightSourceSchema).default([]),
    name: NameSchema,
    notes: z.array(z.string().trim().min(1)).default([]),
    requestId: IdSchema,
    rooms: z.array(RoomNodeSchema).default([]),
    walls: z.array(WallSegmentSchema).default([])
  })
  .strict();

export type MapPlan = z.infer<typeof MapPlanSchema>;

export const MapDocumentSchema = z
  .object({
    assets: z.array(PlacedAssetSchema).default([]),
    createdAt: TimestampSchema.optional(),
    editable: z.literal(true),
    grid: GridConfigSchema,
    height: PositiveIntegerSchema,
    id: IdSchema,
    layers: z.array(MapLayerSchema).default([
      { id: "layer-background", kind: "background", locked: true, name: "Background", opacity: 1, order: 0, visible: true },
      { id: "layer-terrain", kind: "terrain", locked: false, name: "Terrain", opacity: 1, order: 1, visible: true },
      { id: "layer-walls", kind: "walls", locked: false, name: "Walls", opacity: 1, order: 2, visible: true },
      { id: "layer-props", kind: "props", locked: false, name: "Props", opacity: 1, order: 3, visible: true },
      { id: "layer-lighting", kind: "lighting", locked: false, name: "Lighting", opacity: 1, order: 4, visible: true },
      { id: "layer-gm-only", kind: "gm-only", locked: false, name: "GM Only", opacity: 1, order: 5, visible: true },
      { id: "layer-notes", kind: "notes", locked: false, name: "Notes", opacity: 1, order: 6, visible: true }
    ]),
    name: NameSchema,
    plan: MapPlanSchema.optional(),
    tiles: z.array(MapTileSchema).default([]),
    updatedAt: TimestampSchema.optional(),
    version: z.literal(1),
    width: PositiveIntegerSchema
  })
  .strict();

export type MapDocument = z.infer<typeof MapDocumentSchema>;

export const ExportJobSchema = z
  .object({
    completedAt: TimestampSchema.optional(),
    createdAt: TimestampSchema,
    documentId: IdSchema,
    error: z.string().trim().optional(),
    format: z.enum(["png", "webp", "dd2vtt", "foundry"]),
    id: IdSchema,
    outputPath: LocalPathSchema.optional(),
    status: z.enum(["queued", "running", "completed", "failed"])
  })
  .strict()
  .superRefine((job, context) => {
    if (job.status === "completed" && !job.outputPath) {
      context.addIssue({
        code: "custom",
        message: "Completed export jobs must include an output path.",
        path: ["outputPath"]
      });
    }

    if (job.status === "failed" && !job.error) {
      context.addIssue({
        code: "custom",
        message: "Failed export jobs must include an error message.",
        path: ["error"]
      });
    }
  });

export type ExportJob = z.infer<typeof ExportJobSchema>;

export function createMapDocument(input: {
  grid?: Partial<GridConfig>;
  height: number;
  id: string;
  name: string;
  plan?: MapPlan;
  tiles?: MapTile[];
  width: number;
}): MapDocument {
  const grid = GridConfigSchema.parse({
    cellSize: input.grid?.cellSize ?? 5,
    height: input.grid?.height ?? input.height,
    origin: input.grid?.origin ?? { x: 0, y: 0 },
    pixelsPerCell: input.grid?.pixelsPerCell ?? 70,
    type: input.grid?.type ?? "square",
    unit: input.grid?.unit ?? "ft",
    width: input.grid?.width ?? input.width
  });

  return MapDocumentSchema.parse({
    assets: [],
    editable: true,
    grid,
    height: input.height,
    id: input.id,
    name: input.name,
    plan: input.plan,
    tiles: input.tiles ?? [],
    version: 1,
    width: input.width
  });
}

export { CampaignSchema, createCampaign, type Campaign, type CampaignSession, type CampaignMapLink } from "./campaign";
export {
  CURRENT_MAP_DOCUMENT_VERSION,
  MapDocumentMigrationError,
  migrateMapDocument
} from "./migrations";
