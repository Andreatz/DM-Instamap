import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { importDd2Vtt } from "../src";

const ASSERT = { numRuns: 300, seed: 0xd2_d2 } as const;

describe("importDd2Vtt robustness", () => {
  it("throws a clear error on invalid JSON instead of a raw SyntaxError", () => {
    expect(() => importDd2Vtt("{not json")).toThrow(/not valid JSON/u);
    expect(() => importDd2Vtt("")).toThrow(/not valid JSON/u);
  });

  it("rejects non-object payloads with a clear message", () => {
    expect(() => importDd2Vtt("[]")).toThrow(/must be a JSON object/u);
    expect(() => importDd2Vtt("42")).toThrow(/must be a JSON object/u);
    expect(() => importDd2Vtt("null")).toThrow(/must be a JSON object/u);
  });

  it("clamps absurd grid dimensions instead of allocating billions of tiles", () => {
    const result = importDd2Vtt({
      resolution: { map_size: { x: 1e9, y: 1e9 }, pixels_per_grid: 70 }
    });

    // Bounded by MAX_IMPORT_GRID_DIMENSION (1024) on each side.
    expect(result.document.width).toBeLessThanOrEqual(1024);
    expect(result.document.height).toBeLessThanOrEqual(1024);
    expect(result.document.tiles.length).toBeLessThanOrEqual(1024 * 1024);
  });

  it("ignores NaN/Infinity and negative dimensions", () => {
    const result = importDd2Vtt({
      resolution: {
        map_size: { x: Number.POSITIVE_INFINITY, y: -5 },
        pixels_per_grid: 70
      }
    });

    expect(result.document.width).toBeGreaterThanOrEqual(1);
    expect(result.document.height).toBeGreaterThanOrEqual(1);
  });

  it("never crashes on arbitrary object payloads", () => {
    fc.assert(
      fc.property(fc.object({ maxDepth: 3, maxKeys: 8 }), (payload) => {
        const result = importDd2Vtt(payload);
        // Always returns an editable document with a positive grid.
        expect(result.document.width).toBeGreaterThanOrEqual(1);
        expect(result.document.height).toBeGreaterThanOrEqual(1);
        expect(result.document.tiles.length).toBeGreaterThan(0);
      }),
      ASSERT
    );
  });

  it("never crashes on arbitrary string payloads", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        // Either parses (valid JSON object) or throws a handled Error.
        try {
          importDd2Vtt(text);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }),
      ASSERT
    );
  });
});
