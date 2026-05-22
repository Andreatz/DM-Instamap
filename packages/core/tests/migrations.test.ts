import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MapDocumentMigrationError, migrateMapDocument, upgradeMapDocumentToV2 } from "../src";

const fixturesRoot = path.resolve(fileURLToPath(new URL("../src/migrations/fixtures", import.meta.url)));

async function readFixture(name: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(fixturesRoot, name), "utf8"));
}

describe("migrateMapDocument", () => {
  it("accepts current v1 documents", async () => {
    const document = migrateMapDocument(await readFixture("document-v1-basic.json"));

    expect(document.version).toBe(1);
    expect(document.editable).toBe(true);
    expect(document.layers.map((layer) => layer.kind)).toContain("props");
  });

  it("migrates legacy documents without an explicit version", async () => {
    const document = migrateMapDocument(await readFixture("document-v0-basic.json"));

    expect(document.version).toBe(1);
    expect(document.editable).toBe(true);
    expect(document.grid.width).toBe(2);
    expect(document.layers).toHaveLength(7);
  });

  it("preserves assets and plan data from v1 fixtures", async () => {
    const withAssets = migrateMapDocument(await readFixture("document-v1-with-assets.json"));
    const withPlan = migrateMapDocument(await readFixture("document-v1-with-plan.json"));

    expect(withAssets.assets[0]?.assetId).toBe("asset-table");
    expect(withAssets.assets[0]?.flipY).toBe(true);
    expect(withPlan.plan?.rooms[0]?.label).toBe("Room 1");
  });

  it("unwraps dmimap export payloads during import", async () => {
    const source = await readFixture("document-v1-basic.json");
    const document = migrateMapDocument({
      document: source,
      exportedAt: "2026-05-21T12:00:00.000Z",
      format: "dmimap",
      mode: "gm",
      version: 1
    });

    expect(document.id).toBe("document-v1-basic");
  });

  it("fails clearly for unsupported future versions", () => {
    expect(() => migrateMapDocument({ version: 99 })).toThrow(MapDocumentMigrationError);
    expect(() => migrateMapDocument({ version: 99 })).toThrow("Unsupported MapDocument version: 99");
  });

  it("upgrades v1 documents to the v2 preparation schema", async () => {
    const document = upgradeMapDocumentToV2(await readFixture("document-v1-basic.json"));

    expect(document.version).toBe(2);
    expect(document.metadata.exportHistory).toEqual([]);
    expect(document.metadata.schemaChangelog).toContain("v1-to-v2");
  });

  it("accepts v2 documents through the explicit v2 upgrader", async () => {
    const document = upgradeMapDocumentToV2(await readFixture("document-v2-basic.json"));

    expect(document.version).toBe(2);
    expect(document.metadata.thumbnailPath).toContain("latest.svg");
  });

  it("fails clearly for corrupt documents", () => {
    expect(() => migrateMapDocument({ id: "", version: 1 })).toThrow(MapDocumentMigrationError);
    expect(() => migrateMapDocument({ id: "", version: 1 })).toThrow("Invalid MapDocument after migration");
  });
});
