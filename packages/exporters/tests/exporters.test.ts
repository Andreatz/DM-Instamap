import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  createMapDocument,
  type DoorSegment,
  type LightSource,
  type MapPlan,
  type PlacedAsset,
  type WallSegment
} from "@dm-instamap/core";
import {
  exportMapDocumentRaster,
  exportMapDocumentRasterLayerBundle,
  exportMapDocumentRasterLayers,
  listSupportedExportFormats,
  renderMapDocumentSvg
} from "../src";

describe("listSupportedExportFormats", () => {
  it("tracks planned MVP and future export formats", () => {
    expect(listSupportedExportFormats()).toEqual([
      "png",
      "webp",
      "dd2vtt",
      "foundry",
      "dmimap"
    ]);
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
    expect(result.missingAssets).toEqual([]);
    expect(result.usedAssets).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.width).toBe(3 * 28);
    expect(result.buffer.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  });

  it("composites real asset artwork when an asset resolver is provided", async () => {
    const fixture = await createImageFixture({
      color: { alpha: 1, b: 20, g: 30, r: 220 },
      name: "table.png"
    });
    const result = await exportMapDocumentRaster(createExportFixture(), {
      assetResolver: {
        resolveAsset: (assetId) =>
          assetId === "asset-table" ? { absolutePath: fixture, assetId } : null
      },
      format: "png",
      includeGrid: false,
      scale: 1
    });
    const centerPixel = await readPixel(result.buffer, 42, 42);

    expect(result.usedAssets).toEqual(["asset-table"]);
    expect(result.missingAssets).toEqual([]);
    expect(centerPixel.r).toBeGreaterThan(180);
    expect(centerPixel.g).toBeLessThan(80);
  });

  it("falls back to a marker and warning when a placed asset cannot be resolved", async () => {
    const result = await exportMapDocumentRaster(createExportFixture(), {
      assetResolver: {
        resolveAsset: () => null
      },
      format: "png",
      includeGrid: false,
      scale: 1
    });

    expect(result.usedAssets).toEqual([]);
    expect(result.missingAssets).toEqual(["asset-table"]);
    expect(result.warnings[0]).toContain("Asset asset-table non trovato");
  });

  it("applies flip transforms to resolved asset artwork", async () => {
    const fixture = await createTwoToneFixture();
    const map = {
      ...createMapDocument({
        height: 1,
        id: "flip-export",
        name: "Flip Export",
        tiles: [{ id: "tile-0-0", kind: "floor" as const, x: 0, y: 0 }],
        width: 1
      }),
      assets: [
        {
          assetId: "asset-banner",
          flipX: true,
          flipY: false,
          id: "placed-banner",
          layer: "object" as const,
          locked: false,
          position: { x: 0, y: 0 },
          rotation: 0,
          scale: 1,
          tags: []
        }
      ]
    };
    const result = await exportMapDocumentRaster(map, {
      assetResolver: {
        resolveAsset: (assetId) => ({ absolutePath: fixture, assetId })
      },
      format: "png",
      includeGrid: false,
      scale: 1
    });
    const leftPixel = await readPixel(result.buffer, 8, 14);
    const rightPixel = await readPixel(result.buffer, 20, 14);

    expect(leftPixel.b).toBeGreaterThan(180);
    expect(rightPixel.r).toBeGreaterThan(180);
  });

  it("does not resolve assets hidden by the requested layer filter", async () => {
    const result = await exportMapDocumentRaster(createExportFixture(), {
      assetResolver: {
        resolveAsset: (assetId) => ({
          absolutePath: `missing-${assetId}.png`,
          assetId
        })
      },
      format: "png",
      includeGrid: false,
      layers: ["floor"],
      scale: 1
    });

    expect(result.usedAssets).toEqual([]);
    expect(result.missingAssets).toEqual([]);
    expect(result.warnings).toEqual([]);
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
    const withGrid = renderMapDocumentSvg(createExportFixture(), {
      includeGrid: true
    });
    const withoutGrid = renderMapDocumentSvg(createExportFixture(), {
      includeGrid: false
    });

    expect(withGrid).toContain("stroke-opacity");
    expect(withoutGrid).not.toContain("stroke-opacity");
  });

  it("exports transparent raster files split by VTT-friendly layers", async () => {
    const layers = await exportMapDocumentRasterLayers(
      createLayeredExportFixture(),
      {
        format: "png",
        includeGrid: false,
        scale: 1
      }
    );

    expect(Object.keys(layers).sort()).toEqual([
      "doors",
      "floor",
      "lighting",
      "props",
      "walls"
    ]);
    expect(layers.floor?.filename).toBe("layered-export-floor.png");
    expect(layers.walls?.filename).toBe("layered-export-walls.png");
    expect(layers.props?.buffer.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  });

  it("can render only requested SVG layers", () => {
    const propsOnly = renderMapDocumentSvg(createLayeredExportFixture(), {
      background: "transparent",
      includeGrid: false,
      layers: ["props"]
    });

    expect(propsOnly).toContain("<circle");
    expect(propsOnly).not.toContain("#333c41");
    expect(propsOnly).not.toContain("#caa24a");
    expect(propsOnly).not.toContain("stop-opacity");
  });

  it("tiles floor and wall textures over the base colour when provided", () => {
    const svg = renderMapDocumentSvg(createExportFixture(), {
      cellPixels: 28,
      floorPattern: "data:image/png;base64,Zm9vcg==",
      wallPattern: "data:image/png;base64,d2FsbA=="
    });

    expect(svg).toContain('<pattern id="dm-floor-tex"');
    expect(svg).toContain('<pattern id="dm-wall-tex"');
    expect(svg).toContain('xlink:href="data:image/png;base64,Zm9vcg=="');
    expect(svg).toContain('fill="url(#dm-floor-tex)"');
  });

  it("bundles separated raster layers into a zip with a manifest", async () => {
    const bundle = await exportMapDocumentRasterLayerBundle(
      createLayeredExportFixture(),
      {
        format: "webp",
        includeGrid: false,
        layers: ["floor", "props"],
        scale: 1,
        webpQuality: 80
      }
    );
    const zip = await JSZip.loadAsync(bundle.buffer);
    const manifest = JSON.parse(
      await zip.file("manifest.json")!.async("string")
    ) as {
      format: string;
      layers: string[];
    };
    const floor = await zip
      .file("layered-export-floor.webp")!
      .async("uint8array");

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

async function createImageFixture(input: {
  color: { alpha: number; b: number; g: number; r: number };
  name: string;
}): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dm-export-asset-"));
  const filePath = path.join(directory, input.name);
  await sharp({
    create: {
      background: input.color,
      channels: 4,
      height: 12,
      width: 12
    }
  })
    .png()
    .toFile(filePath);
  return filePath;
}

async function createTwoToneFixture(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dm-export-flip-"));
  const filePath = path.join(directory, "banner.png");
  const left = await sharp({
    create: {
      background: { alpha: 1, b: 0, g: 0, r: 230 },
      channels: 4,
      height: 12,
      width: 6
    }
  })
    .png()
    .toBuffer();
  const right = await sharp({
    create: {
      background: { alpha: 1, b: 230, g: 0, r: 0 },
      channels: 4,
      height: 12,
      width: 6
    }
  })
    .png()
    .toBuffer();

  await sharp({
    create: {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      channels: 4,
      height: 12,
      width: 12
    }
  })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: 6, top: 0 }
    ])
    .png()
    .toFile(filePath);

  return filePath;
}

async function readPixel(
  buffer: Buffer,
  x: number,
  y: number
): Promise<{ b: number; g: number; r: number }> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const raw = await image.raw().toBuffer();
  const offset = (y * width + x) * 4;
  return {
    r: raw[offset] ?? 0,
    g: raw[offset + 1] ?? 0,
    b: raw[offset + 2] ?? 0
  };
}
