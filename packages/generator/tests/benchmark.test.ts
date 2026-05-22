import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { computeDocumentContentHash } from "@dm-instamap/core/server";
import { describe, expect, it } from "vitest";
import {
  BENCHMARK_SCENARIOS,
  computeBenchmarkMetrics,
  runBenchmarkScenario,
  runBenchmarks,
  scoreMapQuality,
  type BenchmarkMetrics
} from "../src";

type BenchmarkSummaryFixture = {
  contentHash: string;
  id: string;
  metrics: BenchmarkMetrics;
  rating: string;
  roomCount: number;
  score: number;
  size: { height: number; width: number };
};

function readSummary(id: string): BenchmarkSummaryFixture {
  const url = new URL(
    `./fixtures/benchmark/${id}.summary.json`,
    import.meta.url
  );
  return JSON.parse(
    readFileSync(fileURLToPath(url), "utf8")
  ) as BenchmarkSummaryFixture;
}

describe("generator benchmark", () => {
  it("covers the DM scenarios", () => {
    expect(BENCHMARK_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      "crypt",
      "boss-dungeon",
      "ruin",
      "cave",
      "village",
      "camp",
      "tavern",
      "temple",
      "fortress"
    ]);
  });

  it("produces deterministic, byte-identical documents across runs", () => {
    const first = runBenchmarks();
    const second = runBenchmarks();

    for (let index = 0; index < first.length; index += 1) {
      expect(JSON.stringify(second[index]?.document)).toBe(
        JSON.stringify(first[index]?.document)
      );
    }
  });

  it("keeps every scenario above its quality thresholds", () => {
    for (const result of runBenchmarks()) {
      expect(
        result.failures,
        `${result.label}: ${result.failures.join("; ")}`
      ).toEqual([]);
      expect(result.passed).toBe(true);
    }
  });

  it("freezes at least eight golden maps rated strong", () => {
    const strong = runBenchmarks().filter(
      (result) => result.quality.rating === "strong"
    );
    expect(strong.length).toBeGreaterThanOrEqual(8);
  });

  it("matches the recorded seed-based fixtures (regression guard)", () => {
    for (const result of runBenchmarks()) {
      const fixture = readSummary(result.id);
      expect(result.size).toEqual(fixture.size);
      expect(result.roomCount).toBe(fixture.roomCount);
      expect(result.quality.score).toBe(fixture.score);
      expect(result.quality.rating).toBe(fixture.rating);
      expect(result.metrics).toEqual(fixture.metrics);
      expect(computeDocumentContentHash(result.document)).toBe(
        fixture.contentHash
      );
    }
  });

  it("fails a scenario when thresholds are not met", () => {
    const scenario = BENCHMARK_SCENARIOS[0];
    if (!scenario) {
      throw new Error("missing scenario");
    }

    const impossible = runBenchmarkScenario({
      ...scenario,
      thresholds: { minScore: 101 }
    });
    expect(impossible.passed).toBe(false);
    expect(impossible.failures[0]).toMatch(/sotto la soglia 101/);
  });

  it("derives six bounded metrics", () => {
    const document = BENCHMARK_SCENARIOS[0]?.build();
    if (!document) {
      throw new Error("missing scenario document");
    }

    const metrics = computeBenchmarkMetrics(
      document,
      "crypt",
      scoreMapQuality(document)
    );
    for (const value of Object.values(metrics)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});
