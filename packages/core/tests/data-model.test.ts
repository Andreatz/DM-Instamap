import { describe, expect, it } from "vitest";
import {
  AssetGroupSchema,
  AssetMetadataSchema,
  DoorSegmentSchema,
  ExportJobSchema,
  GridConfigSchema,
  InitiativeEntrySchema,
  LightSourceSchema,
  MapLayerSchema,
  MapDocumentSchema,
  MapNoteSchema,
  MapPlanSchema,
  MapRequestSchema,
  PlacedAssetSchema,
  ReferenceMapMetadataSchema,
  RoomNodeSchema,
  WallSegmentSchema
} from "../src";

const grid = {
  cellSize: 5,
  height: 20,
  pixelsPerCell: 70,
  type: "square",
  unit: "ft",
  width: 30
} as const;

const room = {
  bounds: { height: 6, width: 8, x: 2, y: 3 },
  id: "room-entry",
  kind: "entrance",
  label: "Entry Hall"
} as const;

const wall = {
  end: { x: 10, y: 0 },
  id: "wall-north",
  start: { x: 0, y: 0 },
  thickness: 0.5
} as const;

const door = {
  id: "door-entry",
  position: { x: 4, y: 0 },
  wallId: "wall-north",
  width: 1.5
} as const;

const light = {
  color: "#ffcc88",
  flicker: true,
  id: "light-torch",
  intensity: 0.8,
  kind: "torch",
  position: { x: 3, y: 3 },
  radius: 6
} as const;

const placedAsset = {
  assetId: "asset-table",
  flipX: true,
  groupId: "asset-group-1",
  id: "placed-table",
  layer: "object",
  position: { x: 5, y: 5 }
} as const;

const mapLayer = {
  id: "layer-props",
  kind: "props",
  name: "Props",
  opacity: 0.8,
  order: 3,
  visible: true
} as const;

const plan = {
  assetPlacements: [placedAsset],
  doors: [door],
  gmNotes: [{ id: "note-1", position: { x: 4, y: 5 }, text: "Hidden lever", title: "Secret" }],
  id: "plan-1",
  initiative: [{ hitPoints: 12, id: "initiative-1", initiative: 15, name: "Skeleton", side: "enemy" }],
  lights: [light],
  name: "Starter Plan",
  requestId: "request-1",
  rooms: [room],
  walls: [wall]
} as const;

const validCases = [
  [
    "AssetMetadata",
    AssetMetadataSchema,
    {
      classification: "tile",
      height: 512,
      id: "asset-floor",
      name: "Stone Floor",
      path: "assets/stone-floor.png",
      source: "local",
      tags: ["stone"],
      width: 512
    }
  ],
  [
    "AssetGroup",
    AssetGroupSchema,
    {
      assetIds: ["asset-floor"],
      assetCount: 1,
      id: "group-stone",
      kind: "floor",
      name: "Stone Set"
    }
  ],
  [
    "ReferenceMapMetadata",
    ReferenceMapMetadataSchema,
    {
      dominantColors: [{ hex: "#336699", population: 12 }],
      height: 1200,
      id: "reference-old-keep",
      mapType: "building",
      mapTypeConfidence: 0.75,
      name: "Old Keep",
      path: "references/old-keep.png",
      source: "local",
      thumbnailPath: "data/previews/references/reference-old-keep.webp",
      width: 1600
    }
  ],
  [
    "MapRequest",
    MapRequestSchema,
    {
      grid,
      id: "request-1",
      mapKind: "dungeon",
      name: "Starter Dungeon",
      requestedExports: ["png"],
      requiredRooms: ["Entry Hall"]
    }
  ],
  ["MapPlan", MapPlanSchema, plan],
  [
    "MapDocument",
    MapDocumentSchema,
    {
      editable: true,
      grid,
      height: 20,
      id: "document-1",
      layers: [mapLayer],
      name: "Editable Dungeon",
      plan,
      tiles: [{ id: "tile-0-0", kind: "floor", x: 0, y: 0 }],
      version: 1,
      width: 30
    }
  ],
  ["RoomNode", RoomNodeSchema, room],
  ["WallSegment", WallSegmentSchema, wall],
  ["DoorSegment", DoorSegmentSchema, door],
  ["LightSource", LightSourceSchema, light],
  ["MapNote", MapNoteSchema, { id: "note-1", position: { x: 4, y: 5 }, text: "Hidden lever", title: "Secret" }],
  ["InitiativeEntry", InitiativeEntrySchema, { id: "initiative-1", initiative: 15, name: "Skeleton" }],
  ["PlacedAsset", PlacedAssetSchema, placedAsset],
  ["MapLayer", MapLayerSchema, mapLayer],
  ["GridConfig", GridConfigSchema, grid],
  [
    "ExportJob",
    ExportJobSchema,
    {
      completedAt: "2026-05-19T10:00:00.000Z",
      createdAt: "2026-05-19T09:59:00.000Z",
      documentId: "document-1",
      format: "png",
      id: "export-1",
      outputPath: "exports/document-1.png",
      status: "completed"
    }
  ]
] as const;

const invalidCases = [
  ["AssetMetadata", AssetMetadataSchema, { id: "asset-floor", source: "remote" }],
  ["AssetGroup", AssetGroupSchema, { assetIds: [], id: "group-stone", name: "Stone Set" }],
  ["ReferenceMapMetadata", ReferenceMapMetadataSchema, { height: 0, id: "ref", name: "Ref", path: "ref.png", source: "local", width: 1 }],
  ["MapRequest", MapRequestSchema, { grid, id: "request-1", mapKind: "spaceship", name: "Wrong" }],
  ["MapPlan", MapPlanSchema, { id: "plan-1", name: "Plan", requestId: "" }],
  ["MapDocument", MapDocumentSchema, { editable: false, grid, height: 20, id: "doc", name: "Doc", version: 1, width: 30 }],
  ["RoomNode", RoomNodeSchema, { ...room, bounds: { height: -1, width: 8, x: 2, y: 3 } }],
  ["WallSegment", WallSegmentSchema, { ...wall, thickness: 0 }],
  ["DoorSegment", DoorSegmentSchema, { ...door, width: -1 }],
  ["LightSource", LightSourceSchema, { ...light, color: "orange" }],
  ["MapNote", MapNoteSchema, { id: "note-1", position: { x: 4, y: 5 }, text: "", title: "Secret" }],
  ["InitiativeEntry", InitiativeEntrySchema, { id: "initiative-1", initiative: 15, name: "" }],
  ["PlacedAsset", PlacedAssetSchema, { ...placedAsset, scale: 0 }],
  ["MapLayer", MapLayerSchema, { ...mapLayer, opacity: 1.5 }],
  ["GridConfig", GridConfigSchema, { ...grid, pixelsPerCell: 0 }],
  ["ExportJob", ExportJobSchema, { createdAt: "2026-05-19T09:59:00.000Z", documentId: "document-1", format: "png", id: "export-1", status: "completed" }]
] as const;

describe("core data model schemas", () => {
  it.each(validCases)("accepts valid %s data", (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });

  it.each(invalidCases)("rejects invalid %s data", (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});
