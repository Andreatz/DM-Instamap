/**
 * Pure audit logic over a list of manifest items. Produces per-check counts and
 * a few examples; no filesystem access (file-existence is signalled earlier via
 * the `missing-file` quality flag during metadata enrichment).
 */

import { isSuspiciousLight } from "./find-assets";
import type { AssetManifestItem } from "./schema";

export type AuditCheck = {
  id: string;
  label: string;
  count: number;
  examples: string[];
};

export type AuditReport = {
  generatedAt: string;
  totalAssets: number;
  checks: AuditCheck[];
};

const ANTI_LIGHT_KEYWORDS = ["carpet", "rug", "runner", "tapestry", "banner"];
const TINY_PIXELS = 16;

export function auditManifest(items: AssetManifestItem[]): AuditReport {
  const seenPaths = new Map<string, number>();
  for (const item of items) {
    seenPaths.set(item.path, (seenPaths.get(item.path) ?? 0) + 1);
  }
  const duplicatePaths = [...seenPaths.entries()]
    .filter(([, count]) => count > 1)
    .map(([path]) => path);

  const checks: AuditCheck[] = [
    collect(items, "missing-files", "File mancanti sul disco", (item) =>
      item.qualityFlags.includes("missing-file")
    ),
    collect(items, "corrupt", "Asset corrotti / illeggibili", (item) =>
      item.qualityFlags.includes("corrupt")
    ),
    collect(
      items,
      "unknown",
      "Asset con macroCategory unknown",
      (item) => item.macroCategory === "unknown"
    ),
    collect(
      items,
      "no-source-tags",
      "Asset senza sourceTags",
      (item) => item.sourceTags.length === 0
    ),
    {
      id: "duplicate-paths",
      label: "Path duplicati",
      count: duplicatePaths.length,
      examples: duplicatePaths.slice(0, 10)
    },
    collect(items, "suspicious-light", "Light sospette", (item) =>
      isSuspiciousLight(item)
    ),
    collect(
      items,
      "carpet-as-light",
      "Carpet/rug/runner/banner classificati come light",
      (item) => item.macroCategory === "light" && hasAntiLightKeyword(item)
    ),
    collect(
      items,
      "category-conflict",
      "Asset con conflitto di categoria",
      (item) => item.qualityFlags.includes("multi-category-conflict")
    ),
    collect(items, "tiny", "Asset molto piccoli", (item) => isTiny(item)),
    collect(
      items,
      "opaque-detail-asset",
      "Furniture/prop/light senza trasparenza (sospetto)",
      (item) =>
        ["furniture", "prop", "light"].includes(item.macroCategory) &&
        item.metadata.hasTransparency === false
    ),
    collect(
      items,
      "vm-path-not-marked",
      "Path con VM non marcato come sourcePack VM",
      (item) =>
        /(^|[^a-z])vm([^a-z]|$)/iu.test(item.path) &&
        !item.sourcePacks.includes("VM")
    )
  ];

  return {
    generatedAt: new Date().toISOString(),
    totalAssets: items.length,
    checks
  };
}

export function renderAuditMarkdown(report: AuditReport): string {
  const lines: string[] = [];
  lines.push("# DM-Instamap — Audit manifest asset");
  lines.push("");
  lines.push(`Generato: ${report.generatedAt}`);
  lines.push("");
  lines.push(`Asset totali: **${report.totalAssets}**`);
  lines.push("");
  lines.push("| Controllo | Asset |");
  lines.push("|---|---:|");
  for (const check of report.checks) {
    lines.push(`| ${check.label} | ${check.count} |`);
  }
  lines.push("");

  for (const check of report.checks) {
    if (check.count === 0) {
      continue;
    }
    lines.push(`## ${check.label} (${check.count})`);
    lines.push("");
    for (const example of check.examples) {
      lines.push(`- \`${example}\``);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function collect(
  items: AssetManifestItem[],
  id: string,
  label: string,
  predicate: (item: AssetManifestItem) => boolean
): AuditCheck {
  const matches = items.filter(predicate);
  return {
    id,
    label,
    count: matches.length,
    examples: matches.slice(0, 10).map((item) => item.path)
  };
}

function hasAntiLightKeyword(item: AssetManifestItem): boolean {
  const haystack = [item.path.toLowerCase(), ...item.assetGroups];
  return ANTI_LIGHT_KEYWORDS.some((keyword) =>
    haystack.some((value) => value.includes(keyword))
  );
}

function isTiny(item: AssetManifestItem): boolean {
  const { width, height } = item.metadata;
  if (typeof width !== "number" || typeof height !== "number") {
    return false;
  }
  return width < TINY_PIXELS || height < TINY_PIXELS;
}
