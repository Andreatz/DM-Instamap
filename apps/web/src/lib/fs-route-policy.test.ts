import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guard test (Fase F): ogni route handler che tocca il filesystem in modo
 * grezzo (import di `node:fs`) deve passare dalla policy path condivisa
 * (`@/lib/local-paths`). Impedisce che nuove route leggano/scrivano su disco
 * senza validare path/id, riaprendo buchi di path traversal.
 */

const APP_DIR = path.resolve(fileURLToPath(new URL("../app", import.meta.url)));

function findRouteFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...findRouteFiles(fullPath));
    } else if (entry.name === "route.ts") {
      files.push(fullPath);
    }
  }

  return files;
}

const RAW_FS_IMPORT = /from\s+["']node:fs(\/promises)?["']/u;
const USES_POLICY =
  /from\s+["']@\/lib\/local-paths["']|validateLocalPath|resolveWithinWorkspace|assertSafeWorkspaceId/u;

describe("filesystem route policy", () => {
  const routeFiles = findRouteFiles(APP_DIR);

  it("finds the route handlers to inspect", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it("requires raw-fs routes to use the shared path policy", () => {
    const offenders: string[] = [];

    for (const file of routeFiles) {
      const source = readFileSync(file, "utf8");

      if (RAW_FS_IMPORT.test(source) && !USES_POLICY.test(source)) {
        offenders.push(path.relative(APP_DIR, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
