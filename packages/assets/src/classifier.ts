import path from "node:path";

export const ASSET_CLASSIFICATIONS = [
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
] as const;

export type AssetClassification = (typeof ASSET_CLASSIFICATIONS)[number];

export type AssetClassificationSource = "automatic" | "manual";

export type AssetClassificationResult = {
  classification: AssetClassification;
  classificationSource: AssetClassificationSource;
  confidence: number;
  tags: string[];
};

export type AssetClassifierInput = {
  hasTransparency: boolean | null;
  height: number | null;
  relativePath: string;
  width: number | null;
};

export type AssetOverride = Partial<{
  classification: AssetClassification;
  confidence: number;
  tags: string[];
}>;

const KEYWORDS: Record<Exclude<AssetClassification, "unknown">, string[]> = {
  decoration: ["banner", "banners", "carpet", "decor", "decoration", "ornament", "painting", "rubble", "statue"],
  door: ["door", "doors", "gate", "gates", "hatch", "portcullis"],
  floor: ["cobble", "floor", "floors", "ground", "mosaic", "parquet", "stonefloor", "tile", "tiles"],
  furniture: [
    "barrel",
    "bed",
    "bench",
    "bookshelf",
    "cabinet",
    "chair",
    "chest",
    "crate",
    "desk",
    "shelf",
    "table",
    "throne"
  ],
  light: ["brazier", "candle", "fire", "lamp", "lantern", "light", "lights", "sconce", "torch"],
  prop: ["asset", "item", "object", "objects", "prop", "props", "token", "tokens"],
  roof: ["roof", "roofs", "shingle", "thatch", "tile-roof"],
  terrain: ["boulder", "bush", "cliff", "grass", "hill", "mud", "rock", "rocks", "sand", "terrain", "tree", "trees"],
  wall: ["barrier", "fence", "palisade", "wall", "walls"],
  water: ["creek", "lake", "pond", "river", "sea", "stream", "water", "waterfall"],
  window: ["glass", "shutter", "window", "windows"]
};

const FOLDER_WEIGHT = 0.34;
const FILE_WEIGHT = 0.44;

export function classifyAsset(
  input: AssetClassifierInput,
  override?: AssetOverride
): AssetClassificationResult {
  const automaticTags = createAutomaticTags(input.relativePath);
  const automatic = classifyAutomatically(input, automaticTags);

  if (!override) {
    return automatic;
  }

  return {
    classification: override.classification ?? automatic.classification,
    classificationSource: "manual",
    confidence: clampConfidence(override.confidence ?? 1),
    tags: normalizeTags(override.tags ?? automatic.tags)
  };
}

export function createAutomaticTags(relativePath: string): string[] {
  return normalizeTags(tokenizeRelativePath(relativePath).all);
}

function classifyAutomatically(
  input: AssetClassifierInput,
  tags: string[]
): AssetClassificationResult {
  const scores = new Map<AssetClassification, number>();
  const pathTokens = tokenizeRelativePath(input.relativePath);

  for (const classification of ASSET_CLASSIFICATIONS) {
    scores.set(classification, classification === "unknown" ? 0.05 : 0);
  }

  for (const [classification, keywords] of Object.entries(KEYWORDS) as Array<
    [Exclude<AssetClassification, "unknown">, string[]]
  >) {
    for (const keyword of keywords) {
      if (pathTokens.folder.includes(keyword)) {
        addScore(scores, classification, FOLDER_WEIGHT);
      }

      if (pathTokens.file.includes(keyword)) {
        addScore(scores, classification, FILE_WEIGHT);
      }
    }
  }

  applyShapeHeuristics(scores, input);

  const ranked = [...scores.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
  );
  const [classification, rawConfidence] = ranked[0] ?? ["unknown", 0.05];
  const confidence = classification === "unknown" ? 0.1 : clampConfidence(rawConfidence);

  return {
    classification,
    classificationSource: "automatic",
    confidence,
    tags
  };
}

function applyShapeHeuristics(scores: Map<AssetClassification, number>, input: AssetClassifierInput): void {
  if (!input.width || !input.height) {
    return;
  }

  const longest = Math.max(input.width, input.height);
  const shortest = Math.min(input.width, input.height);
  const aspectRatio = longest / shortest;
  const isSquareish = aspectRatio <= 1.15;
  const isLong = aspectRatio >= 3;
  const isSmallObject = input.width <= 384 && input.height <= 384;

  if (isSquareish && input.hasTransparency === false) {
    addScore(scores, "floor", 0.18);
    addScore(scores, "terrain", 0.1);
  }

  if (isLong) {
    addScore(scores, "wall", 0.2);
  }

  if (isLong && input.hasTransparency === true) {
    addScore(scores, "door", 0.14);
    addScore(scores, "window", 0.12);
  }

  if (isSmallObject && input.hasTransparency === true) {
    addScore(scores, "prop", 0.18);
    addScore(scores, "decoration", 0.1);
  }
}

function addScore(
  scores: Map<AssetClassification, number>,
  classification: AssetClassification,
  score: number
): void {
  scores.set(classification, (scores.get(classification) ?? 0) + score);
}

function tokenizeRelativePath(relativePath: string): {
  all: string[];
  file: string[];
  folder: string[];
} {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const parsed = path.posix.parse(normalizedPath);
  const folder = parsed.dir.split("/").flatMap(tokenizeText);
  const file = tokenizeText(parsed.name);

  return {
    all: [...folder, ...file],
    file,
    folder
  };
}

function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.flatMap(tokenizeText))].sort((left, right) => left.localeCompare(right));
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, Number(value.toFixed(2))));
}
