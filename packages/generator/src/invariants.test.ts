import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  generateCaveDungeon,
  generateMultiFloorDungeon,
  generateOutdoorMap,
  generateVillageMap
} from "./algorithms";
import { generateDungeon } from "./index";
import { checkMapInvariants, checkMultiFloorInvariants } from "./invariants";

const RUNS = 200;
const TIMEOUT = 120_000;
// Fixed fast-check seed: deterministic and reproducible in CI (no flakiness).
const ASSERT = { numRuns: RUNS, seed: 0xc0_ffee };
const seedArb = fc.integer({ max: 2_147_483_646, min: 0 });

describe("generator playability invariants (property-based)", () => {
  it(
    "generateDungeon holds across varied inputs",
    () => {
      fc.assert(
        fc.property(
          fc.integer({ max: 56, min: 24 }),
          fc.integer({ max: 40, min: 18 }),
          fc.integer({ max: 9, min: 3 }),
          (widthCells, heightCells, roomCount) => {
            const document = generateDungeon({
              heightCells,
              roomCount,
              theme: "test",
              widthCells
            });
            expect(checkMapInvariants(document).violations).toEqual([]);
          }
        ),
        ASSERT
      );
    },
    TIMEOUT
  );

  it(
    "generateCaveDungeon holds across seeds",
    () => {
      fc.assert(
        fc.property(seedArb, (seed) => {
          const document = generateCaveDungeon({
            heightCells: 32,
            seed,
            theme: "cave",
            widthCells: 44
          });
          expect(checkMapInvariants(document).violations).toEqual([]);
        }),
        ASSERT
      );
    },
    TIMEOUT
  );

  it(
    "generateVillageMap holds across seeds",
    () => {
      fc.assert(
        fc.property(
          seedArb,
          fc.integer({ max: 12, min: 3 }),
          (seed, blocks) => {
            const document = generateVillageMap({
              blockCount: blocks,
              heightCells: 36,
              seed,
              theme: "village",
              widthCells: 48
            });
            expect(checkMapInvariants(document).violations).toEqual([]);
          }
        ),
        ASSERT
      );
    },
    TIMEOUT
  );

  it(
    "generateOutdoorMap holds across seeds",
    () => {
      fc.assert(
        fc.property(seedArb, fc.boolean(), (seed, river) => {
          const document = generateOutdoorMap({
            heightCells: 32,
            river,
            seed,
            theme: "camp",
            treeDensity: 0.12,
            widthCells: 46
          });
          expect(checkMapInvariants(document).violations).toEqual([]);
        }),
        ASSERT
      );
    },
    TIMEOUT
  );

  it(
    "generateMultiFloorDungeon holds across seeds",
    () => {
      fc.assert(
        fc.property(
          seedArb,
          fc.integer({ max: 5, min: 2 }),
          (seed, floorCount) => {
            const result = generateMultiFloorDungeon({
              floorCount,
              heightCells: 30,
              seed,
              theme: "dungeon",
              widthCells: 44
            });
            expect(checkMultiFloorInvariants(result).violations).toEqual([]);
          }
        ),
        ASSERT
      );
    },
    TIMEOUT
  );
});
