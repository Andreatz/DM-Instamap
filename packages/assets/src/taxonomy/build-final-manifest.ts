/**
 * Reusable final-manifest builder for the asset taxonomy pipeline.
 *
 * This contains the logic previously embedded in `scripts/assets/build-manifest.ts`
 * so server-side UI actions can rebuild `data/assets/asset-manifest.json`
 * immediately after writing overrides.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildAssetGroupsIndex, type ScannerAssetResolver } from "./groups-index";
import { buildManifest, TAXONOMY_PATHS } from "./manifest-io";
import { applyOverrides, type AssetOverridesFile } from "./overrides";
import type { AssetManifest, AssetManifestItem } from "./schema";

const DEFAULT_LEGACY_GROUPS_INDEX_PATH = "data/indexes/asset-groups.json";
const DEFAULT_SCANNER_MANIFEST_PATH = "data/indexes/assets.manifest.json";

type MappedFile = {
  version?: number;
  assets?: AssetManifestItem[];
};

export type BuildFinalTaxonomyManifestOptions = {
  /** Absolute workspace/repository root. Defaults to the current working dir. */
  workspaceRoot?: string;
  mappedWithMetadataPath?: string;
  mappedAssetsPath?: string;
  overridesPath?: string;
  finalManifestPath?: string;
  scannerManifestPath?: string;
  legacyGroupsIndexPath?: string;
  regenerateLegacyGroupsIndex?: boolean;
};

export type BuildFinalTaxonomyManifestResult = {
  finalManifestPath: string;
  groupCount: number | null;
  legacyGroupsIndexPath: string | null;
  manifest: AssetManifest;
  overriddenCount: number;
  sourcePath: string;
};

/**
 * Apply taxonomy overrides to the mapped asset list and rewrite the final
 * manifest. By default it also rewrites the legacy `data/indexes/asset-groups.json`
 * integration index from the semantic manifest so editor/export/AI integrations
 * stay in sync.
 */
export async function buildFinalTaxonomyManifest(
  options: BuildFinalTaxonomyManifestOptions = {}
): Promise<BuildFinalTaxonomyManifestResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const mappedWithMetadataPath =
    options.mappedWithMetadataPath ?? TAXONOMY_PATHS.mappedWithMetadata;
  const mappedAssetsPath = options.mappedAssetsPath ?? TAXONOMY_PATHS.mappedAssets;
  const overridesPath = options.overridesPath ?? TAXONOMY_PATHS.overridesFile;
  const finalManifestPath = options.finalManifestPath ?? TAXONOMY_PATHS.finalManifest;
  const legacyGroupsIndexPath =
    options.legacyGroupsIndexPath ?? DEFAULT_LEGACY_GROUPS_INDEX_PATH;
  const scannerManifestPath =
    options.scannerManifestPath ?? DEFAULT_SCANNER_MANIFEST_PATH;

  const source =
    (await tryLoadJson<MappedFile>(workspaceRoot, mappedWithMetadataPath)) ??
    (await tryLoadJson<MappedFile>(workspaceRoot, mappedAssetsPath));

  if (!source?.assets || !Array.isArray(source.assets)) {
    throw new Error(
      "Nessun mapped-assets trovato. Esegui prima pnpm assets:map-taxonomy."
    );
  }

  const sourcePath =
    (await existsJson(workspaceRoot, mappedWithMetadataPath))
      ? mappedWithMetadataPath
      : mappedAssetsPath;

  const overrides =
    (await tryLoadJson<AssetOverridesFile>(workspaceRoot, overridesPath)) ?? {};

  let overriddenCount = 0;
  const items = source.assets.map((item) => {
    const { item: result, applied } = applyOverrides(item, overrides);
    if (applied.length > 0) {
      overriddenCount += 1;
    }
    return result;
  });

  const manifest = buildManifest(items);
  await saveJson(workspaceRoot, finalManifestPath, manifest, { pretty: false });

  let groupCount: number | null = null;
  let writtenLegacyGroupsIndexPath: string | null = null;

  if (options.regenerateLegacyGroupsIndex !== false) {
    const scannerResolver = await loadScannerResolver(
      workspaceRoot,
      scannerManifestPath
    );
    const groupsIndex = buildAssetGroupsIndex(manifest.assets, scannerResolver);
    await saveJson(workspaceRoot, legacyGroupsIndexPath, groupsIndex, {
      pretty: false
    });
    groupCount = groupsIndex.groupCount;
    writtenLegacyGroupsIndexPath = legacyGroupsIndexPath;
  }

  return {
    finalManifestPath,
    groupCount,
    legacyGroupsIndexPath: writtenLegacyGroupsIndexPath,
    manifest,
    overriddenCount,
    sourcePath
  };
}

async function loadScannerResolver(
  workspaceRoot: string,
  scannerManifestPath: string
): Promise<ScannerAssetResolver> {
  const data = await tryLoadJson<{
    assets?: Array<{
      id?: unknown;
      relativePath?: unknown;
      thumbnailPath?: unknown;
    }>;
  }>(workspaceRoot, scannerManifestPath);

  const index = new Map<string, { id: string; thumbnailPath: string | null }>();
  if (data?.assets && Array.isArray(data.assets)) {
    for (const entry of data.assets) {
      const id = typeof entry.id === "string" ? entry.id : "";
      const relativePath =
        typeof entry.relativePath === "string" ? entry.relativePath : "";
      if (!id || !relativePath) {
        continue;
      }
      const key = scannerKey(relativePath);
      if (key && !index.has(key)) {
        index.set(key, {
          id,
          thumbnailPath:
            typeof entry.thumbnailPath === "string" ? entry.thumbnailPath : null
        });
      }
    }
  }

  return (assetPath: string) => index.get(scannerKey(assetPath)) ?? null;
}

async function tryLoadJson<T>(
  workspaceRoot: string,
  relativePath: string
): Promise<T | null> {
  try {
    const raw = await readFile(resolveWorkspacePath(workspaceRoot, relativePath), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function existsJson(
  workspaceRoot: string,
  relativePath: string
): Promise<boolean> {
  try {
    await readFile(resolveWorkspacePath(workspaceRoot, relativePath), "utf8");
    return true;
  } catch {
    return false;
  }
}

async function saveJson(
  workspaceRoot: string,
  relativePath: string,
  data: unknown,
  options: { pretty?: boolean } = {}
): Promise<void> {
  const absolutePath = resolveWorkspacePath(workspaceRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const serialized = options.pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
  await writeFile(absolutePath, `${serialized}\n`, "utf8");
}

function resolveWorkspacePath(workspaceRoot: string, relativePath: string): string {
  return path.resolve(workspaceRoot, relativePath);
}

function scannerKey(value: string): string {
  const lower = value.replaceAll("\\", "/").toLowerCase();
  const texturesAt = lower.indexOf("textures/");
  return texturesAt >= 0 ? lower.slice(texturesAt) : lower;
}
