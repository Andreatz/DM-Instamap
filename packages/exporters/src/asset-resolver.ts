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

const DEFAULT_DATA_DIRECTORY = "data";
const DEFAULT_MANIFEST_PATH = path.join("indexes", "assets.manifest.json");

export function createAssetManifestResolver(
  options: AssetManifestResolverOptions = {}
): AssetResolver {
  let loaded: Promise<Map<string, RasterAssetSource>> | null = null;

  return {
    async resolveAsset(assetId: string): Promise<RasterAssetSource | null> {
      loaded ??= loadManifestAssets(options);
      const assets = await loaded;
      return assets.get(assetId) ?? null;
    }
  };
}

async function loadManifestAssets(
  options: AssetManifestResolverOptions
): Promise<Map<string, RasterAssetSource>> {
  const outputRoot = options.outputRoot
    ? path.resolve(options.outputRoot)
    : path.join(process.cwd(), DEFAULT_DATA_DIRECTORY);
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

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}
