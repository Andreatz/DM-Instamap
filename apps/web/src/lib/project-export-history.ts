import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { assertSafeProjectId, getProjectsRoot } from "./projects";
import { parseJsonFileContent } from "./json-file";

export const EXPORT_FORMATS = ["png", "webp", "dd2vtt", "foundry", "dmimap", "session-pack"] as const;
export type ProjectExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_MODES = ["player", "gm", "clean"] as const;
export type ProjectExportMode = (typeof EXPORT_MODES)[number];

const EXPORTS_DIR = "exports";
const HISTORY_FILE = "history.json";
const HISTORY_LIMIT = 50;

export const ProjectExportEntrySchema = z
  .object({
    createdAt: z.string().datetime(),
    filename: z.string().trim().min(1),
    format: z.enum(EXPORT_FORMATS),
    id: z.string().trim().min(1),
    includeGrid: z.boolean().optional(),
    mode: z.enum(EXPORT_MODES),
    scale: z.number().positive().optional()
  })
  .strict();

export type ProjectExportEntry = z.infer<typeof ProjectExportEntrySchema>;

export type RecordProjectExportInput = {
  filename: string;
  format: ProjectExportFormat;
  includeGrid?: boolean;
  mode: ProjectExportMode;
  scale?: number;
};

export type ExportHistorySummary = {
  lastExportAt: string | null;
  lastFormat: ProjectExportFormat | null;
  total: number;
};

const EXPORT_FORMAT_LABELS: Record<ProjectExportFormat, string> = {
  dd2vtt: "Universal VTT (dd2vtt)",
  dmimap: "dmimap (JSON)",
  foundry: "Modulo Foundry",
  png: "PNG",
  "session-pack": "Session Pack",
  webp: "WEBP"
};

const EXPORT_MODE_LABELS: Record<ProjectExportMode, string> = {
  clean: "Pulito",
  gm: "Game Master",
  player: "Giocatori"
};

export function describeExportFormat(format: ProjectExportFormat): string {
  return EXPORT_FORMAT_LABELS[format];
}

export function describeExportMode(mode: ProjectExportMode): string {
  return EXPORT_MODE_LABELS[mode];
}

export function summarizeExportHistory(entries: ProjectExportEntry[]): ExportHistorySummary {
  const latest = entries[0] ?? null;

  return {
    lastExportAt: latest?.createdAt ?? null,
    lastFormat: latest?.format ?? null,
    total: entries.length
  };
}

async function getHistoryPath(projectId: string, options: { outputRoot?: string }): Promise<string> {
  const safeProjectId = assertSafeProjectId(projectId);
  const projectsRoot = await getProjectsRoot(options.outputRoot);
  return path.join(projectsRoot, safeProjectId, EXPORTS_DIR, HISTORY_FILE);
}

export async function readProjectExportHistory(
  projectId: string,
  options: { outputRoot?: string } = {}
): Promise<ProjectExportEntry[]> {
  const historyPath = await getHistoryPath(projectId, options);

  try {
    const raw = await readFile(historyPath, "utf8");
    const parsed = parseJsonFileContent(raw);
    const entries = Array.isArray(parsed) ? parsed : [];

    return entries
      .map((entry) => ProjectExportEntrySchema.safeParse(entry))
      .filter((result): result is { data: ProjectExportEntry; success: true } => result.success)
      .map((result) => result.data)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

/**
 * Appends an export event to the project's local history. Failures are
 * swallowed so that recording history can never break an export download.
 */
export async function recordProjectExport(
  projectId: string,
  input: RecordProjectExportInput,
  options: { outputRoot?: string; now?: Date } = {}
): Promise<ProjectExportEntry | null> {
  try {
    const historyPath = await getHistoryPath(projectId, options);
    const createdAt = (options.now ?? new Date()).toISOString();
    const entry = ProjectExportEntrySchema.parse({
      createdAt,
      filename: input.filename,
      format: input.format,
      includeGrid: input.includeGrid,
      id: `export-${createdAt.replace(/[:.]/gu, "-")}-${Math.random().toString(36).slice(2, 8)}`,
      mode: input.mode,
      scale: input.scale
    });

    const existing = await readProjectExportHistory(projectId, options);
    const next = [entry, ...existing].slice(0, HISTORY_LIMIT);

    await mkdir(path.dirname(historyPath), { recursive: true });
    await writeJsonAtomic(historyPath, next);

    return entry;
  } catch {
    return null;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
