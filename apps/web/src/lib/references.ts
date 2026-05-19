import { readFile } from "node:fs/promises";
import path from "node:path";
import { findWorkspaceRoot } from "./assets-manifest";
import { parseJsonFileContent } from "./json-file";

export type ReferenceMapView = {
  dominantColors: Array<{
    hex: string;
    population: number;
  }>;
  extension: string;
  height: number | null;
  id: string;
  mapType: string;
  mapTypeConfidence: number;
  path: string;
  previewUrl: string;
  tags: string[];
  thumbnailPath: string | null;
  width: number | null;
};

export type LoadedReferenceMaps = {
  generatedAt: string | null;
  manifestPath: string;
  missing: boolean;
  references: ReferenceMapView[];
  sourceRoot: string | null;
};

type ReferencesManifestFile = {
  generatedAt?: unknown;
  references?: unknown;
  sourceRoot?: unknown;
};

type RawReferenceMap = {
  dominantColors?: unknown;
  extension?: unknown;
  height?: unknown;
  id?: unknown;
  mapType?: unknown;
  mapTypeConfidence?: unknown;
  path?: unknown;
  tags?: unknown;
  thumbnailPath?: unknown;
  width?: unknown;
};

export async function loadReferenceMaps(): Promise<LoadedReferenceMaps> {
  const workspaceRoot = await findWorkspaceRoot(process.cwd());
  const manifestPath = path.join(workspaceRoot, "data", "indexes", "references.manifest.json");

  try {
    const raw = await readFile(manifestPath, "utf8");
    const manifest = parseJsonFileContent(raw) as ReferencesManifestFile;
    const references = Array.isArray(manifest.references)
      ? normalizeReferenceMaps(manifest.references)
      : [];

    return {
      generatedAt: typeof manifest.generatedAt === "string" ? manifest.generatedAt : null,
      manifestPath,
      missing: false,
      references,
      sourceRoot: typeof manifest.sourceRoot === "string" ? manifest.sourceRoot : null
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        generatedAt: null,
        manifestPath,
        missing: true,
        references: [],
        sourceRoot: null
      };
    }

    throw error;
  }
}

export function normalizeReferenceMaps(references: unknown[]): ReferenceMapView[] {
  return references
    .map((reference) => {
      if (!reference || typeof reference !== "object") {
        return null;
      }

      const input = reference as RawReferenceMap;
      const id = readString(input.id);
      const referencePath = readString(input.path);

      if (!id || !referencePath) {
        return null;
      }

      return {
        dominantColors: readDominantColors(input.dominantColors),
        extension: readString(input.extension),
        height: readNullableNumber(input.height),
        id,
        mapType: readString(input.mapType) || "unknown",
        mapTypeConfidence: readConfidence(input.mapTypeConfidence),
        path: referencePath,
        previewUrl: `/references/preview/${encodeURIComponent(id)}`,
        tags: readStringArray(input.tags),
        thumbnailPath: readString(input.thumbnailPath) || null,
        width: readNullableNumber(input.width)
      };
    })
    .filter((reference): reference is ReferenceMapView => reference !== null)
    .sort((left, right) => left.mapType.localeCompare(right.mapType) || left.path.localeCompare(right.path));
}

function readDominantColors(value: unknown): ReferenceMapView["dominantColors"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((color) => {
      if (!color || typeof color !== "object") {
        return null;
      }

      const candidate = color as { hex?: unknown; population?: unknown };
      const hex = readString(candidate.hex);
      const population = readNullableNumber(candidate.population);

      if (!hex || population === null) {
        return null;
      }

      return { hex, population };
    })
    .filter((color): color is { hex: string; population: number } => color !== null);
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
