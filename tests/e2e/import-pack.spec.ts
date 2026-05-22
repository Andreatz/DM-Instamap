import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Playwright esegue dalla root del repository (dove vive playwright.config.ts).
const REPO_ROOT = process.cwd();
const FIXTURE_PACK = path.join(REPO_ROOT, "tests", "fixtures", "asset-pack");
const MANIFEST_PATH = path.join(
  REPO_ROOT,
  "data",
  "indexes",
  "assets.manifest.json"
);

test("import-pack indexes a versioned fixture and restores prior state", async ({
  request
}) => {
  // Snapshot the manifest so the test never clobbers a local asset library.
  const manifestExisted = existsSync(MANIFEST_PATH);
  const previousManifest = manifestExisted
    ? readFileSync(MANIFEST_PATH, "utf8")
    : null;

  try {
    const response = await request.post("/api/assets/import-pack", {
      data: {
        assetRoot: FIXTURE_PACK,
        defaultTags: ["playwright-fixture"],
        preset: "generic"
      }
    });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      summary: { assetCount: number; preset: string };
    };
    expect(body.ok).toBe(true);
    expect(body.summary.preset).toBe("generic");
    // The fixture ships exactly two synthetic PNGs.
    expect(body.summary.assetCount).toBe(2);
  } finally {
    if (manifestExisted && previousManifest !== null) {
      mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
      writeFileSync(MANIFEST_PATH, previousManifest, "utf8");
    } else if (existsSync(MANIFEST_PATH)) {
      rmSync(MANIFEST_PATH);
    }
  }
});
