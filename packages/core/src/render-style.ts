/**
 * Render style presets for the "artistic-battlemap" rendering mode.
 *
 * These are pure data + selection helpers shared by the export raster renderer
 * and the editor canvas, so both produce a consistent illustrated look driven
 * by the same palette, light clamps and grid settings. No DOM/Node deps here.
 */

export const RENDER_STYLE_PRESETS = [
  "dark-warm-crypt",
  "tavern-topdown",
  "cold-dungeon",
  "cave-natural"
] as const;

export type RenderStylePresetId = (typeof RENDER_STYLE_PRESETS)[number];

export type RenderTextureMode = "texture" | "procedural";

export type RenderPalette = {
  /** Inner backdrop colour. */
  background: string;
  /** Outer backdrop colour (vignette edge). */
  backgroundEdge: string;
  /** Base floor colour. */
  floor: string;
  /** Floor variation colour used by the procedural noise. */
  floorAlt: string;
  /** Base wall colour. */
  wall: string;
  /** Wall border/shadow colour. */
  wallBorder: string;
  /** Warm light/accent (torches). */
  accentWarm: string;
  /** Cool light/accent (magic). */
  accentCool: string;
};

export type RenderStylePreset = {
  id: RenderStylePresetId;
  label: string;
  palette: RenderPalette;
  /** Strength of procedural noise/shadow detail, 0..1. */
  contrast: number;
  /** Grid line opacity; kept very low so the grid stays discreet. */
  gridOpacity: number;
  floorTextureMode: RenderTextureMode;
  wallTextureMode: RenderTextureMode;
  /** How warm baked light tints are, 0 (neutral) .. 1 (very warm). */
  lightWarmth: number;
  /** Suggested furniture density hint, 0..1. */
  propDensity: number;
  /** Suggested small-clutter density hint, 0..1. */
  clutterDensity: number;
  /** Max baked intensity for torch/fire lights. */
  torchMaxIntensity: number;
  /** Max baked intensity for magic lights. */
  magicMaxIntensity: number;
  /** Max glow radius in cells, so a light never floods a whole room. */
  lightRadiusCapCells: number;
};

const PRESETS: Record<RenderStylePresetId, RenderStylePreset> = {
  "dark-warm-crypt": {
    id: "dark-warm-crypt",
    label: "Cripta calda scura",
    palette: {
      background: "#1b1715",
      backgroundEdge: "#100d0c",
      floor: "#3b342b",
      floorAlt: "#322c24",
      wall: "#232220",
      wallBorder: "#0e0d0c",
      accentWarm: "#ff7a28",
      accentCool: "#b58cff"
    },
    contrast: 0.55,
    gridOpacity: 0.08,
    floorTextureMode: "procedural",
    wallTextureMode: "procedural",
    lightWarmth: 0.6,
    propDensity: 0.7,
    clutterDensity: 0.8,
    torchMaxIntensity: 0.45,
    magicMaxIntensity: 0.55,
    lightRadiusCapCells: 6
  },
  "tavern-topdown": {
    id: "tavern-topdown",
    label: "Taverna dall'alto",
    palette: {
      background: "#1c1611",
      backgroundEdge: "#120d09",
      floor: "#54402a",
      floorAlt: "#493521",
      wall: "#2a2018",
      wallBorder: "#130d08",
      accentWarm: "#ffb15c",
      accentCool: "#c9a14a"
    },
    contrast: 0.45,
    gridOpacity: 0.06,
    floorTextureMode: "procedural",
    wallTextureMode: "procedural",
    lightWarmth: 0.75,
    propDensity: 0.85,
    clutterDensity: 0.9,
    torchMaxIntensity: 0.45,
    magicMaxIntensity: 0.5,
    lightRadiusCapCells: 5
  },
  "cold-dungeon": {
    id: "cold-dungeon",
    label: "Dungeon freddo",
    palette: {
      background: "#141619",
      backgroundEdge: "#0b0d0f",
      floor: "#34383c",
      floorAlt: "#2c3033",
      wall: "#202327",
      wallBorder: "#0d0f11",
      accentWarm: "#ffb15c",
      accentCool: "#6fa8d6"
    },
    contrast: 0.5,
    gridOpacity: 0.07,
    floorTextureMode: "procedural",
    wallTextureMode: "procedural",
    lightWarmth: 0.45,
    propDensity: 0.65,
    clutterDensity: 0.6,
    torchMaxIntensity: 0.45,
    magicMaxIntensity: 0.55,
    lightRadiusCapCells: 6
  },
  "cave-natural": {
    id: "cave-natural",
    label: "Caverna naturale",
    palette: {
      background: "#14110d",
      backgroundEdge: "#0a0805",
      floor: "#3a3026",
      floorAlt: "#312a20",
      wall: "#241d15",
      wallBorder: "#0d0a07",
      accentWarm: "#ff944d",
      accentCool: "#79c2a0"
    },
    contrast: 0.6,
    gridOpacity: 0.05,
    floorTextureMode: "procedural",
    wallTextureMode: "procedural",
    lightWarmth: 0.55,
    propDensity: 0.5,
    clutterDensity: 0.7,
    torchMaxIntensity: 0.45,
    magicMaxIntensity: 0.55,
    lightRadiusCapCells: 7
  }
};

export const DEFAULT_RENDER_PRESET: RenderStylePresetId = "cold-dungeon";

export type RenderStyleHint = {
  densityBias?: string | null;
  paletteTags?: readonly string[];
  tags?: readonly string[];
  theme?: string | null;
};

/** Look up a preset by id (falls back to the default for unknown ids). */
export function getRenderPreset(
  id: RenderStylePresetId | string | undefined
): RenderStylePreset {
  return (
    PRESETS[(id ?? "") as RenderStylePresetId] ?? PRESETS[DEFAULT_RENDER_PRESET]
  );
}

/**
 * Choose a preset from a Reference Style DNA hint (theme/tags/palette). Crypts
 * and cathedrals map to the warm crypt look; taverns and caves to their themes;
 * everything else to the neutral cold dungeon.
 */
export function deriveRenderPreset(
  hint?: RenderStyleHint
): RenderStylePresetId {
  const tokens = [
    hint?.theme ?? "",
    ...(hint?.tags ?? []),
    ...(hint?.paletteTags ?? [])
  ]
    .join(" ")
    .toLowerCase();

  if (
    /crypt|cripta|cathedral|cattedrale|tomb|sepolcr|undead|necro|ossuar/u.test(
      tokens
    )
  ) {
    return "dark-warm-crypt";
  }
  if (/tavern|taverna|\binn\b|wood|legno|locanda/u.test(tokens)) {
    return "tavern-topdown";
  }
  if (/cave|caverna|grotto|grotta|cavern|natural/u.test(tokens)) {
    return "cave-natural";
  }
  return "cold-dungeon";
}

/**
 * Clamp a light intensity to the preset's cap for its kind, so baked lights
 * never blow out into white blobs.
 */
export function clampLightIntensity(
  intensity: number,
  kind: string | undefined,
  preset: RenderStylePreset
): number {
  const cap =
    kind === "magic" ? preset.magicMaxIntensity : preset.torchMaxIntensity;
  if (!Number.isFinite(intensity) || intensity < 0) {
    return 0;
  }
  return Math.min(cap, intensity);
}

/** Warm amber used for torch/lantern/fire lights in artistic mode. */
export const ARTISTIC_WARM_LIGHT = "#ff9f4a";

/**
 * Final artistic light parameters: a soft warm glow with a low alpha peak and a
 * small radius, shared verbatim by the editor canvas and the export renderer.
 */
export type ArtisticLightStyle = {
  /** Peak glow alpha (never high enough to read as a white/red blob). */
  alpha: number;
  /** Resolved hex colour (warm amber for fire, base colour for magic). */
  color: string;
  /** Max glow radius in cells. */
  radiusCells: number;
};

/** A near-pure-red colour reads as a debug overlay, not real light. */
function isDebugRed(hex: string): boolean {
  const c = parseHex6(hex);
  if (!c) {
    return false;
  }
  return c.r > 170 && c.g < 90 && c.b < 90;
}

function parseHex6(hex: string): { b: number; g: number; r: number } | null {
  const match = /^#?([0-9a-f]{6})$/iu.exec(hex.trim());
  if (!match?.[1]) {
    return null;
  }
  const value = Number.parseInt(match[1], 16);
  return { b: value & 0xff, g: (value >> 8) & 0xff, r: (value >> 16) & 0xff };
}

function normalizeHex6(hex: string): string | null {
  const match = /^#?([0-9a-f]{6})$/iu.exec(hex.trim());
  return match?.[1] ? `#${match[1].toLowerCase()}` : null;
}

/**
 * Resolve the artistic glow style for a light. Torch/lantern/fire (and any
 * unknown kind) always become a contained warm amber — never red, never a white
 * core. Magic keeps its own hue (e.g. blue/purple) but pure-red magic is also
 * normalised to amber so a debug "#ff0000" never floods the scene.
 */
export function artisticLightStyle(
  kind: string | undefined,
  baseColor: string
): ArtisticLightStyle {
  if (kind === "magic") {
    const normalized = normalizeHex6(baseColor);
    const color =
      !normalized || isDebugRed(baseColor) ? ARTISTIC_WARM_LIGHT : normalized;
    return { alpha: 0.32, color, radiusCells: 4 };
  }
  return { alpha: 0.26, color: ARTISTIC_WARM_LIGHT, radiusCells: 3.5 };
}
