import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createAssetManifestResolver } from "../src";

const tempDirs: string[] = [];

function workspace(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "dm-resolver-"));
  tempDirs.push(dir);
  mkdirSync(path.join(dir, "indexes"), { recursive: true });
  return dir;
}

function writeManifest(root: string): void {
  writeFileSync(
    path.join(root, "indexes", "assets.manifest.json"),
    JSON.stringify({
      assets: [
        {
          id: "asset_member_1",
          relativePath: "objects/table.webp",
          width: 64,
          height: 64
        }
      ],
      sourceRoot: path.join(root, "library")
    })
  );
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { force: true, recursive: true });
    }
  }
});

describe("createAssetManifestResolver", () => {
  it("resolves a direct asset id to its file", async () => {
    const root = workspace();
    writeManifest(root);
    const resolver = createAssetManifestResolver({ outputRoot: root });

    const resolved = await resolver.resolveAsset("asset_member_1");

    expect(resolved?.assetId).toBe("asset_member_1");
    expect(resolved?.absolutePath).toBe(
      path.join(root, "library", "objects", "table.webp")
    );
  });

  it("resolves a group id via its representative member", async () => {
    const root = workspace();
    writeManifest(root);
    writeFileSync(
      path.join(root, "indexes", "asset-groups.json"),
      JSON.stringify({
        groups: [
          {
            id: "group_abc123",
            representativeAssetId: "asset_member_1",
            assetIds: ["asset_member_1"]
          }
        ]
      })
    );
    const resolver = createAssetManifestResolver({ outputRoot: root });

    const resolved = await resolver.resolveAsset("group_abc123");

    expect(resolved?.assetId).toBe("asset_member_1");
  });

  it("falls back to assetIds[0] when no representative is set", async () => {
    const root = workspace();
    writeManifest(root);
    writeFileSync(
      path.join(root, "indexes", "asset-groups.json"),
      JSON.stringify({
        groups: [{ id: "group_xyz", assetIds: ["asset_member_1"] }]
      })
    );
    const resolver = createAssetManifestResolver({ outputRoot: root });

    expect((await resolver.resolveAsset("group_xyz"))?.assetId).toBe(
      "asset_member_1"
    );
  });

  it("returns null for unknown ids and works without a groups file", async () => {
    const root = workspace();
    writeManifest(root);
    const resolver = createAssetManifestResolver({ outputRoot: root });

    expect(await resolver.resolveAsset("group_missing")).toBeNull();
    expect(await resolver.resolveAsset("asset_unknown")).toBeNull();
  });
});
