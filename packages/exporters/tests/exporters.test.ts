import { describe, expect, it } from "vitest";
import { createMapDocument, type PlacedAsset } from "@dm-instamap/core";
import {
  exportMapDocumentRaster,
  listSupportedExportFormats,
  renderMapDocumentSvg
} from "../src";

describe("listSupportedExportFormats", () => {
  it("tracks planned MVP and future export formats", () => {
    expect(listSupportedExportFormats()).toEqual(["png", "webp", "dd2vtt", "foundry"]);
  });
});

describe("exportMapDocumentRaster", () => {
  it("exports a MapDocument to PNG", async () => {
    const result = await exportMapDocumentRaster(createExportFixture(), {
      format: "png",
      includeGrid: true,
      scale: 1
    });

    expect(result.contentType).toBe("image/png");
    expect(result.filename).toBe("export-fixture.png");
    expect(result.width).toBe(3 * 28);
    expect(result.buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it("exports a MapDocument to WEBP at the requested scale", async () => {
    const result = await exportMapDocumentRaster(createExportFixture(), {
      format: "webp",
      includeGrid: false,
      scale: 2
    });

    expect(result.contentType).toBe("image/webp");
    expect(result.filename).toBe("export-fixture.webp");
    expect(result.width).toBe(3 * 56);
    expect(result.buffer.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(result.buffer.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("can include or hide grid lines in the SVG render source", () => {
    const withGrid = renderMapDocumentSvg(createExportFixture(), { includeGrid: true });
    const withoutGrid = renderMapDocumentSvg(createExportFixture(), { includeGrid: false });

    expect(withGrid).toContain("stroke-opacity");
    expect(withoutGrid).not.toContain("stroke-opacity");
  });
});

function createExportFixture() {
  const map = createMapDocument({
    height: 2,
    id: "export-fixture",
    name: "Export Fixture",
    tiles: [
      { id: "tile-0-0", kind: "wall", x: 0, y: 0 },
      { id: "tile-1-0", kind: "door", x: 1, y: 0 },
      { id: "tile-2-0", kind: "wall", x: 2, y: 0 },
      { id: "tile-0-1", kind: "floor", x: 0, y: 1 },
      { id: "tile-1-1", kind: "floor", x: 1, y: 1 },
      { id: "tile-2-1", kind: "floor", x: 2, y: 1 }
    ],
    width: 3
  });
  const asset: PlacedAsset = {
    assetId: "asset-table",
    id: "placed-table",
    layer: "object",
    locked: false,
    position: { x: 1, y: 1 },
    rotation: 0,
    scale: 1,
    tags: ["table"]
  };

  return {
    ...map,
    assets: [asset]
  };
}
