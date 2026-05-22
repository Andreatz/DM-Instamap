import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  buildFoundryModuleData,
  buildVttExportManifest,
  exportMapDocumentDd2Vtt,
  importDd2Vtt
} from "../src";
import { createRealisticMap } from "./fixtures/realistic-map";

async function decodeEmbeddedImage(dataUrl: string | undefined) {
  if (!dataUrl) {
    throw new Error("expected an embedded image");
  }

  const base64 = dataUrl.replace(/^data:[^;]+;base64,/u, "");
  return sharp(Buffer.from(base64, "base64")).metadata();
}

describe("dd2vtt grid/image alignment", () => {
  it("renders the embedded image at exactly pixels_per_grid per cell", async () => {
    const document = createRealisticMap();
    const result = await exportMapDocumentDd2Vtt(document, { embedImage: true, imageFormat: "png" });

    expect(result.object.resolution.pixels_per_grid).toBe(70);
    expect(result.object.resolution.image_size).toEqual({ x: 840, y: 560 });

    const meta = await decodeEmbeddedImage(result.object.image);
    expect(meta.width).toBe(result.object.resolution.image_size.x);
    expect(meta.height).toBe(result.object.resolution.image_size.y);
    expect(meta.width).toBe(result.object.resolution.map_size.x * result.object.resolution.pixels_per_grid);
  });

  it("scales pixels_per_grid and image with the scale option", async () => {
    const document = createRealisticMap();
    const result = await exportMapDocumentDd2Vtt(document, { embedImage: true, imageFormat: "png", scale: 2 });

    expect(result.object.resolution.pixels_per_grid).toBe(140);
    expect(result.object.resolution.image_size).toEqual({ x: 1680, y: 1120 });

    const meta = await decodeEmbeddedImage(result.object.image);
    expect(meta.width).toBe(1680);
    expect(meta.height).toBe(1120);
  });

  it("keeps logical resolution when the image is not embedded", async () => {
    const result = await exportMapDocumentDd2Vtt(createRealisticMap(), { embedImage: false });

    expect(result.object.image).toBeUndefined();
    expect(result.object.resolution.pixels_per_grid).toBe(70);
    expect(result.object.resolution.image_size).toEqual({ x: 840, y: 560 });
  });

  it("preserves walls, doors and lights through an export/import round-trip", async () => {
    const exported = await exportMapDocumentDd2Vtt(createRealisticMap(), { embedImage: false });
    const imported = importDd2Vtt(exported.json, { name: "Round Trip" });

    expect(imported.document.width).toBe(12);
    expect(imported.document.height).toBe(8);
    expect(imported.document.plan?.walls).toHaveLength(5);
    expect(imported.document.plan?.doors).toHaveLength(2);
    expect(imported.document.plan?.lights).toHaveLength(2);
    expect(imported.document.plan?.doors.find((door) => door.isOpen)).toBeDefined();
  });
});

describe("vtt export manifest", () => {
  it("reports consistent doors, walls and lights across both formats", async () => {
    const manifest = await buildVttExportManifest(createRealisticMap());

    expect(manifest.consistency).toEqual({
      dd2vttGridMatchesImage: true,
      doorsMatch: true,
      lightsMatch: true,
      wallsPresent: true
    });

    expect(manifest.dd2vtt).toMatchObject({
      format: 0.3,
      imageSize: { x: 840, y: 560 },
      mapSize: { x: 12, y: 8 },
      pixelsPerGrid: 70,
      wallSegments: 5
    });
    expect(manifest.dd2vtt.portals).toHaveLength(2);
    expect(manifest.dd2vtt.lights).toHaveLength(2);

    expect(manifest.foundry).toMatchObject({
      compatibility: { minimum: "11", verified: "12" },
      doorCount: 2,
      grid: { distance: 5, size: 70, units: "ft" },
      height: 560,
      lightCount: 2,
      noteCount: 1,
      wallCount: 5,
      width: 840
    });
  });

  it("matches the recorded manifest snapshot", async () => {
    const manifest = await buildVttExportManifest(createRealisticMap());
    expect(manifest).toMatchSnapshot();
  });
});

describe("foundry version compatibility", () => {
  it("defaults to verified v12 compatibility", () => {
    const data = buildFoundryModuleData(createRealisticMap(), { moduleId: "compat-default" });
    expect(data.moduleJson.compatibility).toEqual({ minimum: "11", verified: "12" });
  });

  it("targets v13 when requested", () => {
    const data = buildFoundryModuleData(createRealisticMap(), { foundryVersion: "v13", moduleId: "compat-v13" });
    expect(data.moduleJson.compatibility).toEqual({ minimum: "12", verified: "13" });
  });

  it("scales scene dimensions and grid size with the document grid", () => {
    const data = buildFoundryModuleData(createRealisticMap(), { moduleId: "dims" });
    expect(data.sceneJson.grid.size).toBe(70);
    expect(data.sceneJson.width).toBe(840);
    expect(data.sceneJson.height).toBe(560);
    expect(data.sceneJson.walls.filter((wall) => wall.door === 1)).toHaveLength(2);
    expect(data.sceneJson.walls.find((wall) => wall._id === data.sceneJson.walls[0]?._id)?.c).toHaveLength(4);
  });
});
