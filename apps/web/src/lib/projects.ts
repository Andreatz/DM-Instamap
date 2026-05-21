import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { MapDocumentSchema, migrateMapDocument, type MapDocument } from "@dm-instamap/core/server";
import { generateDungeon } from "@dm-instamap/generator";
import { z } from "zod";
import { findWorkspaceRoot } from "./assets-manifest";
import { parseJsonFileContent } from "./json-file";

export const ProjectMetadataSchema = z
  .object({
    createdAt: z.string().datetime(),
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    relatedProjectIds: z.array(z.string()).default([]),
    selectedAssetGroupIds: z.array(z.string()).default([]),
    selectedReferenceIds: z.array(z.string()).default([]),
    sourceRequest: z.string().trim().optional(),
    styleDnaIds: z.array(z.string()).default([]),
    updatedAt: z.string().datetime()
  })
  .strict();

export type DmInstamapProjectMetadata = z.infer<typeof ProjectMetadataSchema>;

export const DmInstamapProjectSchema = ProjectMetadataSchema.extend({
  document: MapDocumentSchema
}).strict();

export type DmInstamapProject = z.infer<typeof DmInstamapProjectSchema>;

export type DmInstamapProjectSummary = DmInstamapProjectMetadata & {
  roomCount: number;
  size: {
    height: number;
    width: number;
  };
};

export type CreateProjectInput = {
  document?: unknown;
  heightCells?: unknown;
  name?: unknown;
  preferredId?: unknown;
  relatedProjectIds?: unknown;
  requiredRooms?: unknown;
  roomCount?: unknown;
  selectedAssetGroupIds?: unknown;
  selectedReferenceIds?: unknown;
  sourceRequest?: unknown;
  styleDnaIds?: unknown;
  theme?: unknown;
  widthCells?: unknown;
};

export type UpdateProjectInput = Partial<CreateProjectInput> & {
  id?: unknown;
};

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project not found: ${projectId}`);
  }
}

export class InvalidProjectIdError extends Error {
  constructor(projectId: string) {
    super(`Invalid project id: ${projectId}`);
  }
}

const PROJECTS_DIR = path.join("data", "projects");
const PROJECT_METADATA_FILE = "project.json";
const PROJECT_MAP_FILE = "map.dmimap.json";

export async function getProjectsRoot(outputRoot?: string): Promise<string> {
  const workspaceRoot = outputRoot ? path.resolve(outputRoot) : await findWorkspaceRoot(process.cwd());
  return path.join(workspaceRoot, PROJECTS_DIR);
}

export function createProjectSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/gu, "")
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 72) || "untitled-map"
  );
}

export function assertSafeProjectId(projectId: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,95}$/u.test(projectId)) {
    throw new InvalidProjectIdError(projectId);
  }

  return projectId;
}

export async function listProjects(options: { outputRoot?: string } = {}): Promise<DmInstamapProjectSummary[]> {
  const projectsRoot = await getProjectsRoot(options.outputRoot);

  try {
    const entries = await readdir(projectsRoot, { withFileTypes: true });
    const projects = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          try {
            const project = await readProject(entry.name, options);
            return toProjectSummary(project);
          } catch {
            return null;
          }
        })
    );

    return projects
      .filter((project): project is DmInstamapProjectSummary => project !== null)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

export async function createProject(
  input: CreateProjectInput,
  options: { outputRoot?: string } = {}
): Promise<DmInstamapProject> {
  const now = new Date().toISOString();
  const name = readString(input.name) || "Untitled Map";
  const preferredId = readString(input.preferredId);
  const id = preferredId
    ? await reservePreferredProjectId(preferredId, options)
    : await createUniqueProjectId(name, options);
  const document = createProjectDocument(input);
  const project = DmInstamapProjectSchema.parse({
    createdAt: now,
    document,
    id,
    name,
    relatedProjectIds: readStringArray(input.relatedProjectIds),
    selectedAssetGroupIds: readStringArray(input.selectedAssetGroupIds),
    selectedReferenceIds: readStringArray(input.selectedReferenceIds),
    sourceRequest: readOptionalString(input.sourceRequest),
    styleDnaIds: readStringArray(input.styleDnaIds),
    updatedAt: now
  });

  await writeProject(project, options);
  return project;
}

export type MultiFloorProjectInput = {
  baseSlug: string;
  documents: unknown[];
  name: string;
  selectedAssetGroupIds?: unknown;
  selectedReferenceIds?: unknown;
  sourceRequest?: unknown;
  styleDnaIds?: unknown;
};

export async function createMultiFloorProjects(
  input: MultiFloorProjectInput,
  options: { outputRoot?: string } = {}
): Promise<DmInstamapProject[]> {
  if (!Array.isArray(input.documents) || input.documents.length === 0) {
    throw new Error("documents array is required for multi-floor save");
  }

  const baseSlug = createProjectSlug(input.baseSlug);
  const ids = await reserveMultiFloorIds(baseSlug, input.documents.length, options);
  const projects: DmInstamapProject[] = [];

  for (let index = 0; index < input.documents.length; index += 1) {
    const id = ids[index];
    if (!id) {
      throw new Error("Could not reserve project id for floor");
    }

    const related = ids.filter((other) => other !== id);
    const floorName = `${input.name} — Floor ${index + 1}`;
    const project = await createProject(
      {
        document: input.documents[index],
        name: floorName,
        preferredId: id,
        relatedProjectIds: related,
        selectedAssetGroupIds: input.selectedAssetGroupIds,
        selectedReferenceIds: input.selectedReferenceIds,
        sourceRequest: input.sourceRequest,
        styleDnaIds: input.styleDnaIds
      },
      options
    );

    projects.push(project);
  }

  return projects;
}

export async function readProject(
  projectId: string,
  options: { outputRoot?: string } = {}
): Promise<DmInstamapProject> {
  const projectDir = await getProjectDir(projectId, options);

  try {
    const [metadataRaw, documentRaw] = await Promise.all([
      readFile(path.join(projectDir, PROJECT_METADATA_FILE), "utf8"),
      readFile(path.join(projectDir, PROJECT_MAP_FILE), "utf8")
    ]);
    const metadata = ProjectMetadataSchema.parse(parseJsonFileContent(metadataRaw));
    const document = migrateMapDocument(parseJsonFileContent(documentRaw));

    return DmInstamapProjectSchema.parse({
      ...metadata,
      document
    });
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new ProjectNotFoundError(projectId);
    }

    throw error;
  }
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
  options: { outputRoot?: string } = {}
): Promise<DmInstamapProject> {
  const current = await readProject(projectId, options);
  const now = new Date().toISOString();
  const document = input.document === undefined ? current.document : migrateMapDocument(input.document);
  const project = DmInstamapProjectSchema.parse({
    ...current,
    document,
    name: readString(input.name) || current.name,
    relatedProjectIds:
      input.relatedProjectIds === undefined
        ? current.relatedProjectIds
        : readStringArray(input.relatedProjectIds),
    selectedAssetGroupIds:
      input.selectedAssetGroupIds === undefined
        ? current.selectedAssetGroupIds
        : readStringArray(input.selectedAssetGroupIds),
    selectedReferenceIds:
      input.selectedReferenceIds === undefined
        ? current.selectedReferenceIds
        : readStringArray(input.selectedReferenceIds),
    sourceRequest:
      input.sourceRequest === undefined ? current.sourceRequest : readOptionalString(input.sourceRequest),
    styleDnaIds: input.styleDnaIds === undefined ? current.styleDnaIds : readStringArray(input.styleDnaIds),
    updatedAt: now
  });

  await writeProject(project, options);
  return project;
}

export async function deleteProject(projectId: string, options: { outputRoot?: string } = {}): Promise<void> {
  const projectDir = await getProjectDir(projectId, options);
  await rm(projectDir, { force: true, recursive: true });
}

export async function writeProject(
  project: DmInstamapProject,
  options: { outputRoot?: string } = {}
): Promise<void> {
  const parsed = DmInstamapProjectSchema.parse(project);
  const projectDir = await getProjectDir(parsed.id, options);
  const metadata: DmInstamapProjectMetadata = {
    createdAt: parsed.createdAt,
    id: parsed.id,
    name: parsed.name,
    relatedProjectIds: parsed.relatedProjectIds,
    selectedAssetGroupIds: parsed.selectedAssetGroupIds,
    selectedReferenceIds: parsed.selectedReferenceIds,
    sourceRequest: parsed.sourceRequest,
    styleDnaIds: parsed.styleDnaIds,
    updatedAt: parsed.updatedAt
  };

  await mkdir(projectDir, { recursive: true });
  await mkdir(path.join(projectDir, "exports"), { recursive: true });
  await mkdir(path.join(projectDir, "thumbnails"), { recursive: true });
  await writeJsonAtomic(path.join(projectDir, PROJECT_METADATA_FILE), metadata);
  await writeJsonAtomic(path.join(projectDir, PROJECT_MAP_FILE), parsed.document);
}

export function toProjectSummary(project: DmInstamapProject): DmInstamapProjectSummary {
  return {
    createdAt: project.createdAt,
    id: project.id,
    name: project.name,
    relatedProjectIds: project.relatedProjectIds,
    roomCount: project.document.plan?.rooms.length ?? 0,
    selectedAssetGroupIds: project.selectedAssetGroupIds,
    selectedReferenceIds: project.selectedReferenceIds,
    size: {
      height: project.document.height,
      width: project.document.width
    },
    sourceRequest: project.sourceRequest,
    styleDnaIds: project.styleDnaIds,
    updatedAt: project.updatedAt
  };
}

async function createUniqueProjectId(name: string, options: { outputRoot?: string }): Promise<string> {
  const root = await getProjectsRoot(options.outputRoot);
  const base = createProjectSlug(name);

  for (let index = 0; index < 1000; index += 1) {
    const id = index === 0 ? base : `${base}-${index + 1}`;

    try {
      await readFile(path.join(root, id, PROJECT_METADATA_FILE), "utf8");
    } catch (error) {
      if (isMissingFileError(error)) {
        return id;
      }

      throw error;
    }
  }

  return `${base}-${Date.now()}`;
}

async function reservePreferredProjectId(
  preferred: string,
  options: { outputRoot?: string }
): Promise<string> {
  const safe = assertSafeProjectId(preferred);
  const root = await getProjectsRoot(options.outputRoot);

  try {
    await readFile(path.join(root, safe, PROJECT_METADATA_FILE), "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return safe;
    }

    throw error;
  }

  return createUniqueProjectId(safe, options);
}

async function reserveMultiFloorIds(
  baseSlug: string,
  count: number,
  options: { outputRoot?: string }
): Promise<string[]> {
  const root = await getProjectsRoot(options.outputRoot);

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const candidates: string[] = [];
    for (let floor = 0; floor < count; floor += 1) {
      candidates.push(`${baseSlug}${suffix}-floor-${floor + 1}`);
    }

    const collisions = await Promise.all(
      candidates.map(async (id) => {
        try {
          await readFile(path.join(root, id, PROJECT_METADATA_FILE), "utf8");
          return true;
        } catch (error) {
          if (isMissingFileError(error)) {
            return false;
          }

          throw error;
        }
      })
    );

    if (collisions.every((collided) => !collided)) {
      candidates.forEach((id) => assertSafeProjectId(id));
      return candidates;
    }
  }

  const stamp = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const id = `${baseSlug}-${stamp}-floor-${index + 1}`;
    return assertSafeProjectId(id);
  });
}

async function getProjectDir(projectId: string, options: { outputRoot?: string }): Promise<string> {
  const safeProjectId = assertSafeProjectId(projectId);
  const root = await getProjectsRoot(options.outputRoot);
  const projectDir = path.resolve(root, safeProjectId);
  const relative = path.relative(root, projectDir);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new InvalidProjectIdError(projectId);
  }

  return projectDir;
}

function createProjectDocument(input: CreateProjectInput): MapDocument {
  if (input.document !== undefined) {
    return migrateMapDocument(input.document);
  }

  const theme = readString(input.theme) || "crypt";

  return generateDungeon({
    heightCells: readInteger(input.heightCells, 36, 12, 96),
    requiredRooms: readStringArray(input.requiredRooms),
    roomCount: readInteger(input.roomCount, 8, 1, 24),
    theme,
    widthCells: readInteger(input.widthCells, 52, 12, 96)
  });
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

function readInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(readString(value), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function readOptionalString(value: unknown): string | undefined {
  const text = readString(value).trim();
  return text ? text : undefined;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
  }

  if (typeof value === "string") {
    return [
      ...new Set(
        value
          .split(/[,;\n]+/u)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ];
  }

  return [];
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
