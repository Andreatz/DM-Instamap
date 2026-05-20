import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReferenceMapType } from "./references";

export type ReferencePaletteRole = "background" | "floor" | "wall" | "accent" | "unknown";

export type ReferenceStyleDna = {
  confidence: number;
  density: "sparse" | "medium" | "dense";
  generatedAt: string;
  grid: {
    confidence: number;
    detected: boolean;
    estimatedCellSizePx: number | null;
  };
  id: string;
  layoutTraits: string[];
  mapType: string;
  mood: string[];
  palette: Array<{
    hex: string;
    population: number;
    role: ReferencePaletteRole;
  }>;
  promptSummary: string;
  recommendedAssetTags: string[];
  referenceId: string;
  visualTags: string[];
};

export type ReferenceStyleDnaFile = {
  generatedAt: string;
  sourceManifest: string;
  styles: ReferenceStyleDna[];
  version: 1;
};

export type ReferenceStyleOptions = {
  manifestPath?: string;
  outputPath?: string;
  outputRoot?: string;
};

type ReferenceManifestFile = {
  references?: unknown;
};

type StyleReferenceInput = {
  dominantColors?: unknown;
  height?: unknown;
  id?: unknown;
  mapType?: unknown;
  mapTypeConfidence?: unknown;
  path?: unknown;
  tags?: unknown;
  width?: unknown;
};

const DEFAULT_REFERENCES_MANIFEST_PATH = path.join("data", "indexes", "references.manifest.json");
const DEFAULT_REFERENCE_STYLE_PATH = path.join("data", "indexes", "reference-style-dna.json");

export function buildReferenceStyleDna(reference: StyleReferenceInput, generatedAt = new Date().toISOString()): ReferenceStyleDna | null {
  const referenceId = readString(reference.id);
  const referencePath = readString(reference.path);

  if (!referenceId || !referencePath) {
    return null;
  }

  const tags = readStringArray(reference.tags);
  const mapType = readString(reference.mapType) || inferMapType(tags);
  const palette = readPalette(reference.dominantColors);
  const mood = inferMood(palette, tags, mapType);
  const layoutTraits = inferLayoutTraits(reference, tags, mapType);
  const density = inferDensity(reference, tags, palette);
  const grid = detectGrid(reference, tags);
  const visualTags = uniqueSorted([...mood, ...layoutTraits, density, mapType].filter(Boolean));
  const recommendedAssetTags = inferRecommendedAssetTags(mapType, visualTags, tags);
  const confidence = calculateStyleConfidence(reference, palette, mood, layoutTraits, grid);

  return {
    confidence,
    density,
    generatedAt,
    grid,
    id: `style_${referenceId.replace(/^reference_/u, "")}`,
    layoutTraits,
    mapType,
    mood,
    palette,
    promptSummary: buildPromptSummary({
      density,
      grid,
      layoutTraits,
      mapType,
      mood,
      palette
    }),
    recommendedAssetTags,
    referenceId,
    visualTags
  };
}

export async function generateReferenceStyleDna(options: ReferenceStyleOptions = {}): Promise<ReferenceStyleDnaFile> {
  const outputRoot = path.resolve(options.outputRoot ?? process.cwd());
  const manifestPath = path.resolve(outputRoot, options.manifestPath ?? DEFAULT_REFERENCES_MANIFEST_PATH);
  const outputPath = path.resolve(outputRoot, options.outputPath ?? DEFAULT_REFERENCE_STYLE_PATH);
  const manifest = await readReferenceManifest(manifestPath);
  const generatedAt = new Date().toISOString();
  const styles = Array.isArray(manifest.references)
    ? manifest.references
        .map((reference) => buildReferenceStyleDna(reference as StyleReferenceInput, generatedAt))
        .filter((style): style is ReferenceStyleDna => style !== null)
    : [];
  const file: ReferenceStyleDnaFile = {
    generatedAt,
    sourceManifest: path.relative(outputRoot, manifestPath).split(path.sep).join("/"),
    styles,
    version: 1
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");

  return file;
}

async function readReferenceManifest(manifestPath: string): Promise<ReferenceManifestFile> {
  try {
    return parseJsonFile(await readFile(manifestPath, "utf8")) as ReferenceManifestFile;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { references: [] };
    }

    throw error;
  }
}

function readPalette(value: unknown): ReferenceStyleDna["palette"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((color) => {
      if (!color || typeof color !== "object") {
        return null;
      }

      const input = color as { hex?: unknown; population?: unknown };
      const hex = readString(input.hex).toLowerCase();
      const population = readNullableNumber(input.population);

      if (!/^#[0-9a-f]{6}$/u.test(hex) || population === null) {
        return null;
      }

      return {
        hex,
        population,
        role: inferPaletteRole(hex)
      };
    })
    .filter((color): color is ReferenceStyleDna["palette"][number] => color !== null);
}

function inferPaletteRole(hex: string): ReferencePaletteRole {
  const { blue, green, red } = hexToRgb(hex);
  const brightness = (red + green + blue) / 3;

  if (brightness < 55) {
    return "background";
  }

  if (red > 150 && green > 100 && blue < 90) {
    return "accent";
  }

  if (Math.abs(red - green) < 28 && Math.abs(green - blue) < 28) {
    return brightness < 120 ? "wall" : "floor";
  }

  if (red > green && green >= blue) {
    return "floor";
  }

  if (blue > red + 20 || green > red + 25) {
    return "unknown";
  }

  return "unknown";
}

function inferMood(
  palette: ReferenceStyleDna["palette"],
  tags: string[],
  mapType: string
): string[] {
  const moods = new Set<string>();
  const colors = palette.map((color) => hexToRgb(color.hex));
  const avgBrightness =
    colors.length > 0 ? colors.reduce((sum, color) => sum + (color.red + color.green + color.blue) / 3, 0) / colors.length : 128;

  if (avgBrightness < 85) {
    moods.add("dark");
  }

  if (palette.some((color) => color.role === "accent")) {
    moods.add("warm-lit");
  }

  if (palette.some((color) => hexToRgb(color.hex).blue > 130)) {
    moods.add("cold");
  }

  if (tags.some((tag) => ["crypt", "tomb", "grave", "undead"].includes(tag))) {
    moods.add("cryptic");
  }

  if (tags.some((tag) => ["temple", "chapel", "cathedral", "shrine"].includes(tag))) {
    moods.add("sacred");
  }

  if (tags.some((tag) => ["ruin", "ruined", "abandoned"].includes(tag))) {
    moods.add("ruined");
  }

  if (["city", "building"].includes(mapType)) {
    moods.add("urban");
  }

  if (["wilderness", "cave", "coast"].includes(mapType) || tags.some((tag) => ["forest", "swamp", "grass"].includes(tag))) {
    moods.add("natural");
  }

  if (moods.size === 0) {
    moods.add("neutral");
  }

  return uniqueSorted([...moods]);
}

function inferLayoutTraits(reference: StyleReferenceInput, tags: string[], mapType: string): string[] {
  const traits = new Set<string>();
  const width = readNullableNumber(reference.width);
  const height = readNullableNumber(reference.height);

  if (tags.some((tag) => ["corridor", "hall", "dungeon", "crypt", "sewer"].includes(tag))) {
    traits.add("corridor-heavy");
  }

  if (tags.some((tag) => ["room", "rooms", "keep", "inn", "tavern", "manor"].includes(tag))) {
    traits.add("room-cluster");
  }

  if (tags.some((tag) => ["symmetry", "symmetric", "temple", "cathedral"].includes(tag))) {
    traits.add("central-axis");
    traits.add("symmetrical");
  }

  if (mapType === "cave" || tags.some((tag) => ["cave", "cavern", "organic"].includes(tag))) {
    traits.add("organic-cave");
  }

  if (mapType === "city" || tags.some((tag) => ["city", "market", "street", "district"].includes(tag))) {
    traits.add("dense-urban");
  }

  if (mapType === "ship" || tags.some((tag) => ["ship", "deck", "boat"].includes(tag))) {
    traits.add("ship-deck");
  }

  if (tags.some((tag) => ["island", "coast", "harbor"].includes(tag))) {
    traits.add("island-layout");
  }

  if (width && height) {
    const ratio = Math.max(width, height) / Math.min(width, height);

    if (ratio > 1.7) {
      traits.add("central-axis");
    } else if (ratio < 1.2 && traits.size === 0) {
      traits.add("room-cluster");
    }
  }

  if (traits.size === 0) {
    traits.add(mapType === "wilderness" ? "open-field" : "room-cluster");
  }

  return uniqueSorted([...traits]);
}

function inferDensity(reference: StyleReferenceInput, tags: string[], palette: ReferenceStyleDna["palette"]): ReferenceStyleDna["density"] {
  const width = readNullableNumber(reference.width);
  const height = readNullableNumber(reference.height);

  if (tags.some((tag) => ["city", "market", "district", "crowded", "dense"].includes(tag))) {
    return "dense";
  }

  if (tags.some((tag) => ["field", "wilderness", "forest", "open"].includes(tag))) {
    return "sparse";
  }

  if (palette.length >= 5) {
    return "dense";
  }

  if (width && height && width * height < 700 * 700) {
    return "sparse";
  }

  return "medium";
}

function detectGrid(reference: StyleReferenceInput, tags: string[]): ReferenceStyleDna["grid"] {
  const width = readNullableNumber(reference.width);
  const height = readNullableNumber(reference.height);
  const explicitGrid = tags.some((tag) => ["grid", "gridded", "battlemap"].includes(tag));
  const candidates = [50, 64, 70, 72, 100, 128, 140, 150];

  if (!width || !height) {
    return {
      confidence: explicitGrid ? 0.35 : 0.05,
      detected: false,
      estimatedCellSizePx: null
    };
  }

  const match = candidates.find((cellSize) => width % cellSize === 0 && height % cellSize === 0);

  if (match) {
    return {
      confidence: explicitGrid ? 0.78 : 0.55,
      detected: true,
      estimatedCellSizePx: match
    };
  }

  return {
    confidence: explicitGrid ? 0.42 : 0.12,
    detected: false,
    estimatedCellSizePx: null
  };
}

function inferRecommendedAssetTags(mapType: string, visualTags: string[], tags: string[]): string[] {
  const recommended = new Set<string>([...visualTags, ...tags.slice(0, 8)]);

  if (mapType === "dungeon") {
    ["stone", "wall", "door", "torch"].forEach((tag) => recommended.add(tag));
  }

  if (mapType === "building") {
    ["floor", "furniture", "door", "window"].forEach((tag) => recommended.add(tag));
  }

  if (mapType === "city") {
    ["street", "building", "market", "roof"].forEach((tag) => recommended.add(tag));
  }

  if (mapType === "cave") {
    ["rock", "terrain", "water", "rubble"].forEach((tag) => recommended.add(tag));
  }

  if (mapType === "ship") {
    ["wood", "deck", "rope", "crate"].forEach((tag) => recommended.add(tag));
  }

  return uniqueSorted([...recommended]).slice(0, 18);
}

function calculateStyleConfidence(
  reference: StyleReferenceInput,
  palette: ReferenceStyleDna["palette"],
  mood: string[],
  layoutTraits: string[],
  grid: ReferenceStyleDna["grid"]
): number {
  const mapTypeConfidence = readNullableNumber(reference.mapTypeConfidence) ?? 0;
  const metadata = readNullableNumber(reference.width) && readNullableNumber(reference.height) ? 0.2 : 0;
  const paletteSignal = Math.min(0.25, palette.length * 0.05);
  const moodSignal = mood.length > 0 ? 0.15 : 0;
  const layoutSignal = layoutTraits.length > 0 ? 0.15 : 0;
  const gridSignal = grid.confidence * 0.15;

  return round(Math.min(1, mapTypeConfidence * 0.1 + metadata + paletteSignal + moodSignal + layoutSignal + gridSignal));
}

function buildPromptSummary(input: {
  density: ReferenceStyleDna["density"];
  grid: ReferenceStyleDna["grid"];
  layoutTraits: string[];
  mapType: string;
  mood: string[];
  palette: ReferenceStyleDna["palette"];
}): string {
  const paletteSummary = input.palette
    .slice(0, 3)
    .map((color) => `${color.role} ${color.hex}`)
    .join(", ");
  const gridSummary = input.grid.detected
    ? `likely square grid around ${input.grid.estimatedCellSizePx}px`
    : "grid not confidently detected";

  return [
    `${toTitleCase(input.mapType)} battlemap style`,
    input.mood.length > 0 ? `with ${input.mood.join(", ")} mood` : "with neutral mood",
    paletteSummary ? `using ${paletteSummary}` : "using unknown palette",
    `${input.layoutTraits.join(", ")} layout`,
    `${input.density} density`,
    gridSummary
  ].join(", ");
}

function inferMapType(tags: string[]): ReferenceMapType {
  if (tags.some((tag) => ["crypt", "dungeon", "tomb", "sewer"].includes(tag))) {
    return "dungeon";
  }

  if (tags.some((tag) => ["city", "street", "market", "district"].includes(tag))) {
    return "city";
  }

  if (tags.some((tag) => ["cave", "cavern", "mine"].includes(tag))) {
    return "cave";
  }

  if (tags.some((tag) => ["ship", "deck", "boat"].includes(tag))) {
    return "ship";
  }

  if (tags.some((tag) => ["forest", "wild", "woods"].includes(tag))) {
    return "wilderness";
  }

  return "unknown";
}

function hexToRgb(hex: string): { blue: number; green: number; red: number } {
  return {
    blue: Number.parseInt(hex.slice(5, 7), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    red: Number.parseInt(hex.slice(1, 3), 16)
  };
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseJsonFile(content: string): unknown {
  return JSON.parse(content.charCodeAt(0) === 0xfeff ? content.slice(1) : content);
}

function round(value: number): number {
  return Number(value.toFixed(2));
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
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
