import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  type LightSource,
  type MapPlan,
  type MapTile,
  createMapDocument,
  getRenderPreset
} from "@dm-instamap/core";
import { exportMapDocumentRaster, renderArtisticMapSvg } from "../src";

function cryptFixture() {
  const width = 14;
  const height = 12;
  const tiles: MapTile[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      tiles.push({
        id: `tile-${x}-${y}`,
        kind: edge ? "wall" : "floor",
        x,
        y
      });
    }
  }
  const lights: LightSource[] = [
    {
      color: "#202840",
      flicker: false,
      id: "ambient",
      intensity: 0.9,
      kind: "ambient",
      position: { x: 7, y: 6 },
      radius: 18
    },
    {
      color: "#ffcc88",
      flicker: false,
      id: "torch",
      intensity: 1,
      kind: "torch",
      position: { x: 4, y: 4 },
      radius: 6
    },
    {
      color: "#b58cff",
      flicker: false,
      id: "magic",
      intensity: 1,
      kind: "magic",
      position: { x: 9, y: 7 },
      radius: 7
    }
  ];
  const plan: MapPlan = {
    assetPlacements: [],
    doors: [],
    gmNotes: [],
    id: "plan-crypt",
    initiative: [],
    lights,
    name: "Crypt Plan",
    notes: [],
    requestId: "test-crypt",
    rooms: [],
    walls: []
  };
  return createMapDocument({
    grid: {
      cellSize: 5,
      height,
      pixelsPerCell: 70,
      type: "square",
      unit: "ft",
      width
    },
    height,
    id: "crypt-fixture",
    name: "Crypt",
    plan,
    tiles,
    width
  });
}

function redLightsFixture() {
  const width = 16;
  const height = 14;
  const tiles: MapTile[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      tiles.push({ id: `tile-${x}-${y}`, kind: edge ? "wall" : "floor", x, y });
    }
  }
  // Ten pure-red, max-intensity, oversized torches: the exact "debug blob" case.
  const lights: LightSource[] = Array.from({ length: 10 }, (_, i) => ({
    color: "#ff0000",
    flicker: false,
    id: `red-${i}`,
    intensity: 1,
    kind: "torch" as const,
    position: { x: 2 + (i % 5) * 3, y: 3 + Math.floor(i / 5) * 6 },
    radius: 9
  }));
  const plan: MapPlan = {
    assetPlacements: [],
    doors: [],
    gmNotes: [],
    id: "plan-red",
    initiative: [],
    lights,
    name: "Red Plan",
    notes: [],
    requestId: "test-red",
    rooms: [],
    walls: []
  };
  return createMapDocument({
    grid: {
      cellSize: 5,
      height,
      pixelsPerCell: 70,
      type: "square",
      unit: "ft",
      width
    },
    height,
    id: "red-fixture",
    name: "Red",
    plan,
    tiles,
    width
  });
}

describe("artistic renderer", () => {
  it("uses the preset palette and procedural fallback without textures", () => {
    const preset = getRenderPreset("dark-warm-crypt");
    const { svg, usedProceduralFallback } = renderArtisticMapSvg(
      cryptFixture(),
      { cellPixels: 24, preset }
    );

    expect(usedProceduralFallback).toBe(true);
    expect(svg).toContain(preset.palette.floor);
    expect(svg).toContain(preset.palette.wall);
    // No texture pattern when none provided.
    expect(svg).not.toContain("art-floor-tex");
  });

  it("keeps the grid opacity at or below the preset value", () => {
    const preset = getRenderPreset("dark-warm-crypt");
    const { svg } = renderArtisticMapSvg(cryptFixture(), {
      cellPixels: 24,
      preset
    });

    const matches = [...svg.matchAll(/stroke-opacity="([0-9.]+)"/gu)].map(
      (match) => Number.parseFloat(match[1] ?? "1")
    );
    expect(matches.length).toBeGreaterThan(0);
    for (const opacity of matches) {
      expect(opacity).toBeLessThanOrEqual(0.08);
    }
  });

  it("does not produce large overexposed or red debug areas", async () => {
    const result = await exportMapDocumentRaster(cryptFixture(), {
      format: "png",
      renderMode: "artistic",
      scale: 1.5,
      stylePreset: "dark-warm-crypt"
    });

    expect(result.usedProceduralFallback).toBe(true);

    const { data, info } = await sharp(result.buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = info.width * info.height;
    let nearWhite = 0;
    let saturatedRed = 0;
    for (let i = 0; i < pixels; i += 1) {
      const r = data[i * info.channels] ?? 0;
      const g = data[i * info.channels + 1] ?? 0;
      const b = data[i * info.channels + 2] ?? 0;
      if (r > 235 && g > 235 && b > 235) {
        nearWhite += 1;
      }
      if (r > 180 && g < 80 && b < 80) {
        saturatedRed += 1;
      }
    }

    // Clamped warm lights must never blow the scene out to white, and the
    // procedural fallback must not be the old red debug fill.
    expect(nearWhite / pixels).toBeLessThan(0.02);
    expect(saturatedRed / pixels).toBeLessThan(0.01);
  });

  it("normalises ten pure-red lights into a warm scene, not a red blob", async () => {
    const result = await exportMapDocumentRaster(redLightsFixture(), {
      format: "png",
      renderMode: "artistic",
      scale: 1.5,
      stylePreset: "tavern-topdown"
    });

    const { data, info } = await sharp(result.buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = info.width * info.height;
    let nearWhite = 0;
    let saturatedRed = 0;
    for (let i = 0; i < pixels; i += 1) {
      const r = data[i * info.channels] ?? 0;
      const g = data[i * info.channels + 1] ?? 0;
      const b = data[i * info.channels + 2] ?? 0;
      if (r > 235 && g > 235 && b > 235) {
        nearWhite += 1;
      }
      if (r > 180 && g < 80 && b < 80) {
        saturatedRed += 1;
      }
    }

    // Even with #ff0000 lights, the artistic renderer must produce warm amber
    // glows: no white blowout and no dominant saturated-red area.
    expect(nearWhite / pixels).toBeLessThan(0.02);
    expect(saturatedRed / pixels).toBeLessThan(0.01);
  });
});
