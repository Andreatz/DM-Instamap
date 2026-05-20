import JSZip from "jszip";
import type {
  DoorSegment,
  LightSource,
  MapDocument,
  MapNote,
  RoomNode,
  WallSegment
} from "@dm-instamap/core";
import { exportMapDocumentRaster, type RasterExportFormat } from "./raster";

export type FoundryExportOptions = {
  author?: string;
  description?: string;
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

export async function exportFoundryModule(
  document: MapDocument,
  options: FoundryExportOptions = {}
): Promise<FoundryModuleExportResult> {
  const moduleId = slugify(options.moduleId ?? document.id);
  const sceneSlug = slugify(options.sceneId ?? options.moduleId ?? document.id);
  const imageFormat = options.imageFormat ?? "webp";
  const image = await exportMapDocumentRaster(document, {
    format: imageFormat,
    includeGrid: options.includeGridInImage ?? false,
    scale: options.scale ?? 1
  });
  const mapImagePath = `maps/${sceneSlug}.${imageFormat}`;
  const sceneImagePath = `modules/${moduleId}/${mapImagePath}`;
  const sceneJson = createFoundryScene(document, {
    sceneId: sceneSlug,
    sceneImagePath,
    sceneName: options.sceneName ?? document.name
  });
  const includeJournals = options.includeJournals ?? true;
  const journalJson = includeJournals ? buildJournalEntries(document) : [];
  const moduleJson = createModuleManifest({
    author: options.author,
    description: options.description,
    hasJournals: journalJson.length > 0,
    moduleId,
    moduleTitle: options.moduleTitle ?? document.name,
    version: options.version
  });
  const zip = new JSZip();

  zip.file("module.json", `${JSON.stringify(moduleJson, null, 2)}\n`);
  zip.file(`scenes/${sceneSlug}.json`, `${JSON.stringify(sceneJson, null, 2)}\n`);
  zip.file("packs/scenes.db", `${JSON.stringify(sceneJson)}\n`);
  zip.file(mapImagePath, image.buffer);

  if (journalJson.length > 0) {
    zip.file(
      "packs/journal.db",
      `${journalJson.map((entry) => JSON.stringify(entry)).join("\n")}\n`
    );

    for (const journal of journalJson) {
      zip.file(`journal/${journal._id}.json`, `${JSON.stringify(journal, null, 2)}\n`);
    }
  }

  return {
    buffer: await zip.generateAsync({ compression: "DEFLATE", type: "nodebuffer" }),
    filename: `${moduleId}-foundry-module.zip`,
    journalJson,
    mapImagePath,
    moduleJson,
    sceneJson
  };
}

function createModuleManifest(input: {
  author?: string;
  description?: string;
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
    compatibility: {
      minimum: "11",
      verified: "12"
    },
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

function createFoundryScene(
  document: MapDocument,
  input: {
    sceneId: string;
    sceneImagePath: string;
    sceneName: string;
  }
): FoundrySceneData {
  const gridSize = document.grid.pixelsPerCell;
  const width = document.width * gridSize;
  const height = document.height * gridSize;

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
