import { readFile } from "node:fs/promises";
import path from "node:path";
import { findWorkspaceRoot } from "./assets-manifest";
import { parseJsonFileContent } from "./json-file";

export type AssetGroupView = {
  assetCount: number;
  assetIds: string[];
  id: string;
  kind: string;
  name: string;
  previewUrl: string | null;
  qualityScore: number | null;
  representativeAssetId: string | null;
  representativeThumbnail: string | null;
  sourceFolders: string[];
  tags: string[];
  theme: string | null;
  themes: string[];
  usableFor: string[];
};

export type LoadedAssetGroups = {
  generatedAt: string | null;
  groupCount: number;
  groups: AssetGroupView[];
  groupsPath: string;
  missing: boolean;
};

type AssetGroupsFile = {
  generatedAt?: unknown;
  groupCount?: unknown;
  groups?: unknown;
};

type RawAssetGroup = {
  assetCount?: unknown;
  assetIds?: unknown;
  id?: unknown;
  kind?: unknown;
  name?: unknown;
  qualityScore?: unknown;
  representativeAssetId?: unknown;
  representativeThumbnail?: unknown;
  sourceFolders?: unknown;
  tags?: unknown;
  theme?: unknown;
  themes?: unknown;
  usableFor?: unknown;
};

export async function loadAssetGroups(): Promise<LoadedAssetGroups> {
  const workspaceRoot = await findWorkspaceRoot(process.cwd());
  const groupsPath = path.join(
    workspaceRoot,
    "data",
    "indexes",
    "asset-groups.json"
  );

  try {
    const raw = await readFile(groupsPath, "utf8");
    const file = parseJsonFileContent(raw) as AssetGroupsFile;
    const groups = Array.isArray(file.groups)
      ? normalizeAssetGroups(file.groups)
      : [];

    return {
      generatedAt:
        typeof file.generatedAt === "string" ? file.generatedAt : null,
      groupCount:
        typeof file.groupCount === "number" ? file.groupCount : groups.length,
      groups,
      groupsPath,
      missing: false
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        generatedAt: null,
        groupCount: 0,
        groups: [],
        groupsPath,
        missing: true
      };
    }

    throw error;
  }
}

export function normalizeAssetGroups(groups: unknown[]): AssetGroupView[] {
  return groups
    .map((group) => {
      if (!group || typeof group !== "object") {
        return null;
      }

      const input = group as RawAssetGroup;
      const id = readString(input.id);
      const assetIds = readStringArray(input.assetIds);
      const representativeAssetId =
        readString(input.representativeAssetId) || assetIds[0] || null;

      if (!id || assetIds.length === 0) {
        return null;
      }

      return {
        assetCount: readPositiveInteger(input.assetCount) ?? assetIds.length,
        assetIds,
        id,
        kind: readString(input.kind) || "unknown",
        name: readString(input.name) || id,
        previewUrl: representativeAssetId
          ? `/assets/preview/${encodeURIComponent(representativeAssetId)}`
          : null,
        qualityScore: readScore(input.qualityScore),
        representativeAssetId,
        representativeThumbnail:
          readString(input.representativeThumbnail) || null,
        sourceFolders: readStringArray(input.sourceFolders),
        tags: readStringArray(input.tags),
        theme: readString(input.theme) || null,
        themes: readStringArray(input.themes),
        usableFor: readStringArray(input.usableFor)
      };
    })
    .filter((group): group is AssetGroupView => group !== null)
    .sort(
      (left, right) =>
        right.assetCount - left.assetCount ||
        left.name.localeCompare(right.name)
    );
}

function readPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function readScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
