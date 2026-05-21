export type AssetBrowserEntry = {
  classification: string;
  classificationSource: "automatic" | "manual" | "missing";
  confidence: number;
  dominantColors: Array<{
    hex: string;
    population: number;
  }>;
  extension: string;
  fileHash: string;
  hasTransparency: boolean | null;
  height: number | null;
  id: string;
  relativePath: string;
  sourceFolder: string;
  tags: string[];
  thumbnailUrl: string;
  width: number | null;
};

export const ASSET_REVIEW_KINDS = [
  "wall",
  "floor",
  "door",
  "window",
  "prop",
  "furniture",
  "water",
  "light",
  "terrain",
  "roof",
  "decoration",
  "unknown"
] as const;

export const QUICK_REVIEW_KINDS = [
  "wall",
  "floor",
  "door",
  "prop",
  "furniture",
  "light",
  "terrain",
  "unknown"
] as const;

export type ReviewAssetKind = (typeof ASSET_REVIEW_KINDS)[number];

export type AssetFilterState = {
  confidence: number;
  kind: string;
  query: string;
  sourceFolder: string;
  tag: string;
};

export type AssetBrowserOptions = {
  kinds: string[];
  sourceFolders: string[];
  tags: string[];
};

type ManifestAsset = {
  classification?: unknown;
  classificationSource?: unknown;
  confidence?: unknown;
  dominantColors?: unknown;
  extension?: unknown;
  fileHash?: unknown;
  hasTransparency?: unknown;
  height?: unknown;
  id?: unknown;
  relativePath?: unknown;
  tags?: unknown;
  width?: unknown;
};

export function normalizeManifestAssets(assets: ManifestAsset[]): AssetBrowserEntry[] {
  return assets
    .map((asset) => {
      const id = readString(asset.id);
      const relativePath = readString(asset.relativePath);

      if (!id || !relativePath) {
        return null;
      }

      const tags = readStringArray(asset.tags);
      const fallbackTags = createTagsFromPath(relativePath);

      return {
        classification: readString(asset.classification) || "unknown",
        classificationSource: readClassificationSource(asset.classificationSource),
        confidence: readConfidence(asset.confidence),
        dominantColors: readDominantColors(asset.dominantColors),
        extension: readString(asset.extension),
        fileHash: readString(asset.fileHash),
        hasTransparency: readTransparency(asset.hasTransparency),
        height: readNullableNumber(asset.height),
        id,
        relativePath,
        sourceFolder: getSourceFolder(relativePath),
        tags: tags.length > 0 ? tags : fallbackTags,
        thumbnailUrl: `/assets/preview/${encodeURIComponent(id)}`,
        width: readNullableNumber(asset.width)
      };
    })
    .filter((asset): asset is AssetBrowserEntry => asset !== null);
}

export function createAssetBrowserOptions(assets: AssetBrowserEntry[]): AssetBrowserOptions {
  return {
    kinds: uniqueSorted(assets.map((asset) => asset.classification)),
    sourceFolders: uniqueSorted(assets.map((asset) => asset.sourceFolder)),
    tags: uniqueSorted(assets.flatMap((asset) => asset.tags))
  };
}

export function filterAssets(
  assets: AssetBrowserEntry[],
  filters: AssetFilterState
): AssetBrowserEntry[] {
  const query = filters.query.trim().toLowerCase();

  return assets.filter((asset) => {
    if (filters.kind !== "all" && asset.classification !== filters.kind) {
      return false;
    }

    if (filters.tag !== "all" && !asset.tags.includes(filters.tag)) {
      return false;
    }

    if (filters.sourceFolder !== "all" && asset.sourceFolder !== filters.sourceFolder) {
      return false;
    }

    if (asset.confidence < filters.confidence) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchable = [
      asset.id,
      asset.relativePath,
      asset.classification,
      asset.extension,
      ...asset.tags
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  });
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatAssetKind(kind: string): string {
  switch (kind) {
    case "wall":
      return "muro";
    case "floor":
      return "pavimento";
    case "door":
      return "porta";
    case "window":
      return "finestra";
    case "prop":
      return "oggetto";
    case "furniture":
      return "arredo";
    case "water":
      return "acqua";
    case "light":
      return "luce";
    case "terrain":
      return "terreno";
    case "roof":
      return "tetto";
    case "decoration":
      return "decorazione";
    case "unknown":
      return "sconosciuto";
    case "all":
      return "tutti";
    default:
      return kind;
  }
}

export function formatClassificationSource(source: AssetBrowserEntry["classificationSource"]): string {
  switch (source) {
    case "automatic":
      return "automatica";
    case "manual":
      return "manuale";
    case "missing":
    default:
      return "mancante";
  }
}

function getSourceFolder(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/");
  const segments = normalized.split("/").filter(Boolean);

  if (segments.length <= 1) {
    return "(root)";
  }

  return segments.slice(0, -1).join("/");
}

function createTagsFromPath(relativePath: string): string[] {
  return uniqueSorted(
    relativePath
      .replaceAll("\\", "/")
      .replace(/\.[^.]+$/u, "")
      .split(/[^a-zA-Z0-9]+/u)
      .map((tag) => tag.toLowerCase().trim())
      .filter(Boolean)
  );
}

function readClassificationSource(value: unknown): AssetBrowserEntry["classificationSource"] {
  if (value === "automatic" || value === "manual") {
    return value;
  }

  return "missing";
}

function readConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function readDominantColors(value: unknown): AssetBrowserEntry["dominantColors"] {
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

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueSorted(value.filter((item): item is string => typeof item === "string"));
}

function readTransparency(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
