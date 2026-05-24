/**
 * Hard validation gate for the final manifest. `validateManifest` returns a
 * structured result; CLIs translate a failing result into a non-zero exit code.
 */

import { isSuspiciousLight } from "./find-assets";
import type { AssetManifestItem, MacroCategory } from "./schema";

export type ValidateOptions = {
  /** Maximum allowed share of `unknown` assets (0..1). Default 0.1. */
  maxUnknownRatio?: number;
};

export type ValidationIssue = {
  code: string;
  message: string;
  examples?: string[];
};

export type ValidationResult = {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

const REQUIRED_CATEGORIES: MacroCategory[] = [
  "floor",
  "wall",
  "furniture",
  "light",
  "decoration",
  "terrain"
];

export function validateManifest(
  items: AssetManifestItem[],
  options: ValidateOptions = {}
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const maxUnknownRatio = options.maxUnknownRatio ?? 0.1;

  if (items.length === 0) {
    errors.push({ code: "empty-manifest", message: "Il manifest è vuoto." });
    return { ok: false, errors, warnings };
  }

  // Suspicious lights (carpet/rug/runner/tapestry/banner as light).
  const suspiciousLights = items.filter(isSuspiciousLight);
  if (suspiciousLights.length > 0) {
    errors.push({
      code: "suspicious-light",
      message: `${suspiciousLights.length} light con carpet/rug/runner/tapestry/banner nel path.`,
      examples: suspiciousLights.slice(0, 10).map((item) => item.path)
    });
  }

  // Missing id / path.
  const missingIdentity = items.filter((item) => !item.id || !item.path);
  if (missingIdentity.length > 0) {
    errors.push({
      code: "missing-identity",
      message: `${missingIdentity.length} asset senza id o path.`,
      examples: missingIdentity
        .slice(0, 10)
        .map((item) => item.path || "(no path)")
    });
  }

  // Duplicate ids.
  const idCounts = new Map<string, number>();
  for (const item of items) {
    idCounts.set(item.id, (idCounts.get(item.id) ?? 0) + 1);
  }
  const duplicateIds = [...idCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
  if (duplicateIds.length > 0) {
    errors.push({
      code: "duplicate-ids",
      message: `${duplicateIds.length} id duplicati.`,
      examples: duplicateIds.slice(0, 10)
    });
  }

  // Required fundamental categories must be present.
  const presentCategories = new Set(items.map((item) => item.macroCategory));
  const missingCategories = REQUIRED_CATEGORIES.filter(
    (category) => !presentCategories.has(category)
  );
  if (missingCategories.length > 0) {
    errors.push({
      code: "missing-categories",
      message: `Mancano categorie fondamentali: ${missingCategories.join(", ")}.`
    });
  }

  // Unknown ratio threshold.
  const unknownCount = items.filter(
    (item) => item.macroCategory === "unknown"
  ).length;
  const unknownRatio = unknownCount / items.length;
  if (unknownRatio > maxUnknownRatio) {
    errors.push({
      code: "too-many-unknown",
      message: `Troppi asset unknown: ${unknownCount}/${items.length} (${(unknownRatio * 100).toFixed(1)}% > soglia ${(maxUnknownRatio * 100).toFixed(1)}%).`
    });
  } else if (unknownCount > 0) {
    warnings.push({
      code: "unknown-present",
      message: `${unknownCount} asset unknown (entro soglia), tenuti come needs-review.`
    });
  }

  return { ok: errors.length === 0, errors, warnings };
}
