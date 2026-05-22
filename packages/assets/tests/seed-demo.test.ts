import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEMO_ASSETS,
  createDemoAssets,
  seedDemoLibrary
} from "../src/cli/seed-demo";

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "dm-demo-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { force: true, recursive: true });
    }
  }
});

describe("demo dataset", () => {
  it("defines unique synthetic placeholder assets", () => {
    expect(DEMO_ASSETS.length).toBeGreaterThanOrEqual(6);
    const names = new Set(DEMO_ASSETS.map((asset) => asset.name));
    expect(names.size).toBe(DEMO_ASSETS.length);
  });

  it("creates the placeholder PNG files", async () => {
    const dir = tempDir();
    const files = await createDemoAssets(dir);

    expect(files).toHaveLength(DEMO_ASSETS.length);
    for (const file of files) {
      expect(existsSync(file)).toBe(true);
    }
  });

  it("seeds a usable local asset manifest", async () => {
    const workspace = tempDir();
    const result = await seedDemoLibrary(workspace);

    expect(result.assetCount).toBe(DEMO_ASSETS.length);
    expect(
      existsSync(
        path.join(workspace, "data", "indexes", "assets.manifest.json")
      )
    ).toBe(true);
  });
});
