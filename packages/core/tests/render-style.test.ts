import { describe, expect, it } from "vitest";
import {
  ARTISTIC_WARM_LIGHT,
  DEFAULT_RENDER_PRESET,
  RENDER_STYLE_PRESETS,
  artisticLightStyle,
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

  it("turns torch/lantern lights into a contained warm amber glow", () => {
    const torch = artisticLightStyle("torch", "#ff0000");
    expect(torch.color).toBe(ARTISTIC_WARM_LIGHT);
    expect(torch.alpha).toBeLessThanOrEqual(0.26);
    expect(torch.radiusCells).toBeLessThanOrEqual(3.5);

    // Unknown kinds default to the same safe warm glow.
    expect(artisticLightStyle(undefined, "#ffffff").color).toBe(
      ARTISTIC_WARM_LIGHT
    );
  });

  it("keeps magic hues but normalises pure-red magic to amber", () => {
    const blue = artisticLightStyle("magic", "#6fa8d6");
    expect(blue.color).toBe("#6fa8d6");
    expect(blue.alpha).toBeLessThanOrEqual(0.32);
    expect(blue.radiusCells).toBeLessThanOrEqual(4);

    expect(artisticLightStyle("magic", "#ff0000").color).toBe(
      ARTISTIC_WARM_LIGHT
    );
  });
});
