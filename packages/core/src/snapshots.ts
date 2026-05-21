import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { MapDocumentSchema, type MapDocument } from "./index";

export const SnapshotMetadataSchema = z
  .object({
    contentHash: z.string().min(8),
    createdAt: z.string().datetime(),
    documentId: z.string().trim().min(1),
    label: z.string().trim().min(1).max(120),
    projectId: z.string().trim().min(1)
  })
  .strict();

export type SnapshotMetadata = z.infer<typeof SnapshotMetadataSchema>;

export const SnapshotRecordSchema = SnapshotMetadataSchema.extend({
  document: z.lazy(() => MapDocumentSchema)
}).strict();

export type SnapshotRecord = SnapshotMetadata & { document: MapDocument };

export type CreateSnapshotInput = {
  document: MapDocument;
  label?: string;
  now?: () => string;
  projectId: string;
};

export type SnapshotDiffField =
  | "name"
  | "width"
  | "height"
  | "tiles"
  | "rooms"
  | "walls"
  | "doors"
  | "lights"
  | "assets"
  | "gmNotes"
  | "initiative"
  | "layers";

export type SnapshotDiff = {
  changedFields: SnapshotDiffField[];
  fromHash: string;
  identical: boolean;
  toHash: string;
};

export type SnapshotsDirectoryOptions = {
  outputRoot?: string;
  projectId: string;
  snapshotsRoot?: string;
};

const DEFAULT_SNAPSHOTS_ROOT = path.join("data", "projects");

export function computeDocumentContentHash(document: MapDocument): string {
  const serialized = JSON.stringify(stableSerializeDocument(document));
  return createHash("sha256").update(serialized).digest("hex").slice(0, 16);
}

export function createMapSnapshot(input: CreateSnapshotInput): SnapshotRecord {
  const document = MapDocumentSchema.parse(input.document);
  const now = input.now ? input.now() : new Date().toISOString();
  const contentHash = computeDocumentContentHash(document);
  const label = (input.label ?? "auto").trim() || "auto";

  return SnapshotRecordSchema.parse({
    contentHash,
    createdAt: now,
    document,
    documentId: document.id,
    label,
    projectId: input.projectId
  });
}

export function diffSnapshots(left: SnapshotRecord, right: SnapshotRecord): SnapshotDiff {
  if (left.contentHash === right.contentHash) {
    return {
      changedFields: [],
      fromHash: left.contentHash,
      identical: true,
      toHash: right.contentHash
    };
  }

  const changed = new Set<SnapshotDiffField>();
  const a = left.document;
  const b = right.document;

  if (a.name !== b.name) {
    changed.add("name");
  }

  if (a.width !== b.width) {
    changed.add("width");
  }

  if (a.height !== b.height) {
    changed.add("height");
  }

  if (!arraysEqualByJson(a.tiles, b.tiles)) {
    changed.add("tiles");
  }

  if (!arraysEqualByJson(a.assets, b.assets)) {
    changed.add("assets");
  }

  if (!arraysEqualByJson(a.layers, b.layers)) {
    changed.add("layers");
  }

  if (!arraysEqualByJson(a.plan?.rooms ?? [], b.plan?.rooms ?? [])) {
    changed.add("rooms");
  }

  if (!arraysEqualByJson(a.plan?.walls ?? [], b.plan?.walls ?? [])) {
    changed.add("walls");
  }

  if (!arraysEqualByJson(a.plan?.doors ?? [], b.plan?.doors ?? [])) {
    changed.add("doors");
  }

  if (!arraysEqualByJson(a.plan?.lights ?? [], b.plan?.lights ?? [])) {
    changed.add("lights");
  }

  if (!arraysEqualByJson(a.plan?.gmNotes ?? [], b.plan?.gmNotes ?? [])) {
    changed.add("gmNotes");
  }

  if (!arraysEqualByJson(a.plan?.initiative ?? [], b.plan?.initiative ?? [])) {
    changed.add("initiative");
  }

  return {
    changedFields: [...changed].sort(),
    fromHash: left.contentHash,
    identical: false,
    toHash: right.contentHash
  };
}

export function resolveSnapshotsDirectory(options: SnapshotsDirectoryOptions): string {
  const outputRoot = path.resolve(options.outputRoot ?? process.cwd());
  const projectsRoot = path.resolve(outputRoot, options.snapshotsRoot ?? DEFAULT_SNAPSHOTS_ROOT);
  return path.join(projectsRoot, options.projectId, "snapshots");
}

export async function writeSnapshotToDirectory(
  snapshot: SnapshotRecord,
  options: SnapshotsDirectoryOptions
): Promise<{ filePath: string; written: boolean }> {
  const directory = resolveSnapshotsDirectory({ ...options, projectId: snapshot.projectId });
  await mkdir(directory, { recursive: true });
  const existing = await listSnapshotsInDirectory({ ...options, projectId: snapshot.projectId });
  const duplicate = existing.find((entry) => entry.contentHash === snapshot.contentHash);

  if (duplicate) {
    return { filePath: path.join(directory, duplicate.fileName), written: false };
  }

  const fileName = buildSnapshotFileName(snapshot);
  const filePath = path.join(directory, fileName);
  await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return { filePath, written: true };
}

export async function listSnapshotsInDirectory(options: SnapshotsDirectoryOptions): Promise<Array<SnapshotMetadata & { fileName: string }>> {
  const directory = resolveSnapshotsDirectory(options);
  let files: string[];

  try {
    files = await readdir(directory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const entries: Array<SnapshotMetadata & { fileName: string }> = [];

  for (const fileName of files) {
    if (!fileName.endsWith(".json")) {
      continue;
    }

    try {
      const raw = await readFile(path.join(directory, fileName), "utf8");
      const parsed = SnapshotRecordSchema.parse(JSON.parse(raw));
      entries.push({
        contentHash: parsed.contentHash,
        createdAt: parsed.createdAt,
        documentId: parsed.documentId,
        fileName,
        label: parsed.label,
        projectId: parsed.projectId
      });
    } catch {
      continue;
    }
  }

  return entries.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function readSnapshotFromDirectory(
  contentHash: string,
  options: SnapshotsDirectoryOptions
): Promise<SnapshotRecord | null> {
  const entries = await listSnapshotsInDirectory(options);
  const target = entries.find((entry) => entry.contentHash === contentHash);

  if (!target) {
    return null;
  }

  const directory = resolveSnapshotsDirectory(options);
  const raw = await readFile(path.join(directory, target.fileName), "utf8");
  return SnapshotRecordSchema.parse(JSON.parse(raw));
}

export async function restoreSnapshotFromDirectory(
  contentHash: string,
  options: SnapshotsDirectoryOptions
): Promise<MapDocument | null> {
  const record = await readSnapshotFromDirectory(contentHash, options);
  return record ? record.document : null;
}

export type MapDocumentDelta = {
  fields: Partial<MapDocument>;
};

export type DeltaSnapshotRecord = SnapshotMetadata & {
  delta: MapDocumentDelta;
  parentHash: string;
};

export const DeltaSnapshotRecordSchema = SnapshotMetadataSchema.extend({
  delta: z.object({
    fields: z.record(z.string(), z.unknown())
  }),
  parentHash: z.string().min(8)
}).strict();

export function computeMapDocumentDelta(base: MapDocument, target: MapDocument): MapDocumentDelta {
  const baseParsed = stableSerializeDocument(base);
  const targetParsed = stableSerializeDocument(target);
  const fields: Partial<MapDocument> = {};
  const keys = new Set<keyof MapDocument>([
    ...(Object.keys(baseParsed) as Array<keyof MapDocument>),
    ...(Object.keys(targetParsed) as Array<keyof MapDocument>)
  ]);

  for (const key of keys) {
    const left = baseParsed[key];
    const right = targetParsed[key];

    if (JSON.stringify(left) !== JSON.stringify(right)) {
      (fields as Record<string, unknown>)[key] = right;
    }
  }

  return { fields };
}

export function applyMapDocumentDelta(base: MapDocument, delta: MapDocumentDelta): MapDocument {
  const merged: Record<string, unknown> = {
    ...stableSerializeDocument(base),
    ...delta.fields
  };
  return MapDocumentSchema.parse(merged);
}

export function createDeltaSnapshot(input: {
  base: SnapshotRecord;
  document: MapDocument;
  label?: string;
  now?: () => string;
  projectId: string;
}): DeltaSnapshotRecord {
  const target = MapDocumentSchema.parse(input.document);
  const now = input.now ? input.now() : new Date().toISOString();
  const contentHash = computeDocumentContentHash(target);
  const label = (input.label ?? "auto").trim() || "auto";
  const delta = computeMapDocumentDelta(input.base.document, target);

  return DeltaSnapshotRecordSchema.parse({
    contentHash,
    createdAt: now,
    delta,
    documentId: target.id,
    label,
    parentHash: input.base.contentHash,
    projectId: input.projectId
  });
}

export function restoreDeltaSnapshot(base: SnapshotRecord, delta: DeltaSnapshotRecord): MapDocument {
  return applyMapDocumentDelta(base.document, delta.delta);
}

function buildSnapshotFileName(snapshot: SnapshotRecord): string {
  const timestamp = snapshot.createdAt.replace(/[:.]/gu, "-");
  return `${timestamp}__${snapshot.contentHash}.json`;
}

function arraysEqualByJson(left: unknown[], right: unknown[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function stableSerializeDocument(document: MapDocument): MapDocument {
  return MapDocumentSchema.parse(document);
}
