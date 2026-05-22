import type { MapDocument, RoomNode } from "@dm-instamap/core";
import { generateDungeon } from "./index";
import { generateCaveDungeon, generateOutdoorMap, generateVillageMap } from "./algorithms";
import { generateBuildingBlueprint, generateMapFromBlueprint } from "./blueprint";
import { scoreMapQuality, type MapQualityReport } from "./quality";
import { withRoomRoleNotes } from "./gm-notes";
import { applyStyleDna, type StyleDnaHint } from "./style-dna";

export type BenchmarkMetricKey =
  | "themeAlignment"
  | "assetDensity"
  | "roomVariety"
  | "routing"
  | "readability"
  | "tacticalAffordance";

export type BenchmarkMetrics = Record<BenchmarkMetricKey, number>;

export type BenchmarkThresholds = {
  minScore: number;
} & Partial<Record<BenchmarkMetricKey, number>>;

export type BenchmarkScenario = {
  build: () => MapDocument;
  id: string;
  label: string;
  styleDna?: StyleDnaHint;
  theme: string;
  thresholds: BenchmarkThresholds;
};

export type BenchmarkResult = {
  document: MapDocument;
  failures: string[];
  id: string;
  label: string;
  metrics: BenchmarkMetrics;
  passed: boolean;
  quality: MapQualityReport;
  roomCount: number;
  size: { height: number; width: number };
  theme: string;
};

const PLAYABLE_KINDS = new Set<RoomNode["kind"]>(["entrance", "room", "secret", "service", "stairs"]);

const SPECIAL_TAG = /boss|final|treasure|tesoro|altar|chapel|cappella|library|biblioteca|forge|shrine|water|river|fiume|reliqu/u;

const METRIC_LABELS: Record<BenchmarkMetricKey, string> = {
  assetDensity: "Densita elementi",
  readability: "Leggibilita",
  roomVariety: "Varieta stanze",
  routing: "Routing",
  tacticalAffordance: "Affordance tattica",
  themeAlignment: "Allineamento tema"
};

export function benchmarkMetricLabel(key: BenchmarkMetricKey): string {
  return METRIC_LABELS[key];
}

/**
 * The benchmark scenario set. Every scenario is fully deterministic: procedural
 * maps take fixed inputs and the seeded generators take fixed seeds, so re-runs
 * are byte-for-byte comparable.
 */
export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  {
    build: () =>
      generateDungeon({
        heightCells: 34,
        requiredRooms: ["chapel", "reliquary", "ossuary"],
        roomCount: 7,
        theme: "crypt",
        widthCells: 48
      }),
    id: "crypt",
    label: "Cripta",
    styleDna: { densityBias: "rich", layoutBias: "compact", paletteTags: ["stone", "candlelight", "bone"] },
    theme: "crypt",
    thresholds: { minScore: 60, readability: 55, routing: 80, themeAlignment: 70 }
  },
  {
    build: () =>
      generateDungeon({
        heightCells: 36,
        requiredRooms: ["boss", "library", "armory"],
        roomCount: 8,
        theme: "dungeon",
        widthCells: 52
      }),
    id: "boss-dungeon",
    label: "Dungeon con boss",
    styleDna: { densityBias: "normal", layoutBias: "balanced", paletteTags: ["iron", "torchlight"] },
    theme: "dungeon",
    thresholds: { minScore: 60, routing: 80, tacticalAffordance: 40, themeAlignment: 70 }
  },
  {
    build: () =>
      generateDungeon({
        heightCells: 30,
        requiredRooms: ["collapsed hall", "overgrown court"],
        roomCount: 6,
        theme: "ruin",
        widthCells: 44
      }),
    id: "ruin",
    label: "Rovina",
    styleDna: { densityBias: "sparse", layoutBias: "sprawling", paletteTags: ["moss", "broken-stone"] },
    theme: "ruin",
    thresholds: { minScore: 58, routing: 75, themeAlignment: 70 }
  },
  {
    build: () => generateCaveDungeon({ heightCells: 34, seed: "benchmark-cave", theme: "cave", widthCells: 48 }),
    id: "cave",
    label: "Caverna",
    styleDna: { densityBias: "sparse", layoutBias: "sprawling", paletteTags: ["rock", "damp"] },
    theme: "cave",
    thresholds: { minScore: 55, routing: 70 }
  },
  {
    build: () => generateVillageMap({ blockCount: 6, heightCells: 34, seed: "benchmark-village", theme: "village", widthCells: 48 }),
    id: "village",
    label: "Villaggio",
    styleDna: { densityBias: "rich", layoutBias: "sprawling", paletteTags: ["timber", "thatch"] },
    theme: "village",
    thresholds: { minScore: 55, roomVariety: 40 }
  },
  {
    build: () =>
      generateOutdoorMap({ heightCells: 32, river: true, seed: "benchmark-camp", theme: "camp", treeDensity: 0.12, widthCells: 46 }),
    id: "camp",
    label: "Accampamento",
    styleDna: { densityBias: "normal", layoutBias: "balanced", paletteTags: ["canvas", "campfire"] },
    theme: "camp",
    thresholds: { minScore: 50 }
  },
  {
    build: () =>
      generateMapFromBlueprint(
        generateBuildingBlueprint({ request: "a lively tavern with common room, kitchen and cellar", theme: "tavern" })
      ),
    id: "tavern",
    label: "Taverna",
    styleDna: { densityBias: "rich", layoutBias: "compact", paletteTags: ["wood", "hearth"] },
    theme: "tavern",
    thresholds: { minScore: 55, themeAlignment: 50 }
  }
];

/**
 * Derives the six DM-facing benchmark metrics from a scored document. Routing,
 * readability and tactical affordance reuse the core quality metrics; theme,
 * variety and density are computed here from plan structure.
 */
export function computeBenchmarkMetrics(document: MapDocument, theme: string, quality: MapQualityReport): BenchmarkMetrics {
  const rooms = (document.plan?.rooms ?? []).filter((room) => PLAYABLE_KINDS.has(room.kind));
  const roomCount = Math.max(1, rooms.length);

  return {
    assetDensity: scoreAssetDensity(document, roomCount),
    readability: blend(quality.metrics.walkableBalance.score, 0.6, quality.metrics.roomUtility.score, 0.4),
    roomVariety: scoreRoomVariety(rooms),
    routing: blend(quality.metrics.connectivity.score, 0.7, quality.metrics.deadEnds.score, 0.3),
    tacticalAffordance: blend(quality.metrics.tacticalCover.score, 0.6, quality.metrics.lineOfSightBreaks.score, 0.4),
    themeAlignment: scoreThemeAlignment(rooms, theme)
  };
}

export function runBenchmarkScenario(scenario: BenchmarkScenario): BenchmarkResult {
  const base = applyStyleDna(scenario.build(), scenario.styleDna);
  const document = withRoomRoleNotes(base);
  const quality = scoreMapQuality(document);
  const metrics = computeBenchmarkMetrics(document, scenario.theme, quality);
  const failures = collectFailures(scenario.thresholds, quality, metrics);
  const rooms = (document.plan?.rooms ?? []).filter((room) => PLAYABLE_KINDS.has(room.kind));

  return {
    document,
    failures,
    id: scenario.id,
    label: scenario.label,
    metrics,
    passed: failures.length === 0,
    quality,
    roomCount: rooms.length,
    size: { height: document.height, width: document.width },
    theme: scenario.theme
  };
}

export function runBenchmarks(scenarios: BenchmarkScenario[] = BENCHMARK_SCENARIOS): BenchmarkResult[] {
  return scenarios.map((scenario) => runBenchmarkScenario(scenario));
}

function collectFailures(thresholds: BenchmarkThresholds, quality: MapQualityReport, metrics: BenchmarkMetrics): string[] {
  const failures: string[] = [];

  if (quality.score < thresholds.minScore) {
    failures.push(`punteggio ${quality.score} sotto la soglia ${thresholds.minScore}`);
  }

  for (const key of Object.keys(METRIC_LABELS) as BenchmarkMetricKey[]) {
    const minimum = thresholds[key];

    if (minimum !== undefined && metrics[key] < minimum) {
      failures.push(`${METRIC_LABELS[key]} ${metrics[key]} sotto la soglia ${minimum}`);
    }
  }

  return failures;
}

function scoreThemeAlignment(rooms: RoomNode[], theme: string): number {
  const tokens = theme.toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean);

  if (tokens.length === 0 || rooms.length === 0) {
    return 50;
  }

  const aligned = rooms.filter((room) => {
    const haystack = `${room.label} ${room.tags.join(" ")}`.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  }).length;

  return Math.round((aligned / rooms.length) * 100);
}

function scoreRoomVariety(rooms: RoomNode[]): number {
  if (rooms.length === 0) {
    return 0;
  }

  const distinctLabels = new Set(rooms.map((room) => room.label.toLowerCase())).size;
  const distinctKinds = new Set(rooms.map((room) => room.kind)).size;
  const labelVariety = distinctLabels / rooms.length;
  const kindVariety = Math.min(1, distinctKinds / 3);

  return Math.round((labelVariety * 0.6 + kindVariety * 0.4) * 100);
}

function scoreAssetDensity(document: MapDocument, roomCount: number): number {
  const doors = document.plan?.doors.length ?? 0;
  const lights = document.plan?.lights.length ?? 0;
  const gmNotes = document.plan?.gmNotes.length ?? 0;
  const placements = document.plan?.assetPlacements.length ?? 0;
  const placedAssets = document.assets.length;
  const specialRooms = (document.plan?.rooms ?? []).filter((room) => room.tags.some((tag) => SPECIAL_TAG.test(tag))).length;
  const featureCount = doors + lights + gmNotes + placements + placedAssets + specialRooms;
  const perRoom = featureCount / roomCount;

  return Math.round(clamp01(perRoom / 2.5) * 100);
}

function blend(a: number, weightA: number, b: number, weightB: number): number {
  return Math.round(a * weightA + b * weightB);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
