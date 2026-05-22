import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { groupAssets } from "../src";

describe("groupAssets", () => {
  it("groups manifest assets and writes asset-groups.json", async () => {
    const outputRoot = await mkdtemp(
      path.join(os.tmpdir(), "dm-instamap-groups-")
    );
    const indexDir = path.join(outputRoot, "data", "indexes");
    await mkdir(indexDir, { recursive: true });
    await writeFile(
      path.join(indexDir, "assets.manifest.json"),
      JSON.stringify(
        {
          assets: [
            {
              classification: "floor",
              dominantColors: [{ hex: "#808060", population: 12 }],
              hasTransparency: false,
              height: 512,
              id: "asset-floor-a",
              relativePath: "Dungeon/Floors/stone-floor-a.png",
              tags: ["stone", "floor"],
              thumbnailPath: "data/previews/assets/asset-floor-a.webp",
              width: 512
            },
            {
              classification: "floor",
              dominantColors: [{ hex: "#808060", population: 10 }],
              hasTransparency: false,
              height: 512,
              id: "asset-floor-b",
              relativePath: "Dungeon/Floors/stone-floor-b.png",
              tags: ["stone", "floor"],
              thumbnailPath: "data/previews/assets/asset-floor-b.webp",
              width: 512
            },
            {
              classification: "door",
              dominantColors: [{ hex: "#604020", population: 5 }],
              hasTransparency: true,
              height: 64,
              id: "asset-door-a",
              relativePath: "Dungeon/Doors/oak-door.png",
              tags: ["oak", "door"],
              thumbnailPath: "data/previews/assets/asset-door-a.webp",
              width: 256
            }
          ],
          version: 1
        },
        null,
        2
      ),
      "utf8"
    );

    const groupsFile = await groupAssets({ outputRoot });
    const written = JSON.parse(
      await readFile(path.join(indexDir, "asset-groups.json"), "utf8")
    ) as typeof groupsFile;

    expect(groupsFile.groupCount).toBe(2);
    expect(written.groupCount).toBe(2);

    const floorGroup = groupsFile.groups.find(
      (group) => group.kind === "floor"
    );
    expect(floorGroup).toMatchObject({
      assetCount: 2,
      assetIds: ["asset-floor-a", "asset-floor-b"],
      kind: "floor",
      representativeAssetId: "asset-floor-a",
      representativeThumbnail: "data/previews/assets/asset-floor-a.webp",
      tags: ["floor", "stone"]
    });

    const doorGroup = groupsFile.groups.find((group) => group.kind === "door");
    expect(doorGroup?.assetCount).toBe(1);
  });

  it("falls back to heuristic classification for older manifests", async () => {
    const outputRoot = await mkdtemp(
      path.join(os.tmpdir(), "dm-instamap-groups-")
    );
    const indexDir = path.join(outputRoot, "data", "indexes");
    await mkdir(indexDir, { recursive: true });
    await writeFile(
      path.join(indexDir, "assets.manifest.json"),
      JSON.stringify({
        assets: [
          {
            dominantColors: [{ hex: "#202020", population: 4 }],
            hasTransparency: true,
            height: 64,
            id: "asset-door",
            relativePath: "Doors/iron-door.png",
            width: 256
          }
        ]
      }),
      "utf8"
    );

    const groupsFile = await groupAssets({ outputRoot });

    expect(groupsFile.groups[0]).toMatchObject({
      assetCount: 1,
      kind: "door",
      tags: ["door", "doors", "iron"]
    });
  });

  it("carries manual override metadata into groups", async () => {
    const outputRoot = await mkdtemp(
      path.join(os.tmpdir(), "dm-instamap-groups-")
    );
    const indexDir = path.join(outputRoot, "data", "indexes");
    await mkdir(indexDir, { recursive: true });
    await writeFile(
      path.join(indexDir, "assets.manifest.json"),
      JSON.stringify({
        assets: [
          {
            classification: "prop",
            confidence: 0.6,
            height: 128,
            id: "asset-altar",
            relativePath: "Crypt/Props/altar.png",
            tags: ["altar"],
            width: 128
          }
        ]
      }),
      "utf8"
    );
    await writeFile(
      path.join(indexDir, "asset-overrides.json"),
      JSON.stringify({
        overrides: {
          "asset-altar": {
            classification: "decoration",
            qualityScore: 91,
            tags: ["altar", "boss"],
            theme: "crypt",
            usableFor: ["boss", "final"]
          }
        }
      }),
      "utf8"
    );

    const groupsFile = await groupAssets({ outputRoot });

    expect(groupsFile.groups[0]).toMatchObject({
      kind: "decoration",
      qualityScore: 91,
      tags: ["altar", "boss"],
      theme: "crypt",
      themes: ["crypt"],
      usableFor: ["boss", "final"]
    });
  });
});
