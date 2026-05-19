import { describe, expect, it } from "vitest";
import { classifyAsset, createAutomaticTags } from "../src";

describe("classifyAsset", () => {
  it("uses filename and folder tags for floor assets", () => {
    const result = classifyAsset({
      hasTransparency: false,
      height: 512,
      relativePath: "Dungeon Floors/stone-floor-01.png",
      width: 512
    });

    expect(result).toMatchObject({
      classification: "floor",
      classificationSource: "automatic"
    });
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.tags).toEqual(["01", "dungeon", "floor", "floors", "stone"]);
  });

  it("uses aspect ratio and transparency for long door-like objects", () => {
    const result = classifyAsset({
      hasTransparency: true,
      height: 64,
      relativePath: "objects/iron-portcullis.png",
      width: 512
    });

    expect(result.classification).toBe("door");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("uses manual overrides over automatic classification", () => {
    const result = classifyAsset(
      {
        hasTransparency: false,
        height: 512,
        relativePath: "floors/blue-water-tile.png",
        width: 512
      },
      {
        classification: "water",
        confidence: 0.92,
        tags: ["manual", "river"]
      }
    );

    expect(result).toEqual({
      classification: "water",
      classificationSource: "manual",
      confidence: 0.92,
      tags: ["manual", "river"]
    });
  });
});

describe("createAutomaticTags", () => {
  it("extracts normalized tags from folder and filename", () => {
    expect(createAutomaticTags("Ancient Walls/Cracked-Stone_Wall 02.PNG")).toEqual([
      "02",
      "ancient",
      "cracked",
      "stone",
      "wall",
      "walls"
    ]);
  });
});
