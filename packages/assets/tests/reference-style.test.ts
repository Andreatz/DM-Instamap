import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildReferenceStyleDna, generateReferenceStyleDna } from "../src";

describe("Reference Style DNA", () => {
  it("builds useful style metadata from a reference manifest entry", () => {
    const style = buildReferenceStyleDna(
      {
        dominantColors: [
          { hex: "#202020", population: 50 },
          { hex: "#806040", population: 30 },
          { hex: "#d08020", population: 8 }
        ],
        height: 1400,
        id: "reference-crypt",
        mapType: "dungeon",
        mapTypeConfidence: 0.8,
        path: "Crypts/ancient-crypt-grid.png",
        tags: ["ancient", "crypt", "grid", "torch"],
        width: 2100
      },
      "2026-05-20T00:00:00.000Z"
    );

    expect(style).toMatchObject({
      density: "medium",
      mapType: "dungeon",
      referenceId: "reference-crypt"
    });
    expect(style?.grid.detected).toBe(true);
    expect(style?.grid.estimatedCellSizePx).toBe(50);
    expect(style?.mood).toEqual(expect.arrayContaining(["cryptic", "dark", "warm-lit"]));
    expect(style?.layoutTraits).toEqual(expect.arrayContaining(["corridor-heavy"]));
    expect(style?.recommendedAssetTags).toEqual(expect.arrayContaining(["stone", "torch", "wall"]));
    expect(style?.promptSummary).toContain("Dungeon battlemap style");
  });

  it("writes data/indexes/reference-style-dna.json", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "dm-instamap-reference-style-"));
    const indexDir = path.join(outputRoot, "data", "indexes");
    await mkdir(indexDir, { recursive: true });
    await writeFile(
      path.join(indexDir, "references.manifest.json"),
      JSON.stringify({
        references: [
          {
            dominantColors: [{ hex: "#408040", population: 20 }],
            height: 1000,
            id: "reference-forest",
            mapType: "wilderness",
            mapTypeConfidence: 0.75,
            path: "Forest/open-field.png",
            tags: ["forest", "open", "field"],
            width: 1500
          }
        ],
        version: 1
      }),
      "utf8"
    );

    const file = await generateReferenceStyleDna({ outputRoot });
    const written = JSON.parse(await readFile(path.join(indexDir, "reference-style-dna.json"), "utf8")) as typeof file;

    expect(file.styles).toHaveLength(1);
    expect(written.styles[0]).toMatchObject({
      density: "sparse",
      mapType: "wilderness",
      referenceId: "reference-forest"
    });
  });

  it("writes an empty style file when no reference manifest exists yet", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "dm-instamap-reference-style-empty-"));
    const file = await generateReferenceStyleDna({ outputRoot });
    const written = JSON.parse(
      await readFile(path.join(outputRoot, "data", "indexes", "reference-style-dna.json"), "utf8")
    ) as typeof file;

    expect(written.styles).toEqual([]);
    expect(written.sourceManifest).toBe("data/indexes/references.manifest.json");
  });
});
