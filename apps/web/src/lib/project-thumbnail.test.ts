import { describe, expect, it } from "vitest";
import type { MapDocument } from "@dm-instamap/core/server";
import { buildProjectThumbnailSvg } from "./project-thumbnail";

function makeDocument(overrides: Record<string, unknown>): MapDocument {
  return {
    assets: [],
    height: 4,
    id: "doc-1",
    name: "Test",
    plan: { doors: [], gmNotes: [], initiative: [], lights: [], rooms: [], walls: [] },
    tiles: [],
    width: 4,
    ...overrides
  } as unknown as MapDocument;
}

describe("project thumbnail", () => {
  it("emits an svg with a viewBox scaled by the cell size", () => {
    const svg = buildProjectThumbnailSvg(makeDocument({ width: 4, height: 4 }), { cell: 8 });

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).toContain(`fill="#0f1214"`);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("run-length merges adjacent floor tiles into a single rect", () => {
    const svg = buildProjectThumbnailSvg(
      makeDocument({
        tiles: [
          { kind: "floor", x: 0, y: 0 },
          { kind: "floor", x: 1, y: 0 },
          { kind: "floor", x: 2, y: 0 }
        ]
      }),
      { cell: 8 }
    );

    // three contiguous floor cells -> one rect of width 24 at x=0
    expect(svg).toContain(`<rect x="0" y="0" width="24" height="8" fill="#a88d5d"/>`);
    expect((svg.match(/fill="#a88d5d"/gu) ?? []).length).toBe(1);
  });

  it("draws room outlines with no fill", () => {
    const svg = buildProjectThumbnailSvg(
      makeDocument({
        plan: {
          doors: [],
          gmNotes: [],
          initiative: [],
          lights: [],
          rooms: [{ bounds: { height: 2, width: 2, x: 1, y: 1 }, id: "r1", kind: "room", label: "Sala", tags: [] }],
          walls: []
        }
      }),
      { cell: 8 }
    );

    expect(svg).toContain(`<rect x="8" y="8" width="16" height="16" fill="none"`);
  });
});
