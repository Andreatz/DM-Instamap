import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AssetOverrideEntry,
  AssetOverridesFile
} from "@dm-instamap/assets/taxonomy";
import { findWorkspaceRoot } from "./assets-manifest";
import { parseJsonFileContent } from "./json-file";

/**
 * Read/write helpers for the pipeline override file
 * `data/assets/overrides/asset-overrides.json`. The semantic-group review
 * persists corrections here (asset-level, keyed by path); the taxonomy pipeline
 * applies them during `pnpm assets:manifest`.
 */

export type { AssetOverrideEntry, AssetOverridesFile };

export async function getOverridesPath(): Promise<string> {
  const workspaceRoot = await findWorkspaceRoot(process.cwd());
  return path.join(
    workspaceRoot,
    "data",
    "assets",
    "overrides",
    "asset-overrides.json"
  );
}

export async function loadTaxonomyOverrides(): Promise<AssetOverridesFile> {
  const overridesPath = await getOverridesPath();

  try {
    const parsed = parseJsonFileContent(await readFile(overridesPath, "utf8"));
    return normalizeOverrides(parsed);
  } catch (error) {
    if (isMissingFileError(error)) {
      return { assets: {}, groups: {}, packs: {} };
    }
    throw error;
  }
}

export async function saveTaxonomyOverrides(
  file: AssetOverridesFile
): Promise<AssetOverridesFile> {
  const overridesPath = await getOverridesPath();
  const normalized = normalizeOverrides(file);
  await mkdir(path.dirname(overridesPath), { recursive: true });
  await writeFile(
    overridesPath,
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8"
  );
  return normalized;
}

/** Merge per-path asset overrides into the file (later entries win). */
export function mergeAssetOverrides(
  file: AssetOverridesFile,
  entriesByPath: Array<{ path: string; entry: AssetOverrideEntry }>
): AssetOverridesFile {
  const assets = { ...(file.assets ?? {}) };

  for (const { path: assetPath, entry } of entriesByPath) {
    assets[assetPath] = { ...assets[assetPath], ...entry };
  }

  return { ...file, assets };
}

export function countAssetOverrides(file: AssetOverridesFile): number {
  return Object.keys(file.assets ?? {}).length;
}

function normalizeOverrides(input: unknown): AssetOverridesFile {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { assets: {}, groups: {}, packs: {} };
  }
  const value = input as AssetOverridesFile;
  return {
    assets:
      value.assets && typeof value.assets === "object" ? value.assets : {},
    groups:
      value.groups && typeof value.groups === "object" ? value.groups : {},
    packs: value.packs && typeof value.packs === "object" ? value.packs : {}
  };
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
