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
  styleDna: ReferenceStyleDnaView | null;
};

export type LoadedReferenceMaps = {
  generatedAt: string | null;
  manifestPath: string;
  missing: boolean;
  references: ReferenceMapView[];
  sourceRoot: string | null;
};

export type ReferenceStyleDnaView = {
  confidence: number;
  density: string;
  grid: {
    confidence: number;
    detected: boolean;
    estimatedCellSizePx: number | null;
  };
  id: string;
  layoutTraits: string[];
  mood: string[];
  palette: Array<{
    hex: string;
    population: number;
    role: string;
  }>;
  promptSummary: string;
  recommendedAssetTags: string[];
  referenceId: string;
  visualTags: string[];
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

type ReferenceStyleDnaFile = {
  styles?: unknown;
};

type RawReferenceStyleDna = {
  confidence?: unknown;
  density?: unknown;
  grid?: unknown;
  id?: unknown;
  layoutTraits?: unknown;
  mood?: unknown;
  palette?: unknown;
  promptSummary?: unknown;
  recommendedAssetTags?: unknown;
  referenceId?: unknown;
  visualTags?: unknown;
};

export async function loadReferenceMaps(): Promise<LoadedReferenceMaps> {
  const workspaceRoot = await findWorkspaceRoot(process.cwd());
  const manifestPath = path.join(workspaceRoot, "data", "indexes", "references.manifest.json");
  const styleDnaPath = path.join(workspaceRoot, "data", "indexes", "reference-style-dna.json");

  try {
    const [raw, styleDnaByReferenceId] = await Promise.all([
      readFile(manifestPath, "utf8"),
      loadReferenceStyleDna(styleDnaPath)
    ]);
    const manifest = parseJsonFileContent(raw) as ReferencesManifestFile;
    const references = Array.isArray(manifest.references)
      ? normalizeReferenceMaps(manifest.references, styleDnaByReferenceId)
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

export function normalizeReferenceMaps(
  references: unknown[],
  styleDnaByReferenceId = new Map<string, ReferenceStyleDnaView>()
): ReferenceMapView[] {
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
        width: readNullableNumber(input.width),
        styleDna: styleDnaByReferenceId.get(id) ?? null
      };
    })
    .filter((reference): reference is ReferenceMapView => reference !== null)
    .sort((left, right) => left.mapType.localeCompare(right.mapType) || left.path.localeCompare(right.path));
}

async function loadReferenceStyleDna(styleDnaPath: string): Promise<Map<string, ReferenceStyleDnaView>> {
  try {
    const file = parseJsonFileContent(await readFile(styleDnaPath, "utf8")) as ReferenceStyleDnaFile;
    const styles = Array.isArray(file.styles) ? file.styles : [];
    const normalized = new Map<string, ReferenceStyleDnaView>();

    for (const style of styles) {
      const view = normalizeReferenceStyleDna(style);

      if (view) {
        normalized.set(view.referenceId, view);
      }
    }

    return normalized;
  } catch (error) {
    if (isMissingFileError(error)) {
      return new Map();
    }

    throw error;
  }
}

function normalizeReferenceStyleDna(style: unknown): ReferenceStyleDnaView | null {
  if (!style || typeof style !== "object") {
    return null;
  }

  const input = style as RawReferenceStyleDna;
  const id = readString(input.id);
  const referenceId = readString(input.referenceId);

  if (!id || !referenceId) {
    return null;
  }

  return {
    confidence: readConfidence(input.confidence),
    density: readString(input.density) || "medium",
    grid: normalizeGrid(input.grid),
    id,
    layoutTraits: readStringArray(input.layoutTraits),
    mood: readStringArray(input.mood),
    palette: normalizePalette(input.palette),
    promptSummary: readString(input.promptSummary),
    recommendedAssetTags: readStringArray(input.recommendedAssetTags),
    referenceId,
    visualTags: readStringArray(input.visualTags)
  };
}

function normalizeGrid(value: unknown): ReferenceStyleDnaView["grid"] {
  if (!value || typeof value !== "object") {
    return {
      confidence: 0,
      detected: false,
      estimatedCellSizePx: null
    };
  }

  const input = value as { confidence?: unknown; detected?: unknown; estimatedCellSizePx?: unknown };

  return {
    confidence: readConfidence(input.confidence),
    detected: input.detected === true,
    estimatedCellSizePx: readNullableNumber(input.estimatedCellSizePx)
  };
}

function normalizePalette(value: unknown): ReferenceStyleDnaView["palette"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const input = item as { hex?: unknown; population?: unknown; role?: unknown };
      const hex = readString(input.hex);
      const population = readNullableNumber(input.population);

      if (!hex || population === null) {
        return null;
      }

      return {
        hex,
        population,
        role: readString(input.role) || "unknown"
      };
    })
    .filter((item): item is ReferenceStyleDnaView["palette"][number] => item !== null);
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
