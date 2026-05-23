import { readFile } from "node:fs/promises";
import path from "node:path";

export type RasterAssetSource = {
  absolutePath: string;
  assetId: string;
  height?: number | null;
  width?: number | null;
};

export type AssetResolver = {
  resolveAsset(
    assetId: string
  ): Promise<RasterAssetSource | null> | RasterAssetSource | null;
};

export type AssetManifestResolverOptions = {
  groupsPath?: string;
  manifestPath?: string;
  outputRoot?: string;
  sourceRoot?: string;
};

type AssetManifestEntry = {
  height?: unknown;
  id?: unknown;
  relativePath?: unknown;
  width?: unknown;
};

type AssetManifest = {
  assets?: unknown;
  sourceRoot?: unknown;
};

type AssetGroupEntry = {
  assetIds?: unknown;
  id?: unknown;
  representativeAssetId?: unknown;
};

type AssetGroupsManifest = {
  groups?: unknown;
};

type ResolverIndex = {
  byId: Map<string, RasterAssetSource>;
  groupAlias: Map<string, string>;
};

const DEFAULT_DATA_DIRECTORY = "data";
const DEFAULT_MANIFEST_PATH = path.join("indexes", "assets.manifest.json");
const DEFAULT_GROUPS_PATH = path.join("indexes", "asset-groups.json");

export function createAssetManifestResolver(
  options: AssetManifestResolverOptions = {}
): AssetResolver {
  let loaded: Promise<ResolverIndex> | null = null;

  return {
    async resolveAsset(assetId: string): Promise<RasterAssetSource | null> {
      loaded ??= loadResolverIndex(options);
      const { byId, groupAlias } = await loaded;

      const direct = byId.get(assetId);
      if (direct) {
        return direct;
      }

      // Generated maps reference asset *groups* (so a DM can swap the member
      // used). Resolve a group id to its representative member, then to a file.
      const alias = groupAlias.get(assetId);
      return alias ? (byId.get(alias) ?? null) : null;
    }
  };
}

async function loadResolverIndex(
  options: AssetManifestResolverOptions
): Promise<ResolverIndex> {
  const outputRoot = options.outputRoot
    ? path.resolve(options.outputRoot)
    : path.join(process.cwd(), DEFAULT_DATA_DIRECTORY);
  const [byId, groupAlias] = await Promise.all([
    loadManifestAssets(options, outputRoot),
    loadGroupAliases(options, outputRoot)
  ]);
  return { byId, groupAlias };
}

async function loadManifestAssets(
  options: AssetManifestResolverOptions,
  outputRoot: string
): Promise<Map<string, RasterAssetSource>> {
  const manifestPath = options.manifestPath
    ? path.resolve(outputRoot, options.manifestPath)
    : path.join(outputRoot, DEFAULT_MANIFEST_PATH);
  const raw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw) as AssetManifest;
  const sourceRoot =
    readString(options.sourceRoot) ||
    readString(manifest.sourceRoot) ||
    path.dirname(manifestPath);
  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  const byId = new Map<string, RasterAssetSource>();

  for (const item of assets) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const entry = item as AssetManifestEntry;
    const assetId = readString(entry.id);
    const relativePath = readString(entry.relativePath);

    if (!assetId || !relativePath) {
      continue;
    }

    byId.set(assetId, {
      absolutePath: path.isAbsolute(relativePath)
        ? relativePath
        : path.resolve(sourceRoot, relativePath),
      assetId,
      height: readPositiveNumber(entry.height),
      width: readPositiveNumber(entry.width)
    });
  }

  return byId;
}

async function loadGroupAliases(
  options: AssetManifestResolverOptions,
  outputRoot: string
): Promise<Map<string, string>> {
  const groupsPath = options.groupsPath
    ? path.resolve(outputRoot, options.groupsPath)
    : path.join(outputRoot, DEFAULT_GROUPS_PATH);
  const aliases = new Map<string, string>();

  let raw: string;
  try {
    raw = await readFile(groupsPath, "utf8");
  } catch {
    // Groups are optional: without them only direct asset ids resolve.
    return aliases;
  }

  const manifest = JSON.parse(raw) as AssetGroupsManifest;
  const groups = Array.isArray(manifest.groups) ? manifest.groups : [];

  for (const item of groups) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const group = item as AssetGroupEntry;
    const id = readString(group.id);
    const representative =
      readString(group.representativeAssetId) ||
      (Array.isArray(group.assetIds) ? readString(group.assetIds[0]) : "");

    if (id && representative) {
      aliases.set(id, representative);
    }
  }

  return aliases;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}
