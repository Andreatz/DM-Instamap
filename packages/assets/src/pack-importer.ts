import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { scanAssets, type AssetManifest, type AssetManifestEntry } from "./scanner";
import type { AssetClassification } from "./classifier";

export const PACK_PRESETS = ["forgotten-adventures", "two-minute-tabletop", "czepeku", "generic"] as const;

export type PackPreset = (typeof PACK_PRESETS)[number];

export type PackImporterOptions = {
  assetRoot: string;
  defaultTags?: string[];
  manifestPath?: string;
  outputRoot?: string;
  preset: PackPreset;
  previewDir?: string;
  thumbnailSize?: number;
};

export type PackImportResult = {
  added: AssetManifestEntry[];
  manifest: AssetManifest;
  preset: PackPreset;
  presetTagsApplied: number;
  reclassifiedCount: number;
};

type PackRule = {
  classification?: AssetClassification;
  pattern: RegExp;
  tags: string[];
};

const FORGOTTEN_ADVENTURES_RULES: PackRule[] = [
  { classification: "wall", pattern: /\bwalls?\b/iu, tags: ["forgotten-adventures", "walls"] },
  { classification: "floor", pattern: /\bfloors?\b/iu, tags: ["forgotten-adventures", "floors"] },
  { classification: "furniture", pattern: /\bfurniture\b/iu, tags: ["forgotten-adventures", "furniture"] },
  { classification: "prop", pattern: /\bprops?\b/iu, tags: ["forgotten-adventures", "props"] },
  { classification: "decoration", pattern: /\bdecorations?\b/iu, tags: ["forgotten-adventures", "decoration"] },
  { classification: "light", pattern: /\b(lights?|torch|candle|brazier)\b/iu, tags: ["forgotten-adventures", "lighting"] },
  { classification: "terrain", pattern: /\b(nature|trees?|rocks?|terrain)\b/iu, tags: ["forgotten-adventures", "terrain"] },
  { classification: "water", pattern: /\b(water|river|lake|pond)\b/iu, tags: ["forgotten-adventures", "water"] },
  { pattern: /\b(dungeon|crypt|cave)\b/iu, tags: ["forgotten-adventures", "dungeon"] },
  { pattern: /\b(forest|outdoor|wilderness)\b/iu, tags: ["forgotten-adventures", "outdoor"] }
];

const TWO_MINUTE_TABLETOP_RULES: PackRule[] = [
  { classification: "floor", pattern: /\btiles?\b/iu, tags: ["2-minute-tabletop", "tile-set"] },
  { classification: "floor", pattern: /\bbattle[-_ ]?map\b/iu, tags: ["2-minute-tabletop", "battle-map"] },
  { classification: "wall", pattern: /\bwalls?\b/iu, tags: ["2-minute-tabletop", "walls"] },
  { classification: "prop", pattern: /\bprops?\b/iu, tags: ["2-minute-tabletop", "props"] },
  { classification: "terrain", pattern: /\b(forest|nature|terrain)\b/iu, tags: ["2-minute-tabletop", "terrain"] },
  { pattern: /\b(tavern|inn)\b/iu, tags: ["2-minute-tabletop", "interior", "tavern"] },
  { pattern: /\b(temple|chapel|cathedral)\b/iu, tags: ["2-minute-tabletop", "sacred"] }
];

const CZEPEKU_RULES: PackRule[] = [
  { classification: "floor", pattern: /\b(map|scene)\b/iu, tags: ["czepeku", "full-scene"] },
  { pattern: /\b(grid|gridded)\b/iu, tags: ["czepeku", "gridded"] },
  { pattern: /\b(no[-_ ]?grid|gridless)\b/iu, tags: ["czepeku", "gridless"] },
  { pattern: /\b(day|noon)\b/iu, tags: ["czepeku", "day"] },
  { pattern: /\b(night|dark)\b/iu, tags: ["czepeku", "night"] }
];

const GENERIC_RULES: PackRule[] = [
  { pattern: /\b(top[-_ ]?down|tabletop)\b/iu, tags: ["top-down"] },
  { pattern: /\b(isometric|iso)\b/iu, tags: ["isometric"] }
];

const PRESET_RULES: Record<PackPreset, PackRule[]> = {
  "czepeku": CZEPEKU_RULES,
  "forgotten-adventures": FORGOTTEN_ADVENTURES_RULES,
  "generic": GENERIC_RULES,
  "two-minute-tabletop": TWO_MINUTE_TABLETOP_RULES
};

export function listPackPresets(): readonly PackPreset[] {
  return PACK_PRESETS;
}

export async function importAssetPack(options: PackImporterOptions): Promise<PackImportResult> {
  if (!PACK_PRESETS.includes(options.preset)) {
    throw new Error(`Unknown pack preset: ${options.preset}`);
  }

  const manifest = await scanAssets(options.assetRoot, {
    ...(options.manifestPath ? { manifestPath: options.manifestPath } : {}),
    ...(options.outputRoot ? { outputRoot: options.outputRoot } : {}),
    ...(options.previewDir ? { previewDir: options.previewDir } : {}),
    ...(options.thumbnailSize ? { thumbnailSize: options.thumbnailSize } : {})
  });
  const enrichment = enrichManifestWithPackRules(manifest, options.preset, options.defaultTags ?? []);
  const enrichedManifest: AssetManifest = {
    ...manifest,
    assets: enrichment.entries
  };
  const outputRoot = path.resolve(options.outputRoot ?? process.cwd());
  const manifestPath = path.resolve(outputRoot, options.manifestPath ?? path.join("data", "indexes", "assets.manifest.json"));

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(enrichedManifest, null, 2)}\n`, "utf8");

  return {
    added: enrichment.entries,
    manifest: enrichedManifest,
    preset: options.preset,
    presetTagsApplied: enrichment.tagsApplied,
    reclassifiedCount: enrichment.reclassifiedCount
  };
}

export function applyPackRulesToEntry(
  entry: AssetManifestEntry,
  preset: PackPreset,
  defaultTags: string[] = []
): { entry: AssetManifestEntry; tagsAdded: number; reclassified: boolean } {
  const rules = PRESET_RULES[preset];
  const subject = `${entry.relativePath} ${path.basename(entry.relativePath)} ${path.dirname(entry.relativePath)}`;
  const tags = new Set(entry.tags);
  const initialSize = tags.size;
  let nextClassification = entry.classification;
  let reclassified = false;

  for (const tag of defaultTags) {
    tags.add(tag.toLowerCase());
  }

  for (const rule of rules) {
    if (!rule.pattern.test(subject)) {
      continue;
    }

    for (const tag of rule.tags) {
      tags.add(tag);
    }

    if (
      rule.classification &&
      (entry.classification === "unknown" || entry.classificationSource === "automatic") &&
      nextClassification !== rule.classification
    ) {
      nextClassification = rule.classification;
      reclassified = true;
    }
  }

  const tagsAdded = Math.max(0, tags.size - initialSize);

  return {
    entry: {
      ...entry,
      classification: nextClassification,
      tags: [...tags].sort()
    },
    reclassified,
    tagsAdded
  };
}

function enrichManifestWithPackRules(
  manifest: AssetManifest,
  preset: PackPreset,
  defaultTags: string[]
): { entries: AssetManifestEntry[]; reclassifiedCount: number; tagsApplied: number } {
  let reclassifiedCount = 0;
  let tagsApplied = 0;
  const entries = manifest.assets.map((entry) => {
    const result = applyPackRulesToEntry(entry, preset, defaultTags);
    tagsApplied += result.tagsAdded;

    if (result.reclassified) {
      reclassifiedCount += 1;
    }

    return result.entry;
  });

  return { entries, reclassifiedCount, tagsApplied };
}
