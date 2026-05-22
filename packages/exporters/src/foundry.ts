import JSZip from "jszip";
import type {
  DoorSegment,
  LightSource,
  MapDocument,
  MapNote,
  RoomNode,
  WallSegment
} from "@dm-instamap/core/browser";
import type { AssetResolver } from "./asset-resolver";
import { exportMapDocumentRaster, type RasterExportFormat } from "./raster";

export type FoundryVersion = "v12" | "v13";

export type FoundryExportOptions = {
  author?: string;
  assetResolver?: AssetResolver;
  description?: string;
  foundryVersion?: FoundryVersion;
  imageFormat?: RasterExportFormat;
  includeGridInImage?: boolean;
  includeJournals?: boolean;
  moduleId?: string;
  moduleTitle?: string;
  scale?: number;
  sceneId?: string;
  sceneName?: string;
  version?: string;
};

export type FoundryModuleData = {
  imageFormat: RasterExportFormat;
  journalJson: FoundryJournalEntryData[];
  mapImagePath: string;
  moduleId: string;
  moduleJson: FoundryModuleManifest;
  sceneJson: FoundrySceneData;
  sceneSlug: string;
};

const FOUNDRY_COMPATIBILITY: Record<FoundryVersion, { minimum: string; verified: string }> = {
  v12: { minimum: "11", verified: "12" },
  v13: { minimum: "12", verified: "13" }
};

export type FoundryModuleExportResult = {
  buffer: Buffer;
  filename: string;
  journalJson: FoundryJournalEntryData[];
  mapImagePath: string;
  moduleJson: FoundryModuleManifest;
  sceneJson: FoundrySceneData;
};

export type FoundryJournalEntryData = {
  _id: string;
  content: string;
  name: string;
  pages: Array<{
    _id: string;
    name: string;
    text: {
      content: string;
      format: 1;
    };
    title: {
      level: 1;
      show: true;
    };
    type: "text";
  }>;
  sort: number;
};

export type FoundryModuleManifest = {
  authors: Array<{
    name: string;
  }>;
  compatibility: {
    minimum: string;
    verified: string;
  };
  description: string;
  id: string;
  packs: Array<{
    label: string;
    name: string;
    path: string;
    type: "Scene" | "JournalEntry";
  }>;
  title: string;
  version: string;
};

export type FoundrySceneNoteData = {
  _id: string;
  entryId: string;
  icon: {
    src: string;
    tint: string | null;
  };
  pageId: string;
  text: string;
  x: number;
  y: number;
};

export type FoundrySceneData = {
  _id: string;
  active: boolean;
  background: {
    src: string;
  };
  grid: {
    distance: number;
    size: number;
    type: 1;
    units: string;
  };
  height: number;
  img: string;
  lights: FoundryAmbientLightData[];
  name: string;
  navigation: boolean;
  notes: FoundrySceneNoteData[];
  padding: number;
  walls: FoundryWallData[];
  width: number;
};

export type FoundryWallData = {
  _id: string;
  c: [number, number, number, number];
  door: 0 | 1;
  ds: 0 | 1 | 2;
  move: 1;
  sight: 1;
};

export type FoundryAmbientLightData = {
  _id: string;
  config: {
    alpha: number;
    bright: number;
    color: string;
    dim: number;
  };
  x: number;
  y: number;
};

/**
 * Builds the structural Foundry module data (manifest, scene, journals) without
 * rendering the battlemap image. Pure and synchronous, so it can drive the VTT
 * comparison manifest and structural tests without invoking Sharp.
 */
export function buildFoundryModuleData(document: MapDocument, options: FoundryExportOptions = {}): FoundryModuleData {
  const moduleId = slugify(options.moduleId ?? document.id);
  const sceneSlug = slugify(options.sceneId ?? options.moduleId ?? document.id);
  const imageFormat = options.imageFormat ?? "webp";
  const mapImagePath = `maps/${sceneSlug}.${imageFormat}`;
  const sceneImagePath = `modules/${moduleId}/${mapImagePath}`;
  const includeJournals = options.includeJournals ?? true;
  const journalJson = includeJournals ? buildJournalEntries(document) : [];
  const gmNoteLookup = buildGmNoteLookup(document, journalJson);
  const sceneJson = createFoundryScene(document, {
    gmNoteLookup,
    sceneId: sceneSlug,
    sceneImagePath,
    sceneName: options.sceneName ?? document.name
  });
  const moduleJson = createModuleManifest({
    author: options.author,
    description: options.description,
    foundryVersion: options.foundryVersion ?? "v12",
    hasJournals: journalJson.length > 0,
    moduleId,
    moduleTitle: options.moduleTitle ?? document.name,
    version: options.version
  });

  return { imageFormat, journalJson, mapImagePath, moduleId, moduleJson, sceneJson, sceneSlug };
}

export async function exportFoundryModule(
  document: MapDocument,
  options: FoundryExportOptions = {}
): Promise<FoundryModuleExportResult> {
  const data = buildFoundryModuleData(document, options);
  const image = await exportMapDocumentRaster(document, {
    assetResolver: options.assetResolver,
    format: data.imageFormat,
    includeGrid: options.includeGridInImage ?? false,
    scale: options.scale ?? 1
  });
  const zip = new JSZip();

  zip.file("module.json", `${JSON.stringify(data.moduleJson, null, 2)}\n`);
  zip.file(`scenes/${data.sceneSlug}.json`, `${JSON.stringify(data.sceneJson, null, 2)}\n`);
  zip.file("packs/scenes.db", `${JSON.stringify(data.sceneJson)}\n`);
  zip.file(data.mapImagePath, image.buffer);

  if (data.journalJson.length > 0) {
    zip.file(
      "packs/journal.db",
      `${data.journalJson.map((entry) => JSON.stringify(entry)).join("\n")}\n`
    );

    for (const journal of data.journalJson) {
      zip.file(`journal/${journal._id}.json`, `${JSON.stringify(journal, null, 2)}\n`);
    }
  }

  return {
    buffer: await zip.generateAsync({ compression: "DEFLATE", type: "nodebuffer" }),
    filename: `${data.moduleId}-foundry-module.zip`,
    journalJson: data.journalJson,
    mapImagePath: data.mapImagePath,
    moduleJson: data.moduleJson,
    sceneJson: data.sceneJson
  };
}

function createModuleManifest(input: {
  author?: string;
  description?: string;
  foundryVersion: FoundryVersion;
  hasJournals: boolean;
  moduleId: string;
  moduleTitle: string;
  version?: string;
}): FoundryModuleManifest {
  const packs: FoundryModuleManifest["packs"] = [
    {
      label: "Scenes",
      name: "scenes",
      path: "packs/scenes.db",
      type: "Scene"
    }
  ];

  if (input.hasJournals) {
    packs.push({
      label: "Journals",
      name: "journal",
      path: "packs/journal.db",
      type: "JournalEntry"
    });
  }

  return {
    authors: [
      {
        name: input.author ?? "DM-Instamap"
      }
    ],
    compatibility: FOUNDRY_COMPATIBILITY[input.foundryVersion],
    description: input.description ?? "Generated locally by DM-Instamap.",
    id: input.moduleId,
    packs,
    title: input.moduleTitle,
    version: input.version ?? "0.1.0"
  };
}

function buildJournalEntries(document: MapDocument): FoundryJournalEntryData[] {
  const entries: FoundryJournalEntryData[] = [];
  const rooms = document.plan?.rooms ?? [];
  const gmNotes = document.plan?.gmNotes ?? [];
  const planNotes = document.plan?.notes ?? [];

  if (rooms.length > 0) {
    entries.push(buildRoomJournalEntry(document, rooms));
  }

  if (gmNotes.length > 0) {
    entries.push(buildGmNotesJournalEntry(document, gmNotes));
  }

  if (planNotes.length > 0) {
    entries.push(buildPlanNotesJournalEntry(document, planNotes));
  }

  return entries.map((entry, index) => ({ ...entry, sort: index * 100 }));
}

function buildRoomJournalEntry(document: MapDocument, rooms: RoomNode[]): FoundryJournalEntryData {
  const pages = rooms.map((room, index) => ({
    _id: toFoundryId(`room-${room.id}-${index}`),
    name: room.label,
    text: {
      content: renderRoomHtml(room),
      format: 1 as const
    },
    title: {
      level: 1 as const,
      show: true as const
    },
    type: "text" as const
  }));

  return {
    _id: toFoundryId(`journal-rooms-${document.id}`),
    content: `Room overview for ${document.name}.`,
    name: `${document.name} — Rooms`,
    pages,
    sort: 0
  };
}

function buildGmNotesJournalEntry(document: MapDocument, notes: MapNote[]): FoundryJournalEntryData {
  const pages = notes.map((note, index) => ({
    _id: toFoundryId(`gmnote-${note.id}-${index}`),
    name: note.title,
    text: {
      content: `<p>${escapeHtml(note.text)}</p><p><em>Anchored at (${note.position.x}, ${note.position.y}).</em></p>`,
      format: 1 as const
    },
    title: {
      level: 1 as const,
      show: true as const
    },
    type: "text" as const
  }));

  return {
    _id: toFoundryId(`journal-gmnotes-${document.id}`),
    content: `GM notes for ${document.name}.`,
    name: `${document.name} — GM Notes`,
    pages,
    sort: 0
  };
}

function buildPlanNotesJournalEntry(document: MapDocument, notes: string[]): FoundryJournalEntryData {
  return {
    _id: toFoundryId(`journal-plan-${document.id}`),
    content: `Plan-level notes for ${document.name}.`,
    name: `${document.name} — Plan Notes`,
    pages: [
      {
        _id: toFoundryId(`plan-notes-${document.id}`),
        name: "Overview",
        text: {
          content: notes.map((note) => `<p>${escapeHtml(note)}</p>`).join(""),
          format: 1 as const
        },
        title: {
          level: 1 as const,
          show: true as const
        },
        type: "text" as const
      }
    ],
    sort: 0
  };
}

function renderRoomHtml(room: RoomNode): string {
  const tags = room.tags.length > 0 ? `<p><strong>Tags:</strong> ${room.tags.map(escapeHtml).join(", ")}</p>` : "";
  const connections = room.connections.length > 0
    ? `<p><strong>Connections:</strong> ${room.connections.map(escapeHtml).join(", ")}</p>`
    : "";
  const bounds = `<p><strong>Bounds:</strong> ${room.bounds.x}, ${room.bounds.y} (${room.bounds.width} x ${room.bounds.height})</p>`;
  return `<h2>${escapeHtml(room.label)}</h2>${bounds}${tags}${connections}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

type GmNoteLookup = {
  entryId: string;
  pageById: Map<string, string>;
} | null;

function buildGmNoteLookup(
  document: MapDocument,
  journals: FoundryJournalEntryData[]
): GmNoteLookup {
  const gmNotes = document.plan?.gmNotes ?? [];

  if (gmNotes.length === 0 || journals.length === 0) {
    return null;
  }

  const journal = journals.find((entry) => entry.name.endsWith("— GM Notes"));

  if (!journal) {
    return null;
  }

  const pageById = new Map<string, string>();

  gmNotes.forEach((note, index) => {
    const pageId = toFoundryId(`gmnote-${note.id}-${index}`);
    pageById.set(note.id, pageId);
  });

  return { entryId: journal._id, pageById };
}

function createFoundryScene(
  document: MapDocument,
  input: {
    gmNoteLookup: GmNoteLookup;
    sceneId: string;
    sceneImagePath: string;
    sceneName: string;
  }
): FoundrySceneData {
  const gridSize = document.grid.pixelsPerCell;
  const width = document.width * gridSize;
  const height = document.height * gridSize;
  const sceneNotes = input.gmNoteLookup
    ? (document.plan?.gmNotes ?? []).flatMap<FoundrySceneNoteData>((note, index) => {
        const pageId = input.gmNoteLookup?.pageById.get(note.id);
        if (!pageId || !input.gmNoteLookup) {
          return [];
        }

        return [
          {
            _id: toFoundryId(`scenenote-${note.id}-${index}`),
            entryId: input.gmNoteLookup.entryId,
            icon: {
              src: "icons/svg/book.svg",
              tint: null
            },
            pageId,
            text: note.title,
            x: roundCoordinate(note.position.x * gridSize),
            y: roundCoordinate(note.position.y * gridSize)
          }
        ];
      })
    : [];

  return {
    _id: toFoundryId(input.sceneId),
    active: false,
    background: {
      src: input.sceneImagePath
    },
    grid: {
      distance: document.grid.cellSize,
      size: gridSize,
      type: 1,
      units: document.grid.unit
    },
    height,
    img: input.sceneImagePath,
    lights: (document.plan?.lights ?? []).map((light, index) => convertLight(light, index, gridSize)),
    name: input.sceneName,
    navigation: false,
    notes: sceneNotes,
    padding: 0,
    walls: [
      ...(document.plan?.walls ?? []).map((wall, index) => convertWall(wall, index, gridSize)),
      ...(document.plan?.doors ?? []).map((door, index) => convertDoor(door, index, gridSize))
    ],
    width
  };
}

function convertWall(wall: WallSegment, index: number, gridSize: number): FoundryWallData {
  return {
    _id: toFoundryId(wall.id || `wall-${index + 1}`),
    c: [
      roundCoordinate(wall.start.x * gridSize),
      roundCoordinate(wall.start.y * gridSize),
      roundCoordinate(wall.end.x * gridSize),
      roundCoordinate(wall.end.y * gridSize)
    ],
    door: 0,
    ds: 0,
    move: 1,
    sight: 1
  };
}

function convertDoor(door: DoorSegment, index: number, gridSize: number): FoundryWallData {
  const halfWidth = (door.width * gridSize) / 2;
  const radians = (door.rotation * Math.PI) / 180;
  const dx = Math.cos(radians) * halfWidth;
  const dy = Math.sin(radians) * halfWidth;
  const centerX = door.position.x * gridSize;
  const centerY = door.position.y * gridSize;

  return {
    _id: toFoundryId(door.id || `door-${index + 1}`),
    c: [
      roundCoordinate(centerX - dx),
      roundCoordinate(centerY - dy),
      roundCoordinate(centerX + dx),
      roundCoordinate(centerY + dy)
    ],
    door: 1,
    ds: door.isLocked ? 2 : door.isOpen ? 1 : 0,
    move: 1,
    sight: 1
  };
}

function convertLight(light: LightSource, index: number, gridSize: number): FoundryAmbientLightData {
  return {
    _id: toFoundryId(light.id || `light-${index + 1}`),
    config: {
      alpha: light.intensity,
      bright: Math.max(0, Math.round(light.radius * gridSize * 0.45)),
      color: light.color,
      dim: Math.max(1, Math.round(light.radius * gridSize))
    },
    x: roundCoordinate(light.position.x * gridSize),
    y: roundCoordinate(light.position.y * gridSize)
  };
}

function toFoundryId(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9]/gu, "");
  return `${normalized}${"0000000000000000"}`.slice(0, 16);
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(3));
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "dm-instamap-map";
}
