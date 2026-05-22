import type { MapDocument } from "@dm-instamap/core";
import type { FurnishingDensity } from "./furnishing";

export type StyleDensityBias = "sparse" | "normal" | "rich";
export type StyleLayoutBias = "compact" | "balanced" | "sprawling";

/**
 * A compact, generator-local distillation of a Reference Style DNA. It carries
 * only the levers the generator can act on deterministically: palette tags,
 * how densely to dress rooms, and a layout intent.
 */
export type StyleDnaHint = {
  densityBias?: StyleDensityBias;
  layoutBias?: StyleLayoutBias;
  paletteTags?: string[];
};

/** Maps the style density bias onto the furnishing density used by autoFurnishMap. */
export function deriveFurnishingDensity(dna: StyleDnaHint | undefined): FurnishingDensity {
  switch (dna?.densityBias) {
    case "sparse":
      return "sparse";
    case "rich":
      return "rich";
    case "normal":
    default:
      return "normal";
  }
}

/**
 * Applies palette and layout intent from a Style DNA onto a generated document:
 * palette tags are merged into every room (influencing asset matching and theme
 * alignment) and the density/layout intent is recorded in the plan notes so the
 * choice is auditable. Pure and deterministic.
 */
export function applyStyleDna(document: MapDocument, dna: StyleDnaHint | undefined): MapDocument {
  if (!dna || !document.plan) {
    return document;
  }

  const paletteTags = unique((dna.paletteTags ?? []).map((tag) => tag.toLowerCase()));
  const styleNote = describeStyleDna(dna);
  const rooms = paletteTags.length
    ? document.plan.rooms.map((room) => ({ ...room, tags: unique([...room.tags, ...paletteTags]) }))
    : document.plan.rooms;

  return {
    ...document,
    plan: {
      ...document.plan,
      notes: unique([...document.plan.notes, styleNote]),
      rooms
    }
  };
}

export function describeStyleDna(dna: StyleDnaHint): string {
  const palette = dna.paletteTags && dna.paletteTags.length > 0 ? dna.paletteTags.join(", ") : "nessuna";
  return `Style DNA - densita: ${dna.densityBias ?? "normal"}, layout: ${dna.layoutBias ?? "balanced"}, palette: ${palette}.`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
