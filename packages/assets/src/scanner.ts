import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  ASSET_CLASSIFICATIONS,
  classifyAsset,
  type AssetClassification,
  type AssetClassificationSource,
  type AssetOverride
} from "./classifier";
import { enrichAssetWithAuditFields, findDuplicateGroups, type AssetQualitySignals, type ReviewPriority } from "./audit";

export const SUPPORTED_ASSET_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "svg"] as const;

export type SupportedAssetExtension = (typeof SUPPORTED_ASSET_EXTENSIONS)[number];

export type DominantColor = {
  hex: string;
  population: number;
};

export type AssetManifestEntry = {
  classification: AssetClassification;
  classificationSource: AssetClassificationSource;
  confidence: number;
  dominantColors: DominantColor[];
  duplicateConfidence?: number | null;
  duplicateGroupId?: string | null;
  extension: SupportedAssetExtension;
  fileHash: string;
  hasTransparency: boolean | null;
  height: number | null;
  id: string;
  qualityScore?: number;
  qualitySignals?: AssetQualitySignals;
  relativePath: string;
  reviewPriority?: ReviewPriority;
  tags: string[];
  thumbnailPath: string | null;
  visualHash?: string;
  width: number | null;
};

export type AssetScanError = {
  message: string;
  relativePath: string;
};

export type AssetManifest = {
  assets: AssetManifestEntry[];
  errors: AssetScanError[];
  generatedAt: string;
  sourceRoot: string;
  version: 1;
};

export type AssetScannerOptions = {
  manifestPath?: string;
  outputRoot?: string;
  overridesPath?: string;
  previewDir?: string;
  thumbnailSize?: number;
};

const DEFAULT_DATA_DIRECTORY = "data";
const DEFAULT_INDEX_DIRECTORY = "indexes";
const DEFAULT_PREVIEW_DIRECTORY = "previews";
const DEFAULT_ASSET_PREVIEW_DIRECTORY = "assets";
const DEFAULT_MANIFEST_FILE = "assets.manifest.json";
const DEFAULT_OVERRIDES_FILE = "asset-overrides.json";

export async function scanAssets(folder: string, options: AssetScannerOptions = {}): Promise<AssetManifest> {
  const sourceRoot = path.resolve(folder);
  const outputRoot = resolveOutputRoot(options.outputRoot);
  const indexRoot = resolveIndexRoot(options.outputRoot);
  const manifestPath = options.manifestPath
    ? path.resolve(outputRoot, options.manifestPath)
    : path.join(indexRoot, DEFAULT_MANIFEST_FILE);
  const overridesPath = options.overridesPath
    ? path.resolve(outputRoot, options.overridesPath)
    : path.join(indexRoot, DEFAULT_OVERRIDES_FILE);
  const previewDir = options.previewDir
    ? path.resolve(outputRoot, options.previewDir)
    : resolvePreviewDirectory(options.outputRoot, outputRoot);
  const thumbnailSize = options.thumbnailSize ?? 128;

  const files = await findAssetFiles(sourceRoot);
  const overrides = await readAssetOverrides(overridesPath);
  const assets: AssetManifestEntry[] = [];
  const errors: AssetScanError[] = [];

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await mkdir(previewDir, { recursive: true });

  for (const filePath of files) {
    const relativePath = toPosixPath(path.relative(sourceRoot, filePath));

    try {
      const asset = await inspectAsset({
        filePath,
        outputRoot,
        overrides,
        previewDir,
        relativePath,
        thumbnailSize
      });
      assets.push(asset);
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : "Unknown asset scan error.",
        relativePath
      });
    }
  }

  const duplicateLookup = createDuplicateLookup(findDuplicateGroups(assets));
  const enrichedAssets = assets.map((asset) =>
    enrichAssetWithAuditFields(asset, duplicateLookup) as AssetManifestEntry
  );

  const manifest: AssetManifest = {
    assets: enrichedAssets,
    errors,
    generatedAt: new Date().toISOString(),
    sourceRoot,
    version: 1
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return manifest;
}

export type ScanSingleAssetOptions = {
  outputRoot?: string;
  overridesPath?: string;
  previewDir?: string;
  sourceRoot: string;
  thumbnailSize?: number;
};

export async function scanSingleAsset(
  filePath: string,
  options: ScanSingleAssetOptions
): Promise<AssetManifestEntry> {
  const sourceRoot = path.resolve(options.sourceRoot);
  const outputRoot = resolveOutputRoot(options.outputRoot);
  const indexRoot = resolveIndexRoot(options.outputRoot);
  const overridesPath = options.overridesPath
    ? path.resolve(outputRoot, options.overridesPath)
    : path.join(indexRoot, DEFAULT_OVERRIDES_FILE);
  const previewDir = options.previewDir
    ? path.resolve(outputRoot, options.previewDir)
    : resolvePreviewDirectory(options.outputRoot, outputRoot);
  const thumbnailSize = options.thumbnailSize ?? 128;
  const absolutePath = path.resolve(filePath);
  const relativePath = toPosixPath(path.relative(sourceRoot, absolutePath));

  await mkdir(previewDir, { recursive: true });
  const overrides = await readAssetOverrides(overridesPath);

  return inspectAsset({
    filePath: absolutePath,
    outputRoot,
    overrides,
    previewDir,
    relativePath,
    thumbnailSize
  });
}

export type AppendAssetToManifestOptions = {
  manifestPath?: string;
  outputRoot?: string;
};

export type AppendAssetResult = {
  appended: boolean;
  manifest: AssetManifest;
  replaced: boolean;
};

export async function appendAssetToManifest(
  asset: AssetManifestEntry,
  options: AppendAssetToManifestOptions = {}
): Promise<AppendAssetResult> {
  const outputRoot = resolveOutputRoot(options.outputRoot);
  const indexRoot = resolveIndexRoot(options.outputRoot);
  const manifestPath = options.manifestPath
    ? path.resolve(outputRoot, options.manifestPath)
    : path.join(indexRoot, DEFAULT_MANIFEST_FILE);
  let existing: AssetManifest | null = null;

  try {
    const raw = await readFile(manifestPath, "utf8");
    existing = JSON.parse(raw) as AssetManifest;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  const baseManifest: AssetManifest = existing ?? {
    assets: [],
    errors: [],
    generatedAt: new Date().toISOString(),
    sourceRoot: outputRoot,
    version: 1
  };
  const existingIndex = baseManifest.assets.findIndex(
    (entry) => entry.id === asset.id || entry.relativePath === asset.relativePath
  );
  const nextAssets = [...baseManifest.assets];

  let replaced = false;

  if (existingIndex >= 0) {
    nextAssets[existingIndex] = asset;
    replaced = true;
  } else {
    nextAssets.push(asset);
  }

  const duplicateLookup = createDuplicateLookup(findDuplicateGroups(nextAssets));
  const enriched = nextAssets.map((entry) =>
    enrichAssetWithAuditFields(entry, duplicateLookup) as AssetManifestEntry
  );
  const manifest: AssetManifest = {
    ...baseManifest,
    assets: enriched,
    generatedAt: new Date().toISOString()
  };

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { appended: !replaced, manifest, replaced };
}

function createDuplicateLookup(
  duplicateGroups: ReturnType<typeof findDuplicateGroups>
): Map<string, { confidence: number; id: string }> {
  const lookup = new Map<string, { confidence: number; id: string }>();

  for (const group of duplicateGroups) {
    for (const assetId of group.assetIds) {
      lookup.set(assetId, { confidence: group.confidence, id: group.id });
    }
  }

  return lookup;
}

function resolveOutputRoot(outputRoot?: string): string {
  return outputRoot ? path.resolve(outputRoot) : path.join(process.cwd(), DEFAULT_DATA_DIRECTORY);
}

function resolveIndexRoot(outputRoot?: string): string {
  return outputRoot
    ? path.resolve(outputRoot, DEFAULT_DATA_DIRECTORY, DEFAULT_INDEX_DIRECTORY)
    : path.join(process.cwd(), DEFAULT_DATA_DIRECTORY, DEFAULT_INDEX_DIRECTORY);
}

function resolvePreviewDirectory(outputRoot: string | undefined, resolvedOutputRoot: string): string {
  return outputRoot
    ? path.resolve(
        resolvedOutputRoot,
        DEFAULT_DATA_DIRECTORY,
        DEFAULT_PREVIEW_DIRECTORY,
        DEFAULT_ASSET_PREVIEW_DIRECTORY
      )
    : path.resolve(resolvedOutputRoot, DEFAULT_PREVIEW_DIRECTORY, DEFAULT_ASSET_PREVIEW_DIRECTORY);
}

async function inspectAsset(input: {
  filePath: string;
  outputRoot: string;
  overrides: AssetOverrides;
  previewDir: string;
  relativePath: string;
  thumbnailSize: number;
}): Promise<AssetManifestEntry> {
  const extension = getSupportedExtension(input.filePath);
  const file = await readFile(input.filePath);
  const fileHash = createHash("sha256").update(file).digest("hex");
  const id = createAssetId(input.relativePath, fileHash);
  const image = sharp(input.filePath, { limitInputPixels: false });
  const metadata = await image.metadata();
  const thumbnailPath = path.join(input.previewDir, `${id}.webp`);
  const dominantColors = await extractDominantColors(input.filePath);
  const hasTransparency = await detectTransparency(input.filePath, metadata.hasAlpha);
  const classification = classifyAsset(
    {
      hasTransparency,
      height: metadata.height ?? null,
      relativePath: input.relativePath,
      width: metadata.width ?? null
    },
    input.overrides[id] ?? input.overrides[input.relativePath]
  );

  await sharp(input.filePath, { limitInputPixels: false })
    .resize(input.thumbnailSize, input.thumbnailSize, {
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: 82 })
    .toFile(thumbnailPath);

  return {
    classification: classification.classification,
    classificationSource: classification.classificationSource,
    confidence: classification.confidence,
    dominantColors,
    extension,
    fileHash,
    hasTransparency,
    height: metadata.height ?? null,
    id,
    relativePath: input.relativePath,
    tags: classification.tags,
    thumbnailPath: toPosixPath(path.relative(input.outputRoot, thumbnailPath)),
    width: metadata.width ?? null
  };
}

type AssetOverrides = Record<string, AssetOverride>;

async function readAssetOverrides(overridesPath: string): Promise<AssetOverrides> {
  try {
    const raw = await readFile(overridesPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return normalizeOverrides(parsed);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

function normalizeOverrides(parsed: unknown): AssetOverrides {
  if (!parsed || typeof parsed !== "object") {
    return {};
  }

  const candidate = parsed as { overrides?: unknown };
  const overrides = candidate.overrides && typeof candidate.overrides === "object" ? candidate.overrides : parsed;
  const normalized: AssetOverrides = {};

  for (const [assetKey, override] of Object.entries(overrides as Record<string, unknown>)) {
    const normalizedOverride = normalizeOverride(override);

    if (normalizedOverride) {
      normalized[assetKey] = normalizedOverride;
    }
  }

  return normalized;
}

function normalizeOverride(override: unknown): AssetOverride | null {
  if (!override || typeof override !== "object") {
    return null;
  }

  const input = override as {
    classification?: unknown;
    confidence?: unknown;
    tags?: unknown;
  };
  const normalized: AssetOverride = {};

  if (
    typeof input.classification === "string" &&
    ASSET_CLASSIFICATIONS.includes(input.classification as AssetClassification)
  ) {
    normalized.classification = input.classification as AssetClassification;
  }

  if (typeof input.confidence === "number") {
    normalized.confidence = input.confidence;
  }

  if (Array.isArray(input.tags)) {
    normalized.tags = input.tags.filter((tag): tag is string => typeof tag === "string");
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

async function findAssetFiles(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(folder, entry.name);

      if (entry.isDirectory()) {
        return findAssetFiles(entryPath);
      }

      if (entry.isFile() && isSupportedAsset(entry.name)) {
        return [entryPath];
      }

      return [];
    })
  );

  return files.flat().sort((a, b) => toPosixPath(a).localeCompare(toPosixPath(b)));
}

async function extractDominantColors(filePath: string): Promise<DominantColor[]> {
  const { data } = await sharp(filePath, { limitInputPixels: false })
    .resize(32, 32, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const counts = new Map<string, number>();

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] ?? 0;

    if (alpha < 16) {
      continue;
    }

    const red = quantizeColor(data[index] ?? 0);
    const green = quantizeColor(data[index + 1] ?? 0);
    const blue = quantizeColor(data[index + 2] ?? 0);
    const hex = toHexColor(red, green, blue);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([hex, population]) => ({ hex, population }))
    .sort((left, right) => right.population - left.population || left.hex.localeCompare(right.hex))
    .slice(0, 5);
}

async function detectTransparency(filePath: string, hasAlpha?: boolean): Promise<boolean | null> {
  if (hasAlpha === false) {
    return false;
  }

  if (hasAlpha !== true) {
    return null;
  }

  const { data } = await sharp(filePath, { limitInputPixels: false })
    .resize(64, 64, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 3; index < data.length; index += 4) {
    if ((data[index] ?? 255) < 255) {
      return true;
    }
  }

  return false;
}

function createAssetId(relativePath: string, fileHash: string): string {
  const pathHash = createHash("sha256").update(relativePath).digest("hex");
  return `asset_${fileHash.slice(0, 12)}_${pathHash.slice(0, 8)}`;
}

function getSupportedExtension(filePath: string): SupportedAssetExtension {
  const extension = path.extname(filePath).slice(1).toLowerCase();

  if (SUPPORTED_ASSET_EXTENSIONS.includes(extension as SupportedAssetExtension)) {
    return extension as SupportedAssetExtension;
  }

  throw new Error(`Unsupported asset extension: ${extension}`);
}

function isSupportedAsset(fileName: string): boolean {
  const extension = path.extname(fileName).slice(1).toLowerCase();
  return SUPPORTED_ASSET_EXTENSIONS.includes(extension as SupportedAssetExtension);
}

function quantizeColor(value: number): number {
  return Math.min(255, Math.round(value / 32) * 32);
}

function toHexColor(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
