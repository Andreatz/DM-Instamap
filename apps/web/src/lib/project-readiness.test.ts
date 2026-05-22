import { describe, expect, it } from "vitest";
import type { MapDocument } from "@dm-instamap/core/server";
import {
  RECOMMENDED_EXPORTS,
  computeProjectReadiness
} from "./project-readiness";

function makeDocument(overrides: Record<string, unknown>): MapDocument {
  return {
    assets: [],
    height: 10,
    id: "doc-1",
    name: "Test",
    plan: {
      doors: [],
      gmNotes: [],
      initiative: [],
      lights: [],
      rooms: [],
      walls: []
    },
    tiles: [],
    width: 10,
    ...overrides
  } as unknown as MapDocument;
}

describe("project readiness", () => {
  it("flags an empty document as not session ready", () => {
    const readiness = computeProjectReadiness(
      makeDocument({ plan: undefined })
    );

    expect(readiness.isSessionReady).toBe(false);
    expect(readiness.requiredPassed).toBe(0);
    expect(readiness.requiredTotal).toBe(4);
    expect(readiness.score).toBe(0);
  });

  it("marks a structured map with floor, walls, rooms and entrance as ready", () => {
    const readiness = computeProjectReadiness(
      makeDocument({
        tiles: [
          { kind: "floor", x: 1, y: 1 },
          { kind: "wall", x: 0, y: 0 }
        ],
        plan: {
          doors: [],
          gmNotes: [],
          initiative: [],
          lights: [],
          rooms: [
            {
              bounds: { height: 3, width: 3, x: 0, y: 0 },
              id: "r1",
              kind: "entrance",
              label: "Ingresso",
              tags: []
            },
            {
              bounds: { height: 3, width: 3, x: 4, y: 4 },
              id: "r2",
              kind: "room",
              label: "Sala",
              tags: []
            }
          ],
          walls: []
        }
      })
    );

    expect(readiness.isSessionReady).toBe(true);
    expect(readiness.requiredPassed).toBe(4);
    expect(
      readiness.checks.find((check) => check.id === "room-labels")?.passed
    ).toBe(true);
    expect(
      readiness.checks.find((check) => check.id === "lighting")?.passed
    ).toBe(false);
    expect(readiness.recommendedPassed).toBe(1);
  });

  it("passes the walls check when wall segments exist without wall tiles", () => {
    const readiness = computeProjectReadiness(
      makeDocument({
        tiles: [{ kind: "floor", x: 1, y: 1 }],
        plan: {
          doors: [],
          gmNotes: [],
          initiative: [],
          lights: [],
          rooms: [
            {
              bounds: { height: 2, width: 2, x: 0, y: 0 },
              id: "r1",
              kind: "entrance",
              label: "Ingresso",
              tags: []
            }
          ],
          walls: [
            {
              end: { x: 2, y: 0 },
              id: "w1",
              start: { x: 0, y: 0 },
              thickness: 1
            }
          ]
        }
      })
    );

    expect(readiness.checks.find((check) => check.id === "walls")?.passed).toBe(
      true
    );
    expect(readiness.isSessionReady).toBe(true);
  });

  it("exposes recommended exports with the session pack first", () => {
    expect(RECOMMENDED_EXPORTS[0]?.format).toBe("session-pack");
    expect(
      RECOMMENDED_EXPORTS.some(
        (preset) => preset.format === "png" && preset.mode === "player"
      )
    ).toBe(true);
  });
});
