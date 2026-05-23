import { describe, expect, it } from "vitest";
import {
  DEFAULT_RENDER_PRESET,
  RENDER_STYLE_PRESETS,
  clampLightIntensity,
  deriveRenderPreset,
  getRenderPreset
} from "../src/render-style";

describe("render style presets", () => {
  it("derives the warm crypt preset from crypt/cathedral hints", () => {
    expect(deriveRenderPreset({ tags: ["crypt", "cathedral"] })).toBe(
      "dark-warm-crypt"
    );
    expect(deriveRenderPreset({ theme: "Cripta sotto la cattedrale" })).toBe(
      "dark-warm-crypt"
    );
  });

  it("derives tavern and cave presets from their themes", () => {
    expect(deriveRenderPreset({ tags: ["tavern"] })).toBe("tavern-topdown");
    expect(deriveRenderPreset({ theme: "natural cave" })).toBe("cave-natural");
  });

  it("falls back to the cold dungeon preset for unknown themes", () => {
    expect(deriveRenderPreset({ tags: ["generic"] })).toBe(
      DEFAULT_RENDER_PRESET
    );
    expect(deriveRenderPreset()).toBe(DEFAULT_RENDER_PRESET);
  });

  it("keeps every preset's grid opacity discreet (<= 0.08)", () => {
    for (const id of RENDER_STYLE_PRESETS) {
      expect(getRenderPreset(id).gridOpacity).toBeLessThanOrEqual(0.08);
    }
  });

  it("exposes the dark-warm-crypt palette required by the reference", () => {
    const preset = getRenderPreset("dark-warm-crypt");
    expect(preset.palette.accentWarm).toBe("#ff7a28");
    expect(preset.gridOpacity).toBeLessThanOrEqual(0.08);
    expect(preset.torchMaxIntensity).toBeLessThanOrEqual(0.45);
    expect(preset.magicMaxIntensity).toBeLessThanOrEqual(0.55);
  });

  it("returns the default preset for unknown ids", () => {
    expect(getRenderPreset("does-not-exist").id).toBe(DEFAULT_RENDER_PRESET);
  });

  it("clamps light intensity to the preset caps per kind", () => {
    const preset = getRenderPreset("dark-warm-crypt");
    expect(clampLightIntensity(1, "torch", preset)).toBe(0.45);
    expect(clampLightIntensity(1, "magic", preset)).toBe(0.55);
    expect(clampLightIntensity(0.2, "torch", preset)).toBe(0.2);
    expect(clampLightIntensity(-5, "torch", preset)).toBe(0);
    expect(clampLightIntensity(Number.NaN, "magic", preset)).toBe(0);
  });
});
