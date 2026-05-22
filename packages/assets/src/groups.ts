import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  classifyAsset,
  createAutomaticTags,
  type AssetClassification
} from "./classifier";

export type AssetGroupEntry = {
  assetCount: number;
  assetIds: string[];
  id: string;
  kind: AssetClassification;
  name: string;
  qualityScore: number | null;
  representativeAssetId: string;
  representativeThumbnail: string | null;
  sourceFolders: string[];
  tags: string[];
  theme: string | null;
  themes: string[];
  usableFor: string[];
};

export type AssetGroupsFile = {
  generatedAt: string;
  groupCount: number;
  groups: AssetGroupEntry[];
  sourceManifest: string;
  version: 1;
};

export type AssetGroupOptions = {
  groupsPath?: string;
  manifestPath?: string;
  outputRoot?: string;
  overridesPath?: string;
};

type ManifestFile = {
  assets?: unknown;
};

type ManifestAsset = {
  classification?: unknown;
  confidence?: unknown;
  dominantColors?: unknown;
  hasTransparency?: unknown;
  height?: unknown;
  id?: unknown;
  relativePath?: unknown;
  tags?: unknown;
  thumbnailPath?: unknown;
  width?: unknown;
};

type AssetOverridesFile = {
  overrides?: unknown;
};

type AssetGroupOverride = {
  classification?: unknown;
  qualityScore?: unknown;
  tags?: unknown;
  theme?: unknown;
  usableFor?: unknown;
};

type NormalizedAsset = {
  aspectBucket: string;
  colorBucket: string;
  id: string;
  kind: AssetClassification;
  qualityScore: number | null;
  relativePath: string;
  sourceFolder: string;
  tags: string[];
  theme: string | null;
  thumbnailPath: string | null;
  usableFor: string[];
};

const DEFAULT_GROUPS_PATH = path.join("data", "indexes", "asset-groups.json");
const DEFAULT_MANIFEST_PATH = path.join(
  "data",
  "indexes",
  "assets.manifest.json"
);
const DEFAULT_OVERRIDES_PATH = path.join(
  "data",
  "indexes",
  "asset-overrides.json"
);
const GROUP_TAG_LIMIT = 8;

export async function groupAssets(
  options: AssetGroupOptions = {}
): Promise<AssetGroupsFile> {
  const outputRoot = path.resolve(options.outputRoot ?? process.cwd());
  const manifestPath = path.resolve(
    outputRoot,
    options.manifestPath ?? DEFAULT_MANIFEST_PATH
  );
  const groupsPath = path.resolve(
    outputRoot,
    options.groupsPath ?? DEFAULT_GROUPS_PATH
  );
  const overridesPath = path.resolve(
    outputRoot,
    options.overridesPath ?? DEFAULT_OVERRIDES_PATH
  );
  const manifest = parseJsonFile(
    await readFile(manifestPath, "utf8")
  ) as ManifestFile;
  const overrides = await readAssetOverrides(overridesPath);
  const assets = Array.isArray(manifest.assets)
    ? manifest.assets
        .map((asset) => normalizeAsset(asset, overrides))
        .filter((asset): asset is NormalizedAsset => asset !== null)
    : [];
  const grouped = new Map<string, NormalizedAsset[]>();

  for (const asset of assets) {
    const key = createGroupKey(asset);
    const group = grouped.get(key) ?? [];
    group.push(asset);
    grouped.set(key, group);
  }

  const groups = [...grouped.entries()]
    .map(([key, groupAssetsForKey]) => createAssetGroup(key, groupAssetsForKey))
    .sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.name.localeCompare(right.name)
    );
  const groupsFile: AssetGroupsFile = {
    generatedAt: new Date().toISOString(),
    groupCount: groups.length,
    groups,
    sourceManifest: path
      .relative(outputRoot, manifestPath)
      .split(path.sep)
      .join("/"),
    version: 1
  };

  await mkdir(path.dirname(groupsPath), { recursive: true });
  await writeFile(
    groupsPath,
    `${JSON.stringify(groupsFile, null, 2)}\n`,
    "utf8"
  );

  return groupsFile;
}

function normalizeAsset(
  asset: unknown,
  overrides: Map<string, AssetGroupOverride>
): NormalizedAsset | null {
  if (!asset || typeof asset !== "object") {
    return null;
  }

  const input = asset as ManifestAsset;
  const id = readString(input.id);
  const relativePath = readString(input.relativePath);

  if (!id || !relativePath) {
    return null;
  }

  const width = readNullableNumber(input.width);
  const height = readNullableNumber(input.height);
  const hasTransparency =
    typeof input.hasTransparency === "boolean" ? input.hasTransparency : null;
  const override = overrides.get(id);
  const tags = normalizeTags(readStringArray(override?.tags ?? input.tags));
  const fallbackClassification = classifyAsset({
    hasTransparency,
    height,
    relativePath,
    width
  }).classification;
  const confidence = readNullableNumber(input.confidence);
  const overrideClassification = normalizeClassification(
    readString(override?.classification)
  );
  const qualityScore =
    readQualityScore(override?.qualityScore) ??
    (confidence === null ? null : Math.round(confidence * 100));

  return {
    aspectBucket: createAspectBucket(width, height),
    colorBucket: createColorBucket(input.dominantColors),
    id,
    kind:
      overrideClassification ??
      normalizeClassification(readString(input.classification)) ??
      fallbackClassification,
    qualityScore,
    relativePath,
    sourceFolder: getSourceFolder(relativePath),
    tags: tags.length > 0 ? tags : createAutomaticTags(relativePath),
    theme: normalizeSingleTag(readString(override?.theme)) || null,
    thumbnailPath: readString(input.thumbnailPath) || null,
    usableFor: normalizeTags(readStringArray(override?.usableFor))
  };
}

function createGroupKey(asset: NormalizedAsset): string {
  const tagKey = selectGroupingTags(asset.tags).join("+") || "untagged";
  return [
    asset.kind,
    normalizeGroupPart(asset.sourceFolder),
    tagKey,
    asset.aspectBucket,
    asset.colorBucket
  ].join("|");
}

function createAssetGroup(
  key: string,
  assets: NormalizedAsset[]
): AssetGroupEntry {
  const representative = selectRepresentativeAsset(assets);
  const tags = selectGroupTags(assets);
  const sourceFolders = uniqueSorted(assets.map((asset) => asset.sourceFolder));
  const kind = representative.kind;
  const themes = uniqueSorted(
    assets
      .map((asset) => asset.theme)
      .filter((theme): theme is string => Boolean(theme))
  );
  const usableFor = selectGroupTags(
    assets.map((asset) => ({ ...asset, tags: asset.usableFor }))
  );
  const qualityScores = assets
    .map((asset) => asset.qualityScore)
    .filter((score): score is number => typeof score === "number");

  return {
    assetCount: assets.length,
    assetIds: assets.map((asset) => asset.id).sort(),
    id: `group_${createHash("sha256").update(key).digest("hex").slice(0, 14)}`,
    kind,
    name: createGroupName(kind, tags, sourceFolders[0] ?? "(root)"),
    qualityScore:
      qualityScores.length > 0
        ? Math.round(
            qualityScores.reduce((sum, score) => sum + score, 0) /
              qualityScores.length
          )
        : null,
    representativeAssetId: representative.id,
    representativeThumbnail: representative.thumbnailPath,
    sourceFolders,
    tags,
    theme: themes[0] ?? null,
    themes,
    usableFor
  };
}

function selectRepresentativeAsset(assets: NormalizedAsset[]): NormalizedAsset {
  return [...assets].sort(
    (left, right) =>
      Number(Boolean(right.thumbnailPath)) -
        Number(Boolean(left.thumbnailPath)) ||
      left.relativePath.localeCompare(right.relativePath)
  )[0] as NormalizedAsset;
}

function selectGroupTags(assets: NormalizedAsset[]): string[] {
  const counts = new Map<string, number>();

  for (const asset of assets) {
    for (const tag of asset.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )
    .slice(0, GROUP_TAG_LIMIT)
    .map(([tag]) => tag);
}

function selectGroupingTags(tags: string[]): string[] {
  const ignoredTags = new Set([
    "assets",
    "asset",
    "pack",
    "creator",
    "complete",
    "with",
    "shadows"
  ]);
  return tags.filter((tag) => !ignoredTags.has(tag)).slice(0, 3);
}

function createGroupName(
  kind: AssetClassification,
  tags: string[],
  sourceFolder: string
): string {
  const labelParts = tags.slice(0, 3).map(toTitleCase);

  if (labelParts.length > 0) {
    return `${toTitleCase(kind)} - ${labelParts.join(", ")}`;
  }

  return `${toTitleCase(kind)} - ${toTitleCase(sourceFolder.split("/").at(-1) ?? sourceFolder)}`;
}

function createAspectBucket(
  width: number | null,
  height: number | null
): string {
  if (!width || !height) {
    return "unknown-aspect";
  }

  const ratio = Math.max(width, height) / Math.min(width, height);

  if (ratio <= 1.15) {
    return "square";
  }

  if (ratio >= 3) {
    return "long";
  }

  return width > height ? "wide" : "tall";
}

function createColorBucket(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) {
    return "unknown-color";
  }

  const first = value[0] as { hex?: unknown };
  return typeof first.hex === "string" && first.hex.length >= 4
    ? first.hex.toLowerCase()
    : "unknown-color";
}

function getSourceFolder(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/");
  const segments = normalized.split("/").filter(Boolean);

  if (segments.length <= 1) {
    return "(root)";
  }

  return segments.slice(0, -1).join("/");
}

function normalizeClassification(value: string): AssetClassification | null {
  const known = [
    "floor",
    "wall",
    "door",
    "window",
    "prop",
    "furniture",
    "terrain",
    "water",
    "light",
    "roof",
    "decoration",
    "unknown"
  ];

  return known.includes(value) ? (value as AssetClassification) : null;
}

function normalizeGroupPart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "") || "root"
  );
}

function normalizeTags(tags: string[]): string[] {
  return uniqueSorted(
    tags.flatMap((tag) =>
      tag
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function readAssetOverrides(
  overridesPath: string
): Promise<Map<string, AssetGroupOverride>> {
  try {
    const file = parseJsonFile(
      await readFile(overridesPath, "utf8")
    ) as AssetOverridesFile;
    const overrides = new Map<string, AssetGroupOverride>();

    if (
      !file.overrides ||
      typeof file.overrides !== "object" ||
      Array.isArray(file.overrides)
    ) {
      return overrides;
    }

    for (const [assetId, override] of Object.entries(file.overrides)) {
      if (
        override &&
        typeof override === "object" &&
        !Array.isArray(override)
      ) {
        overrides.set(assetId, override as AssetGroupOverride);
      }
    }

    return overrides;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return new Map();
    }

    throw error;
  }
}

function readQualityScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeSingleTag(value: string): string {
  return normalizeTags([value])[0] ?? "";
}

function parseJsonFile(content: string): unknown {
  return JSON.parse(
    content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
  );
}

function toTitleCase(value: string): string {
  return value
    .replace(/[-_]+/gu, " ")
    .split(/\s+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}
