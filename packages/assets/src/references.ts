import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const SUPPORTED_REFERENCE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp"
] as const;

export type SupportedReferenceExtension =
  (typeof SUPPORTED_REFERENCE_EXTENSIONS)[number];

export type ReferenceMapType =
  | "dungeon"
  | "building"
  | "city"
  | "wilderness"
  | "cave"
  | "coast"
  | "ship"
  | "region"
  | "world"
  | "battlemap"
  | "unknown";

export type ReferenceDominantColor = {
  hex: string;
  population: number;
};

export type ReferenceManifestEntry = {
  dominantColors: ReferenceDominantColor[];
  extension: SupportedReferenceExtension;
  fileHash: string;
  height: number | null;
  id: string;
  mapType: ReferenceMapType;
  mapTypeConfidence: number;
  path: string;
  tags: string[];
  thumbnailPath: string | null;
  width: number | null;
};

export type ReferenceScanError = {
  message: string;
  path: string;
};

export type ReferencesManifest = {
  errors: ReferenceScanError[];
  generatedAt: string;
  references: ReferenceManifestEntry[];
  sourceRoot: string;
  version: 1;
};

export type ReferenceScannerOptions = {
  manifestPath?: string;
  outputRoot?: string;
  previewDir?: string;
  thumbnailSize?: number;
};

const DEFAULT_REFERENCES_MANIFEST_PATH = path.join(
  "data",
  "indexes",
  "references.manifest.json"
);
const DEFAULT_REFERENCES_PREVIEW_DIR = path.join(
  "data",
  "previews",
  "references"
);

const MAP_TYPE_KEYWORDS: Record<
  Exclude<ReferenceMapType, "unknown">,
  string[]
> = {
  battlemap: ["battle", "battlemap", "encounter"],
  building: [
    "building",
    "castle",
    "house",
    "inn",
    "keep",
    "manor",
    "shop",
    "tavern",
    "temple",
    "tower"
  ],
  cave: ["cave", "cavern", "caves", "mine", "underdark"],
  city: [
    "city",
    "district",
    "market",
    "settlement",
    "street",
    "town",
    "urban",
    "village"
  ],
  coast: ["beach", "coast", "harbor", "island", "port", "sea", "shore"],
  dungeon: ["crypt", "dungeon", "lair", "ruin", "sewer", "tomb"],
  region: ["continent", "hex", "kingdom", "province", "region"],
  ship: ["airship", "boat", "ship", "vessel"],
  wilderness: [
    "forest",
    "jungle",
    "mountain",
    "outdoor",
    "swamp",
    "wilderness",
    "woods"
  ],
  world: ["atlas", "realm", "world"]
};

export async function scanReferences(
  folder: string,
  options: ReferenceScannerOptions = {}
): Promise<ReferencesManifest> {
  const sourceRoot = path.resolve(folder);
  const outputRoot = path.resolve(options.outputRoot ?? process.cwd());
  const manifestPath = path.resolve(
    outputRoot,
    options.manifestPath ?? DEFAULT_REFERENCES_MANIFEST_PATH
  );
  const previewDir = path.resolve(
    outputRoot,
    options.previewDir ?? DEFAULT_REFERENCES_PREVIEW_DIR
  );
  const thumbnailSize = options.thumbnailSize ?? 320;
  const files = await findReferenceFiles(sourceRoot);
  const references: ReferenceManifestEntry[] = [];
  const errors: ReferenceScanError[] = [];

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await mkdir(previewDir, { recursive: true });

  for (const filePath of files) {
    const relativePath = toPosixPath(path.relative(sourceRoot, filePath));

    try {
      references.push(
        await inspectReference({
          filePath,
          outputRoot,
          previewDir,
          relativePath,
          thumbnailSize
        })
      );
    } catch (error) {
      errors.push({
        message:
          error instanceof Error
            ? error.message
            : "Unknown reference scan error.",
        path: relativePath
      });
    }
  }

  const manifest: ReferencesManifest = {
    errors,
    generatedAt: new Date().toISOString(),
    references,
    sourceRoot,
    version: 1
  };

  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  return manifest;
}

async function inspectReference(input: {
  filePath: string;
  outputRoot: string;
  previewDir: string;
  relativePath: string;
  thumbnailSize: number;
}): Promise<ReferenceManifestEntry> {
  const extension = getSupportedExtension(input.filePath);
  const file = await readFile(input.filePath);
  const fileHash = createHash("sha256").update(file).digest("hex");
  const id = createReferenceId(input.relativePath, fileHash);
  const metadata = await sharp(input.filePath, {
    limitInputPixels: false
  }).metadata();
  const thumbnailPath = path.join(input.previewDir, `${id}.webp`);
  const mapTypeGuess = guessMapType(input.relativePath);

  await sharp(input.filePath, { limitInputPixels: false })
    .resize(input.thumbnailSize, input.thumbnailSize, {
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: 84 })
    .toFile(thumbnailPath);

  return {
    dominantColors: await extractDominantColors(input.filePath),
    extension,
    fileHash,
    height: metadata.height ?? null,
    id,
    mapType: mapTypeGuess.mapType,
    mapTypeConfidence: mapTypeGuess.confidence,
    path: input.relativePath,
    tags: createTags(input.relativePath),
    thumbnailPath: toPosixPath(path.relative(input.outputRoot, thumbnailPath)),
    width: metadata.width ?? null
  };
}

async function findReferenceFiles(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(folder, entry.name);

      if (entry.isDirectory()) {
        return findReferenceFiles(entryPath);
      }

      if (entry.isFile() && isSupportedReference(entry.name)) {
        return [entryPath];
      }

      return [];
    })
  );

  return files
    .flat()
    .sort((left, right) => toPosixPath(left).localeCompare(toPosixPath(right)));
}

async function extractDominantColors(
  filePath: string
): Promise<ReferenceDominantColor[]> {
  const { data } = await sharp(filePath, { limitInputPixels: false })
    .resize(32, 32, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const counts = new Map<string, number>();

  for (let index = 0; index < data.length; index += 4) {
    if ((data[index + 3] ?? 0) < 16) {
      continue;
    }

    const hex = toHexColor(
      quantizeColor(data[index] ?? 0),
      quantizeColor(data[index + 1] ?? 0),
      quantizeColor(data[index + 2] ?? 0)
    );
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([hex, population]) => ({ hex, population }))
    .sort(
      (left, right) =>
        right.population - left.population || left.hex.localeCompare(right.hex)
    )
    .slice(0, 5);
}

function guessMapType(relativePath: string): {
  confidence: number;
  mapType: ReferenceMapType;
} {
  const tokens = createTags(relativePath);
  let bestType: ReferenceMapType = "unknown";
  let bestScore = 0;

  for (const [mapType, keywords] of Object.entries(MAP_TYPE_KEYWORDS) as Array<
    [Exclude<ReferenceMapType, "unknown">, string[]]
  >) {
    const score = keywords.filter((keyword) => tokens.includes(keyword)).length;

    if (score > bestScore) {
      bestType = mapType;
      bestScore = score;
    }
  }

  return {
    confidence: bestScore === 0 ? 0 : Math.min(1, 0.55 + bestScore * 0.2),
    mapType: bestType
  };
}

function createTags(relativePath: string): string[] {
  return [
    ...new Set(
      relativePath
        .replaceAll("\\", "/")
        .replace(/\.[^.]+$/u, "")
        .split(/[^a-zA-Z0-9]+/u)
        .map((tag) => tag.toLowerCase().trim())
        .filter(Boolean)
    )
  ].sort((left, right) => left.localeCompare(right));
}

function createReferenceId(relativePath: string, fileHash: string): string {
  const pathHash = createHash("sha256").update(relativePath).digest("hex");
  return `reference_${fileHash.slice(0, 12)}_${pathHash.slice(0, 8)}`;
}

function getSupportedExtension(filePath: string): SupportedReferenceExtension {
  const extension = path.extname(filePath).slice(1).toLowerCase();

  if (
    SUPPORTED_REFERENCE_EXTENSIONS.includes(
      extension as SupportedReferenceExtension
    )
  ) {
    return extension as SupportedReferenceExtension;
  }

  throw new Error(`Unsupported reference extension: ${extension}`);
}

function isSupportedReference(fileName: string): boolean {
  const extension = path.extname(fileName).slice(1).toLowerCase();
  return SUPPORTED_REFERENCE_EXTENSIONS.includes(
    extension as SupportedReferenceExtension
  );
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
