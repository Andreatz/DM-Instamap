import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BENCHMARK_SCENARIOS,
  benchmarkMetricLabel,
  runBenchmarks,
  type BenchmarkMetricKey
} from "../benchmark";

const METRIC_ORDER: BenchmarkMetricKey[] = [
  "themeAlignment",
  "roomVariety",
  "assetDensity",
  "routing",
  "readability",
  "tacticalAffordance"
];

function main(): void {
  const write = process.argv.includes("--write");
  const results = runBenchmarks();

  process.stdout.write("\nDM-Instamap - Benchmark generatore\n");
  process.stdout.write(`Scenari: ${results.length}\n\n`);

  const header = [
    "Scenario",
    "Dim",
    "Stanze",
    "Score",
    "Rating",
    ...METRIC_ORDER.map(benchmarkMetricLabel),
    "Esito"
  ];
  process.stdout.write(`${header.join(" | ")}\n`);
  process.stdout.write(`${header.map(() => "---").join(" | ")}\n`);

  let failed = 0;

  for (const result of results) {
    if (!result.passed) {
      failed += 1;
    }

    const row = [
      result.label,
      `${result.size.width}x${result.size.height}`,
      String(result.roomCount),
      String(result.quality.score),
      result.quality.rating,
      ...METRIC_ORDER.map((key) => String(result.metrics[key])),
      result.passed ? "OK" : "FAIL"
    ];
    process.stdout.write(`${row.join(" | ")}\n`);
  }

  process.stdout.write("\n");

  for (const result of results) {
    if (result.failures.length > 0) {
      process.stdout.write(
        `! ${result.label}: ${result.failures.join("; ")}\n`
      );
    }
  }

  if (write) {
    const outDir = path.join(process.cwd(), "tests", "fixtures", "benchmark");
    mkdirSync(outDir, { recursive: true });

    for (const result of results) {
      const scenario = BENCHMARK_SCENARIOS.find(
        (candidate) => candidate.id === result.id
      );
      const summary = {
        id: result.id,
        label: result.label,
        metrics: result.metrics,
        rating: result.quality.rating,
        roomCount: result.roomCount,
        score: result.quality.score,
        size: result.size,
        theme: result.theme,
        thresholds: scenario?.thresholds ?? null
      };
      writeFileSync(
        path.join(outDir, `${result.id}.summary.json`),
        `${JSON.stringify(summary, null, 2)}\n`,
        "utf8"
      );
    }

    process.stdout.write(
      `Scritte ${results.length} sintesi in ${path.relative(process.cwd(), outDir)}\n`
    );
  }

  process.stdout.write(
    `\n${results.length - failed}/${results.length} scenari sopra soglia.\n`
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
