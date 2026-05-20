import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { AssetClassification } from "./classifier";

export type EmbeddingProvider = {
  dimensions: number;
  id: string;
  embedAsset(input: AssetEmbeddingInput): Promise<number[]>;
  embedImage(filePath: string): Promise<number[]>;
  embedText(text: string): Promise<number[]>;
};

export type AssetEmbeddingInput = {
  dominantColors?: Array<{
    hex: string;
    population: number;
  }>;
  imagePath: string;
  kind?: string;
  relativePath?: string;
  tags?: string[];
};

export type AssetEmbeddingEntry = {
  assetId: string;
  dimensions: number;
  provider: string;
  relativePath: string;
  tags: string[];
  thumbnailPath: string | null;
  vector: number[];
};

export type AssetEmbeddingIndex = {
  dimensions: number;
  generatedAt: string;
  provider: string;
  sourceManifest: string;
  vectors: AssetEmbeddingEntry[];
  version: 1;
};

export type AssetEmbeddingOptions = {
  embeddingsPath?: string;
  manifestPath?: string;
  outputRoot?: string;
  provider?: EmbeddingProvider;
};

export type AssetSearchResult = {
  assetId: string;
  reason: string;
  relativePath: string;
  score: number;
  tags: string[];
};

export type AssetTextSearchOptions = {
  embeddingsPath?: string;
  limit?: number;
  outputRoot?: string;
  provider?: EmbeddingProvider;
  query: string;
};

export type AssetImageSearchOptions = {
  embeddingsPath?: string;
  imagePath: string;
  limit?: number;
  outputRoot?: string;
  provider?: EmbeddingProvider;
};

export type RemoteEmbeddingProviderConfig = {
  dimensions?: number;
  endpoint: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
  id?: string;
  model?: string;
};

export type ResolvedEmbeddingConfig = {
  apiKey?: string;
  dimensions?: number;
  endpoint?: string;
  model?: string;
  provider: "local" | "remote";
};

type ManifestFile = {
  assets?: unknown;
};

type ManifestAsset = {
  classification?: unknown;
  dominantColors?: unknown;
  id?: unknown;
  relativePath?: unknown;
  tags?: unknown;
  thumbnailPath?: unknown;
};

type NormalizedManifestAsset = {
  classification: string;
  dominantColors: Array<{
    hex: string;
    population: number;
  }>;
  id: string;
  relativePath: string;
  tags: string[];
  thumbnailPath: string | null;
};

const DEFAULT_MANIFEST_PATH = path.join("data", "indexes", "assets.manifest.json");
const DEFAULT_EMBEDDINGS_PATH = path.join("data", "indexes", "asset-embeddings.json");
const LOCAL_PROVIDER_ID = "local-color-layout-v1";
const COLOR_BINS = 12;
const KIND_BINS = 12;
const EXTRA_BINS = 8;
const EMBEDDING_DIMENSIONS = COLOR_BINS + KIND_BINS + EXTRA_BINS;
const KIND_ORDER: AssetClassification[] = [
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
const COLOR_TERMS: Record<string, number> = {
  black: 9,
  blue: 7,
  brown: 2,
  cyan: 7,
  gold: 1,
  gray: 10,
  green: 4,
  grey: 10,
  orange: 1,
  purple: 8,
  red: 0,
  silver: 10,
  stone: 10,
  white: 11,
  yellow: 1
};

export function createRemoteEmbeddingProvider(config: RemoteEmbeddingProviderConfig): EmbeddingProvider {
  if (!config.endpoint) {
    throw new Error("createRemoteEmbeddingProvider: endpoint is required.");
  }

  const fetchImpl = config.fetchImpl ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error("createRemoteEmbeddingProvider: fetch is not available in this runtime.");
  }

  const dimensions = Math.max(1, Math.floor(config.dimensions ?? EMBEDDING_DIMENSIONS));
  const id = config.id ?? `remote:${config.model ?? "default"}`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(config.headers ?? {})
  };

  async function callRemote(body: Record<string, unknown>): Promise<number[]> {
    const response = await fetchImpl(config.endpoint, {
      body: JSON.stringify({ model: config.model, ...body }),
      headers,
      method: "POST"
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "(unable to read response)");
      throw new Error(`Remote embedding request failed (${response.status}): ${errorText}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: unknown }>;
      embedding?: unknown;
    };
    const vector = extractRemoteEmbedding(payload);

    if (vector.length === 0) {
      throw new Error("Remote embedding response did not include a vector.");
    }

    return normalizeVector(padOrTruncate(vector, dimensions));
  }

  return {
    dimensions,
    id,
    async embedAsset(input) {
      return callRemote({
        image: input.imagePath,
        kind: input.kind,
        relativePath: input.relativePath,
        tags: input.tags,
        type: "asset"
      });
    },
    async embedImage(filePath) {
      return callRemote({ image: filePath, type: "image" });
    },
    async embedText(text) {
      return callRemote({ input: text, type: "text" });
    }
  };
}

export function resolveEmbeddingConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ResolvedEmbeddingConfig {
  const provider = (env.EMBEDDINGS_PROVIDER ?? "").trim().toLowerCase();

  if (provider === "remote") {
    const endpoint = (env.EMBEDDINGS_ENDPOINT ?? "").trim();
    const dimensionsRaw = (env.EMBEDDINGS_DIMENSIONS ?? "").trim();
    const dimensions = dimensionsRaw ? Number.parseInt(dimensionsRaw, 10) : undefined;

    return {
      apiKey: (env.EMBEDDINGS_API_KEY ?? "").trim() || undefined,
      dimensions: Number.isFinite(dimensions) ? dimensions : undefined,
      endpoint: endpoint || undefined,
      model: (env.EMBEDDINGS_MODEL ?? "").trim() || undefined,
      provider: "remote"
    };
  }

  return { provider: "local" };
}

export function createEmbeddingProviderFromEnv(env: NodeJS.ProcessEnv = process.env): EmbeddingProvider {
  const config = resolveEmbeddingConfigFromEnv(env);

  if (config.provider === "remote" && config.endpoint) {
    return createRemoteEmbeddingProvider({
      dimensions: config.dimensions,
      endpoint: config.endpoint,
      headers: config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : undefined,
      model: config.model
    });
  }

  return createLocalEmbeddingProvider();
}

function extractRemoteEmbedding(payload: { data?: Array<{ embedding?: unknown }>; embedding?: unknown }): number[] {
  const candidates: unknown[] = [];

  if (Array.isArray(payload.data) && payload.data.length > 0) {
    const first = payload.data[0];

    if (first && typeof first === "object" && "embedding" in first) {
      candidates.push(first.embedding);
    }
  }

  candidates.push(payload.embedding);

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.every((value) => typeof value === "number" && Number.isFinite(value))) {
      return candidate as number[];
    }
  }

  return [];
}

function padOrTruncate(vector: number[], length: number): number[] {
  if (vector.length === length) {
    return vector;
  }

  if (vector.length > length) {
    return vector.slice(0, length);
  }

  const result = vector.slice();

  while (result.length < length) {
    result.push(0);
  }

  return result;
}

export function createLocalEmbeddingProvider(): EmbeddingProvider {
  return {
    dimensions: EMBEDDING_DIMENSIONS,
    id: LOCAL_PROVIDER_ID,
    async embedAsset(input) {
      const visual = await extractImageVector(input.imagePath);
      const metadata = createMetadataVector([
        input.kind ?? "",
        input.relativePath ?? "",
        ...(input.tags ?? []),
        ...(input.dominantColors ?? []).map((color) => color.hex)
      ]);

      return normalizeVector(visual.map((value, index) => value * 0.72 + (metadata[index] ?? 0) * 0.28));
    },
    async embedImage(filePath) {
      return extractImageVector(filePath);
    },
    async embedText(text) {
      return normalizeVector(createMetadataVector([text]));
    }
  };
}

export async function generateAssetEmbeddings(options: AssetEmbeddingOptions = {}): Promise<AssetEmbeddingIndex> {
  const outputRoot = path.resolve(options.outputRoot ?? process.cwd());
  const manifestPath = path.resolve(outputRoot, options.manifestPath ?? DEFAULT_MANIFEST_PATH);
  const embeddingsPath = path.resolve(outputRoot, options.embeddingsPath ?? DEFAULT_EMBEDDINGS_PATH);
  const provider = options.provider ?? createLocalEmbeddingProvider();
  const manifest = parseJsonFile(await readFile(manifestPath, "utf8")) as ManifestFile;
  const assets = Array.isArray(manifest.assets)
    ? manifest.assets.map(normalizeManifestAsset).filter((asset): asset is NormalizedManifestAsset => asset !== null)
    : [];
  const vectors: AssetEmbeddingEntry[] = [];

  for (const asset of assets) {
    if (!asset.thumbnailPath) {
      continue;
    }

    const imagePath = path.resolve(outputRoot, asset.thumbnailPath);
    const vector = await provider.embedAsset({
      dominantColors: asset.dominantColors,
      imagePath,
      kind: asset.classification,
      relativePath: asset.relativePath,
      tags: asset.tags
    });

    vectors.push({
      assetId: asset.id,
      dimensions: provider.dimensions,
      provider: provider.id,
      relativePath: asset.relativePath,
      tags: asset.tags,
      thumbnailPath: asset.thumbnailPath,
      vector
    });
  }

  const index: AssetEmbeddingIndex = {
    dimensions: provider.dimensions,
    generatedAt: new Date().toISOString(),
    provider: provider.id,
    sourceManifest: path.relative(outputRoot, manifestPath).split(path.sep).join("/"),
    vectors,
    version: 1
  };

  await mkdir(path.dirname(embeddingsPath), { recursive: true });
  await writeFile(embeddingsPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  return index;
}

export async function searchAssetsByText(options: AssetTextSearchOptions): Promise<AssetSearchResult[]> {
  const provider = options.provider ?? createLocalEmbeddingProvider();
  const index = await loadAssetEmbeddingIndex(options);

  if (options.query.trim().length === 0) {
    return [];
  }

  if (!index) {
    return searchManifestByText(options);
  }

  const queryVector = await provider.embedText(options.query);
  const queryTokens = tokenize(options.query);

  return rankVectors(index, queryVector, options.limit, (entry) => tokenBoost(entry, queryTokens)).map((result) => ({
    ...result,
    reason: explainAssetSearchResult(result, options.query)
  }));
}

export async function searchAssetsByImage(options: AssetImageSearchOptions): Promise<AssetSearchResult[]> {
  const provider = options.provider ?? createLocalEmbeddingProvider();
  const index = await loadAssetEmbeddingIndex(options);

  if (!index) {
    return [];
  }

  const queryVector = await provider.embedImage(options.imagePath);
  return rankVectors(index, queryVector, options.limit).map((result) => ({
    ...result,
    reason: explainAssetSearchResult(result)
  }));
}

export function explainAssetSearchResult(result: AssetSearchResult, query = ""): string {
  const queryTokens = tokenize(query);
  const resultTokens = new Set(tokenize([result.relativePath, ...result.tags].join(" ")));
  const matchedTokens = queryTokens.filter((token) => resultTokens.has(token));
  const reasons: string[] = [];

  if (matchedTokens.length > 0) {
    reasons.push(`matched ${matchedTokens.slice(0, 4).join(", ")}`);
  }

  if (result.tags.length > 0) {
    reasons.push(`tags ${result.tags.slice(0, 4).join(", ")}`);
  }

  reasons.push(`local score ${Math.round(result.score * 100)}%`);

  return reasons.join("; ");
}

export async function loadAssetEmbeddingIndex(options: {
  embeddingsPath?: string;
  outputRoot?: string;
} = {}): Promise<AssetEmbeddingIndex | null> {
  const outputRoot = path.resolve(options.outputRoot ?? process.cwd());
  const embeddingsPath = path.resolve(outputRoot, options.embeddingsPath ?? DEFAULT_EMBEDDINGS_PATH);

  try {
    return normalizeEmbeddingIndex(parseJsonFile(await readFile(embeddingsPath, "utf8")));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function rankVectors(
  index: AssetEmbeddingIndex,
  queryVector: number[],
  limit = 10,
  boost: (entry: AssetEmbeddingEntry) => number = () => 0
): AssetSearchResult[] {
  return index.vectors
    .map((entry) => ({
      assetId: entry.assetId,
      reason: "",
      relativePath: entry.relativePath,
      score: roundScore(cosineSimilarity(queryVector, entry.vector) + boost(entry)),
      tags: entry.tags
    }))
    .sort((left, right) => right.score - left.score || left.relativePath.localeCompare(right.relativePath))
    .slice(0, Math.max(1, Math.floor(limit)));
}

async function searchManifestByText(options: AssetTextSearchOptions): Promise<AssetSearchResult[]> {
  const outputRoot = path.resolve(options.outputRoot ?? process.cwd());
  const manifestPath = path.resolve(outputRoot, DEFAULT_MANIFEST_PATH);

  try {
    const manifest = parseJsonFile(await readFile(manifestPath, "utf8")) as ManifestFile;
    const assets = Array.isArray(manifest.assets)
      ? manifest.assets.map(normalizeManifestAsset).filter((asset): asset is NormalizedManifestAsset => asset !== null)
      : [];
    const queryTokens = tokenize(options.query);

    return assets
      .map((asset) => {
        const assetTokens = new Set(tokenize([asset.classification, asset.relativePath, ...asset.tags].join(" ")));
        const matchCount = queryTokens.filter((token) => assetTokens.has(token)).length;
        const fuzzyCount = queryTokens.filter((token) =>
          [...assetTokens].some((assetToken) => assetToken.includes(token) || token.includes(assetToken))
        ).length;
        const score = queryTokens.length === 0 ? 0 : Math.min(1, (matchCount + fuzzyCount * 0.35) / queryTokens.length);
        const result: AssetSearchResult = {
          assetId: asset.id,
          reason: "",
          relativePath: asset.relativePath,
          score: roundScore(score),
          tags: asset.tags
        };

        return {
          ...result,
          reason: explainAssetSearchResult(result, options.query)
        };
      })
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score || left.relativePath.localeCompare(right.relativePath))
      .slice(0, Math.max(1, Math.floor(options.limit ?? 10)));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function extractImageVector(filePath: string): Promise<number[]> {
  const { data, info } = await sharp(filePath, { limitInputPixels: false })
    .resize(32, 32, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0) as number[];
  let opaquePixels = 0;
  let alphaSum = 0;
  let brightnessSum = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = (data[index + 3] ?? 0) / 255;

    if (alpha < 0.05) {
      continue;
    }

    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const colorBin = classifyColorBin(red, green, blue);

    addVectorValue(vector, colorBin, alpha);
    opaquePixels += 1;
    alphaSum += alpha;
    brightnessSum += ((red + green + blue) / 3 / 255) * alpha;
  }

  const totalPixels = Math.max(1, info.width * info.height);
  vector[COLOR_BINS + KIND_BINS] = opaquePixels / totalPixels;
  vector[COLOR_BINS + KIND_BINS + 1] = alphaSum / totalPixels;
  vector[COLOR_BINS + KIND_BINS + 2] = brightnessSum / Math.max(1, opaquePixels);
  vector[COLOR_BINS + KIND_BINS + 3] = info.width >= info.height ? 1 : 0;
  vector[COLOR_BINS + KIND_BINS + 4] = info.height > info.width ? 1 : 0;
  vector[COLOR_BINS + KIND_BINS + 5] = Math.min(1, Math.max(info.width, info.height) / Math.max(1, Math.min(info.width, info.height)) / 4);

  return normalizeVector(vector);
}

function createMetadataVector(values: string[]): number[] {
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0) as number[];
  const tokens = tokenize(values.join(" "));

  for (const token of tokens) {
    const kindIndex = KIND_ORDER.indexOf(token as AssetClassification);

    if (kindIndex >= 0) {
      addVectorValue(vector, COLOR_BINS + kindIndex, 1);
    }

    const colorIndex = COLOR_TERMS[token];

    if (colorIndex !== undefined) {
      addVectorValue(vector, colorIndex, 1);
    }

    addVectorValue(vector, COLOR_BINS + KIND_BINS + 6 + stableTokenBucket(token), 0.25);
  }

  return normalizeVector(vector);
}

function normalizeManifestAsset(asset: unknown): NormalizedManifestAsset | null {
  if (!asset || typeof asset !== "object") {
    return null;
  }

  const input = asset as ManifestAsset;
  const id = readString(input.id);
  const relativePath = readString(input.relativePath);

  if (!id || !relativePath) {
    return null;
  }

  return {
    classification: readString(input.classification),
    dominantColors: readDominantColors(input.dominantColors),
    id,
    relativePath,
    tags: readStringArray(input.tags),
    thumbnailPath: readString(input.thumbnailPath) || null
  };
}

function addVectorValue(vector: number[], index: number, value: number): void {
  vector[index] = (vector[index] ?? 0) + value;
}

function normalizeEmbeddingIndex(value: unknown): AssetEmbeddingIndex {
  if (!value || typeof value !== "object") {
    return {
      dimensions: EMBEDDING_DIMENSIONS,
      generatedAt: "",
      provider: LOCAL_PROVIDER_ID,
      sourceManifest: "",
      vectors: [],
      version: 1
    };
  }

  const input = value as Partial<AssetEmbeddingIndex>;
  const vectors = Array.isArray(input.vectors)
    ? input.vectors.filter((entry): entry is AssetEmbeddingEntry => isEmbeddingEntry(entry))
    : [];

  return {
    dimensions: typeof input.dimensions === "number" ? input.dimensions : EMBEDDING_DIMENSIONS,
    generatedAt: typeof input.generatedAt === "string" ? input.generatedAt : "",
    provider: typeof input.provider === "string" ? input.provider : LOCAL_PROVIDER_ID,
    sourceManifest: typeof input.sourceManifest === "string" ? input.sourceManifest : "",
    vectors,
    version: 1
  };
}

function isEmbeddingEntry(value: unknown): value is AssetEmbeddingEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<AssetEmbeddingEntry>;
  return (
    typeof entry.assetId === "string" &&
    typeof entry.relativePath === "string" &&
    Array.isArray(entry.vector) &&
    entry.vector.every((part) => typeof part === "number" && Number.isFinite(part))
  );
}

function readDominantColors(value: unknown): Array<{ hex: string; population: number }> {
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
      const population = typeof candidate.population === "number" ? candidate.population : 0;

      return hex ? { hex, population } : null;
    })
    .filter((color): color is { hex: string; population: number } => color !== null);
}

function classifyColorBin(red: number, green: number, blue: number): number {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const brightness = (red + green + blue) / 3;

  if (brightness > 225) {
    return 11;
  }

  if (brightness < 40) {
    return 9;
  }

  if (max - min < 28) {
    return 10;
  }

  if (red >= max && green > blue * 1.25) {
    return 1;
  }

  if (red >= max && blue > green * 1.1) {
    return 8;
  }

  if (red >= max) {
    return 0;
  }

  if (green >= max && red > blue * 1.1) {
    return 3;
  }

  if (green >= max) {
    return 4;
  }

  if (blue >= max && green > red * 1.1) {
    return 7;
  }

  return 6;
}

function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < length; index += 1) {
    dot += (left[index] ?? 0) * (right[index] ?? 0);
    leftMagnitude += (left[index] ?? 0) ** 2;
    rightMagnitude += (right[index] ?? 0) ** 2;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0));

  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function tokenBoost(entry: AssetEmbeddingEntry, queryTokens: string[]): number {
  const entryTokens = new Set(tokenize([entry.relativePath, ...entry.tags].join(" ")));
  const matches = queryTokens.filter((token) => entryTokens.has(token)).length;
  return Math.min(0.25, matches * 0.05);
}

function stableTokenBucket(token: string): number {
  let hash = 0;

  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }

  return hash % 2;
}

function roundScore(value: number): number {
  return Number(Math.max(0, value).toFixed(4));
}

function parseJsonFile(content: string): unknown {
  return JSON.parse(content.charCodeAt(0) === 0xfeff ? content.slice(1) : content);
}

function tokenize(value: string): string[] {
  return [
    ...new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9#]+/u)
        .map((token) => token.trim())
        .filter(Boolean)
    )
  ];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
