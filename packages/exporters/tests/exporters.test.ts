import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { createMapDocument, type DoorSegment, type LightSource, type MapPlan, type PlacedAsset, type WallSegment } from "@dm-instamap/core";
import {
  exportMapDocumentRaster,
  exportMapDocumentRasterLayerBundle,
  exportMapDocumentRasterLayers,
  listSupportedExportFormats,
  renderMapDocumentSvg
} from "../src";

describe("listSupportedExportFormats", () => {
  it("tracks planned MVP and future export formats", () => {
    expect(listSupportedExportFormats()).toEqual(["png", "webp", "dd2vtt", "foundry", "dmimap"]);
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
      scale: 2,
      webpQuality: 70
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

  it("exports transparent raster files split by VTT-friendly layers", async () => {
    const layers = await exportMapDocumentRasterLayers(createLayeredExportFixture(), {
      format: "png",
      includeGrid: false,
      scale: 1
    });

    expect(Object.keys(layers).sort()).toEqual(["doors", "floor", "lighting", "props", "walls"]);
    expect(layers.floor?.filename).toBe("layered-export-floor.png");
    expect(layers.walls?.filename).toBe("layered-export-walls.png");
    expect(layers.props?.buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it("can render only requested SVG layers", () => {
    const propsOnly = renderMapDocumentSvg(createLayeredExportFixture(), {
      background: "transparent",
      includeGrid: false,
      layers: ["props"]
    });

    expect(propsOnly).toContain("<circle");
    expect(propsOnly).not.toContain("#394348");
    expect(propsOnly).not.toContain("#f0b84c");
    expect(propsOnly).not.toContain("fill-opacity");
  });

  it("bundles separated raster layers into a zip with a manifest", async () => {
    const bundle = await exportMapDocumentRasterLayerBundle(createLayeredExportFixture(), {
      format: "webp",
      includeGrid: false,
      layers: ["floor", "props"],
      scale: 1,
      webpQuality: 80
    });
    const zip = await JSZip.loadAsync(bundle.buffer);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string")) as {
      format: string;
      layers: string[];
    };
    const floor = await zip.file("layered-export-floor.webp")!.async("uint8array");

    expect(bundle).toMatchObject({
      contentType: "application/zip",
      filename: "layered-export-webp-layers.zip",
      layers: ["floor", "props"]
    });
    expect(manifest).toMatchObject({
      format: "webp",
      layers: ["floor", "props"]
    });
    expect(Buffer.from(floor).subarray(0, 4).toString("ascii")).toBe("RIFF");
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
    flipX: false,
    flipY: false,
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

function createLayeredExportFixture() {
  const walls: WallSegment[] = [
    {
      blocksMovement: true,
      end: { x: 3, y: 0 },
      id: "wall-north",
      roomIds: [],
      start: { x: 0, y: 0 },
      thickness: 1
    }
  ];
  const doors: DoorSegment[] = [
    {
      id: "door-north",
      isLocked: false,
      isOpen: false,
      position: { x: 1, y: 0 },
      rotation: 90,
      roomIds: [],
      width: 1
    }
  ];
  const lights: LightSource[] = [
    {
      color: "#ffaa66",
      flicker: false,
      id: "light-center",
      intensity: 0.7,
      kind: "torch",
      position: { x: 1.5, y: 1 },
      radius: 2
    }
  ];
  const plan: MapPlan = {
    assetPlacements: [],
    doors,
    gmNotes: [],
    id: "plan-layered",
    initiative: [],
    lights,
    name: "Layered Plan",
    notes: [],
    requestId: "request-layered",
    rooms: [],
    walls
  };
  const map = createMapDocument({
    height: 2,
    id: "layered-export",
    name: "Layered Export",
    plan,
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
  const table: PlacedAsset = {
    assetId: "asset-table",
    flipX: false,
    flipY: false,
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
    assets: [table]
  };
}
