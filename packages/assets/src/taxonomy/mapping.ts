/**
 * Rule engine that turns Dungeondraft `sourceTags` (plus the asset path) into a
 * normalized multi-level taxonomy entry. The rules here are intentionally
 * code-driven and unit-tested so the manifest can be regenerated repeatably,
 * rather than depending on a one-off precomputed file.
 *
 * Ordering of concerns (highest priority first):
 *   1. anti-carpet/rug/runner/tapestry/banner rules (never light)
 *   2. keyword -> macroCategory scoring
 *   3. VM (and other vendor) pack extraction into sourcePacks
 *   4. theme vs group token classification
 */

import {
  type AssetStatus,
  type AssetUsageRules,
  createDefaultUsageRules,
  isMacroCategory,
  type MacroCategory
} from "./schema";

export type MappedAsset = {
  sourceTags: string[];
  sourcePacks: string[];
  macroCategory: MacroCategory;
  assetGroups: string[];
  assetSubGroups: string[];
  themeTags: string[];
  placementTags: string[];
  usageRules: AssetUsageRules;
  qualityFlags: string[];
  status: AssetStatus;
  taxonomyNotes: string[];
};

/**
 * Keyword tables: a token appearing in a sourceTag or path votes for a macro
 * category. The asset's macroCategory is the highest-scoring category, with
 * ties broken by {@link CATEGORY_PRIORITY}.
 */
const MACRO_KEYWORDS: Record<Exclude<MacroCategory, "unknown">, string[]> = {
  light: [
    "lighting",
    "light",
    "fire",
    "torch",
    "candle",
    "lantern",
    "lamp",
    "brazier",
    "sconce",
    "glow",
    "glowing",
    "chandelier",
    "campfire"
  ],
  door: ["door", "gate", "hatch", "portcullis", "entrance", "doorway"],
  window: ["window", "shutter", "windowpane"],
  furniture: [
    "table",
    "chair",
    "desk",
    "dining",
    "dishes",
    "barrel",
    "crate",
    "storage",
    "bed",
    "beds",
    "bench",
    "shelf",
    "bookshelf",
    "cabinet",
    "dresser",
    "wardrobe",
    "throne",
    "stool",
    "furniture",
    "counter",
    "cupboard",
    "drawer",
    "sofa",
    "couch"
  ],
  water: [
    "river",
    "water",
    "sea",
    "lake",
    "seaflora",
    "ocean",
    "pond",
    "stream",
    "coral",
    "waterfall",
    "creek",
    "lagoon",
    "wave",
    "waves"
  ],
  roof: ["roof", "roofs", "shingle", "thatch", "rooftop"],
  wall: ["wall", "walls", "fence", "palisade", "barrier", "rampart"],
  floor: [
    "floor",
    "flooring",
    "tile",
    "tiles",
    "flagstone",
    "flagstones",
    "cobble",
    "parquet",
    "mosaic",
    "pavement",
    "path",
    "paths",
    "texture",
    "ground"
  ],
  decoration: [
    "carpet",
    "rug",
    "runner",
    "tapestry",
    "banner",
    "banners",
    "art",
    "pillar",
    "decor",
    "decoration",
    "rubble",
    "statue",
    "painting",
    "ornament",
    "clutter",
    "flag",
    "flags",
    "curtain",
    "sign"
  ],
  terrain: [
    "cave",
    "rock",
    "rocks",
    "mountain",
    "hill",
    "hills",
    "tree",
    "trees",
    "plant",
    "plants",
    "mushroom",
    "bush",
    "bushes",
    "grass",
    "cliff",
    "foliage",
    "flower",
    "flowers",
    "boulder",
    "sand",
    "snow",
    "desert",
    "moss",
    "stalagmite",
    "stalactite",
    "crystal",
    "crystals",
    "cacti",
    "cactus"
  ],
  token: ["creature", "creatures", "corpse", "corpses", "monster", "monsters"],
  prop: [
    "ship",
    "boat",
    "cart",
    "airship",
    "mechanism",
    "gears",
    "tools",
    "treasure",
    "weapon",
    "weapons",
    "armor",
    "object",
    "objects",
    "item",
    "items",
    "prop",
    "props",
    "asset",
    "assets",
    "coin",
    "coins",
    "book",
    "books",
    "food",
    "dish",
    "pottery",
    "anvil",
    "bones",
    "bone"
  ]
};

/** Tie-break order when multiple categories score equally (earlier = wins). */
const CATEGORY_PRIORITY: MacroCategory[] = [
  "light",
  "door",
  "window",
  "furniture",
  "water",
  "roof",
  "wall",
  "floor",
  "decoration",
  "terrain",
  "token",
  "prop",
  "unknown"
];

/** Carpet-family keywords that must never be classified as light. */
const ANTI_LIGHT_KEYWORDS = [
  "carpet",
  "rug",
  "runner",
  "tapestry",
  "banner"
] as const;

/**
 * Tokens that describe a theme/style/place rather than an object type. These
 * become `themeTags`; everything else meaningful becomes an `assetGroup`.
 */
const THEME_TOKENS = new Set([
  "tavern",
  "inn",
  "wood",
  "wooden",
  "stone",
  "metal",
  "interior",
  "exterior",
  "outdoor",
  "indoor",
  "dock",
  "docks",
  "noble",
  "rustic",
  "fancy",
  "colorable",
  "naval",
  "desert",
  "winter",
  "summer",
  "spring",
  "fall",
  "autumn",
  "forest",
  "dungeon",
  "ruins",
  "ruined",
  "cave",
  "city",
  "village",
  "castle",
  "farm",
  "garden",
  "graveyard",
  "sewer",
  "swamp",
  "snow",
  "lava",
  "fey",
  "feywild",
  "fantasy",
  "ancient",
  "ancestral",
  "festival",
  "campsite",
  "blacksmith",
  "apothecary",
  "alchemist",
  "magic",
  "magical",
  "holy",
  "cult",
  "elemental"
]);

/** Tokens that describe placement constraints rather than object type/theme. */
const PLACEMENT_TOKENS = new Set([
  "floor",
  "wall",
  "ceiling",
  "corner",
  "outdoor",
  "indoor",
  "water",
  "corridor",
  "underground"
]);

/** Stop tokens that carry no semantic value once VM is extracted. */
const STOP_TOKENS = new Set(["vm", "the", "a", "of", "and", "misc", "general"]);

/**
 * A pre-classified per-sourceTag lookup. When supplied, the seed is treated as
 * the authoritative classification for tags it covers (the Dungeondraft tags
 * are the primary source of truth); tags absent from the seed fall back to the
 * keyword rule engine. Per-asset rules (anti-carpet, VM extraction, status)
 * always run on top of whichever classification was chosen.
 */
export type SeedTaxonomyEntry = {
  macroCategory: MacroCategory;
  assetGroups?: string[];
  themeTags?: string[];
  placementTags?: string[];
  sourcePack?: string | null;
};

export type SeedTaxonomy = Record<string, SeedTaxonomyEntry>;

export type MapSourceTagsInput = {
  path: string;
  sourceTags: string[];
  seed?: SeedTaxonomy;
};

type PerTagResult = {
  macroCategory: MacroCategory;
  assetGroups: string[];
  themeTags: string[];
  placementTags: string[];
};

export function mapSourceTags(input: MapSourceTagsInput): MappedAsset {
  const sourceTags = [...input.sourceTags];
  const taxonomyNotes: string[] = [];
  const qualityFlags: string[] = [];

  const sourcePacks = extractSourcePacks(sourceTags, input.path);
  const pathTokens = tokenize(input.path);

  // 1. Anti-carpet rule has the highest priority.
  const tagTokens = collectTokens(sourceTags);
  const antiLightHit = ANTI_LIGHT_KEYWORDS.find((keyword) =>
    [...tagTokens, ...pathTokens].includes(keyword)
  );

  // 2. Resolve each sourceTag individually (seed first, rules as fallback) and
  //    aggregate the per-tag macroCategories by majority vote.
  const perTag = sourceTags.map((tag) => resolveTag(tag, input.seed));
  const aggregated = aggregateMacro(perTag);
  let macroCategory: MacroCategory =
    sourceTags.length === 0 ? "unknown" : aggregated.macroCategory;

  if (aggregated.conflict) {
    qualityFlags.push("multi-category-conflict");
    taxonomyNotes.push(
      `Multiple categories tied (${aggregated.tied.join(", ")}); chose ${macroCategory} by priority.`
    );
  }

  // Union the per-tag groups / themes / placement tags.
  const themeTags = new Set<string>();
  const assetGroups = new Set<string>();
  const placementTags = new Set<string>();

  for (const result of perTag) {
    for (const group of result.assetGroups) {
      if (group && !STOP_TOKENS.has(group)) {
        assetGroups.add(group);
      }
    }
    for (const theme of result.themeTags) {
      if (theme && !STOP_TOKENS.has(theme)) {
        themeTags.add(theme);
      }
    }
    for (const placement of result.placementTags) {
      placementTags.add(placement);
    }
  }

  // 3. Apply the anti-light override after the generic mapping.
  if (antiLightHit) {
    if (macroCategory === "light") {
      taxonomyNotes.push(
        `Forced to decoration: path/tag contains "${antiLightHit}" (anti-light rule).`
      );
    }
    macroCategory = "decoration";
    assetGroups.add(antiLightHit);
    // Drop light-ish groups so a carpet never advertises itself as a light.
    for (const lightToken of MACRO_KEYWORDS.light) {
      assetGroups.delete(singularize(lightToken));
    }
  }

  // 4. Derive usage rules + placement defaults.
  const usageRules = deriveUsageRules({
    macroCategory,
    assetGroups,
    forcedNonLight: Boolean(antiLightHit)
  });
  addDefaultPlacement(placementTags, macroCategory, assetGroups);

  // 5. Status.
  let status: AssetStatus = "approved";
  if (sourceTags.length === 0) {
    status = "needs-review";
    qualityFlags.push("no-source-tags");
  } else if (macroCategory === "unknown") {
    status = "needs-review";
  }

  return {
    sourceTags: [...sourceTags].sort((a, b) => a.localeCompare(b)),
    sourcePacks,
    macroCategory,
    assetGroups: [...assetGroups]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    assetSubGroups: [],
    themeTags: [...themeTags].sort((a, b) => a.localeCompare(b)),
    placementTags: [...placementTags].sort((a, b) => a.localeCompare(b)),
    usageRules,
    qualityFlags: dedupe(qualityFlags),
    status,
    taxonomyNotes
  };
}

export function extractSourcePacks(
  sourceTags: string[],
  path: string
): string[] {
  const packs = new Set<string>();
  const haystack = [...sourceTags, path];

  for (const value of haystack) {
    // VM is the vendor prefix (Venatus Maps). Match it as a standalone token,
    // e.g. ".VM Table", "VM_Rocks", "VM-Tavern".
    if (/(^|[^a-z])vm([^a-z]|$)/iu.test(stripLeadingDots(value))) {
      packs.add("VM");
    }
  }

  return [...packs].sort((a, b) => a.localeCompare(b));
}

/**
 * Classify a single sourceTag. Uses the seed when it covers the tag, otherwise
 * runs the keyword rule engine over the tag's tokens.
 */
function resolveTag(tag: string, seed?: SeedTaxonomy): PerTagResult {
  const seedEntry = seed?.[tag];
  if (seedEntry && isMacroCategory(seedEntry.macroCategory)) {
    return {
      macroCategory: seedEntry.macroCategory,
      assetGroups: (seedEntry.assetGroups ?? [])
        .map((group) => group.toLowerCase())
        .filter((group) => group && group !== "vm"),
      themeTags: (seedEntry.themeTags ?? []).map((theme) =>
        theme.toLowerCase()
      ),
      placementTags: seedEntry.placementTags ?? []
    };
  }

  const tokens = tokenize(stripLeadingDots(tag)).filter(
    (token) => !STOP_TOKENS.has(token)
  );
  const scored = scoreCategories(tokens);
  const assetGroups: string[] = [];
  const themeTags: string[] = [];
  const placementTags: string[] = [];

  for (const token of dedupe(tokens)) {
    if (THEME_TOKENS.has(token)) {
      themeTags.push(token);
    } else {
      assetGroups.push(singularize(token));
    }
    if (PLACEMENT_TOKENS.has(token)) {
      placementTags.push(token);
    }
  }

  return {
    macroCategory: scored.winner ?? "unknown",
    assetGroups,
    themeTags,
    placementTags
  };
}

/**
 * Aggregate per-tag macroCategories by majority vote. `unknown` only wins when
 * every tag is unknown; ties are broken by {@link CATEGORY_PRIORITY}.
 */
function aggregateMacro(perTag: PerTagResult[]): {
  macroCategory: MacroCategory;
  conflict: boolean;
  tied: MacroCategory[];
} {
  const counts = new Map<MacroCategory, number>();
  for (const result of perTag) {
    if (result.macroCategory === "unknown") {
      continue;
    }
    counts.set(
      result.macroCategory,
      (counts.get(result.macroCategory) ?? 0) + 1
    );
  }

  if (counts.size === 0) {
    return { macroCategory: "unknown", conflict: false, tied: [] };
  }

  const maxCount = Math.max(...counts.values());
  const tied = [...counts.entries()]
    .filter(([, count]) => count === maxCount)
    .map(([category]) => category)
    .sort(
      (a, b) => CATEGORY_PRIORITY.indexOf(a) - CATEGORY_PRIORITY.indexOf(b)
    );

  return {
    macroCategory: tied[0] ?? "unknown",
    conflict: tied.length > 1,
    tied
  };
}

function scoreCategories(tokens: string[]): {
  winner: MacroCategory | null;
  fallback: MacroCategory;
  conflict: boolean;
  tiedCategories: MacroCategory[];
} {
  const scores = new Map<MacroCategory, number>();
  const tokenSet = new Set(tokens);

  for (const [category, keywords] of Object.entries(MACRO_KEYWORDS) as Array<
    [Exclude<MacroCategory, "unknown">, string[]]
  >) {
    let hits = 0;
    for (const keyword of keywords) {
      if (tokenSet.has(keyword)) {
        hits += 1;
      }
    }
    if (hits > 0) {
      scores.set(category, hits);
    }
  }

  if (scores.size === 0) {
    return {
      winner: null,
      fallback: "unknown",
      conflict: false,
      tiedCategories: []
    };
  }

  const maxScore = Math.max(...scores.values());
  const tied = [...scores.entries()]
    .filter(([, score]) => score === maxScore)
    .map(([category]) => category)
    .sort(
      (a, b) => CATEGORY_PRIORITY.indexOf(a) - CATEGORY_PRIORITY.indexOf(b)
    );

  return {
    winner: tied[0] ?? null,
    fallback: tied[0] ?? "unknown",
    conflict: tied.length > 1,
    tiedCategories: tied
  };
}

function deriveUsageRules(input: {
  macroCategory: MacroCategory;
  assetGroups: Set<string>;
  forcedNonLight: boolean;
}): AssetUsageRules {
  const rules = createDefaultUsageRules();
  const groups = input.assetGroups;

  rules.canBeLightEmitter =
    !input.forcedNonLight && input.macroCategory === "light";

  rules.canBeFloorOverlay =
    input.macroCategory === "floor" ||
    hasAny(groups, ["carpet", "rug", "runner"]);

  rules.canBeWallMounted =
    input.macroCategory === "window" ||
    hasAny(groups, [
      "banner",
      "painting",
      "art",
      "tapestry",
      "torch",
      "sconce",
      "shelf",
      "bookshelf"
    ]);

  rules.canBeCenterpiece = hasAny(groups, [
    "table",
    "altar",
    "throne",
    "statue",
    "fountain",
    "sarcophagus",
    "anvil",
    "bed"
  ]);

  return rules;
}

function addDefaultPlacement(
  placementTags: Set<string>,
  macroCategory: MacroCategory,
  groups: Set<string>
): void {
  if (placementTags.size > 0) {
    return;
  }

  switch (macroCategory) {
    case "floor":
    case "water":
    case "terrain":
      placementTags.add("floor");
      break;
    case "window":
      placementTags.add("wall");
      break;
    case "light":
      placementTags.add(
        hasAny(groups, ["torch", "sconce", "lantern"]) ? "wall" : "floor"
      );
      break;
    case "furniture":
    case "prop":
    case "decoration":
      placementTags.add("floor");
      break;
    default:
      break;
  }
}

function collectTokens(sourceTags: string[]): string[] {
  return dedupe(sourceTags.flatMap((tag) => tokenize(stripLeadingDots(tag))));
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function stripLeadingDots(value: string): string {
  return value.replace(/^\.+/u, "");
}

function singularize(token: string): string {
  if (token.length <= 3 || token.endsWith("ss") || token.endsWith("us")) {
    return token;
  }
  if (token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("s")) {
    return token.slice(0, -1);
  }
  return token;
}

function hasAny(set: Set<string>, values: string[]): boolean {
  return values.some((value) => set.has(value));
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
