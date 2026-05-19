import { describe, expect, it } from "vitest";
import {
  buildReferenceCorrectionFromDraft,
  createReferenceReviewDraft,
  filterReferenceReviewQueue,
  findReferenceOverride,
  mergeReferenceOverride,
  normalizeReferenceOverridesFile,
  parseCsvList
} from "./reference-review";
import type { ReferenceMapView } from "./references";

const reference: ReferenceMapView = {
  dominantColors: [],
  extension: "png",
  height: 800,
  id: "reference-dungeon",
  mapType: "dungeon",
  mapTypeConfidence: 0.42,
  path: "Maps/old-dungeon.png",
  previewUrl: "/references/preview/reference-dungeon",
  tags: ["dungeon", "old"],
  thumbnailPath: "data/previews/references/reference-dungeon.webp",
  width: 1200
};

describe("reference review helpers", () => {
  it("creates a draft from a reference and applies overrides", () => {
    expect(createReferenceReviewDraft(reference)).toEqual({
      layoutTagsText: "",
      mapType: "dungeon",
      notes: "",
      qualityScore: 42,
      styleTagsText: "",
      themeTagsText: "dungeon, old"
    });

    expect(
      createReferenceReviewDraft(reference, {
        layoutTags: ["loop"],
        mapType: "cave",
        notes: "branching paths",
        qualityScore: 90,
        styleTags: ["painted"],
        themeTags: ["underdark"]
      })
    ).toEqual({
      layoutTagsText: "loop",
      mapType: "cave",
      notes: "branching paths",
      qualityScore: 90,
      styleTagsText: "painted",
      themeTagsText: "underdark"
    });
  });

  it("builds a correction from draft fields", () => {
    expect(
      buildReferenceCorrectionFromDraft({
        layoutTagsText: "loop, multi-level",
        mapType: "ship",
        notes: " deck plan ",
        qualityScore: 120,
        styleTagsText: "ink, parchment",
        themeTagsText: "naval, naval"
      })
    ).toEqual({
      layoutTags: ["loop", "multi-level"],
      mapType: "ship",
      notes: "deck plan",
      qualityScore: 100,
      styleTags: ["ink", "parchment"],
      themeTags: ["naval"]
    });
  });

  it("filters unknown and low-confidence references", () => {
    const unknown = { ...reference, id: "unknown", mapType: "unknown", mapTypeConfidence: 0 };
    const high = { ...reference, id: "high", mapTypeConfidence: 0.9 };

    expect(
      filterReferenceReviewQueue([reference, unknown, high], {
        lowConfidenceOnly: false,
        unknownOnly: true
      }).map((item) => item.id)
    ).toEqual(["unknown"]);

    expect(
      filterReferenceReviewQueue([reference, unknown, high], {
        lowConfidenceOnly: true,
        unknownOnly: false
      }).map((item) => item.id)
    ).toEqual(["reference-dungeon", "unknown"]);
  });

  it("finds, normalizes, and merges overrides", () => {
    const normalized = normalizeReferenceOverridesFile({
      overrides: {
        "Maps/old-dungeon.png": {
          mapType: "not-real",
          notes: "note",
          qualityScore: -1,
          themeTags: ["old"]
        }
      }
    });

    expect(findReferenceOverride(normalized, reference)).toEqual({
      mapType: "dungeon",
      notes: "note",
      qualityScore: 0,
      themeTags: ["old"]
    });

    const merged = mergeReferenceOverride(normalized, reference, {
      layoutTags: [],
      mapType: "building",
      notes: "",
      qualityScore: 60,
      styleTags: [],
      themeTags: ["keep"]
    });

    expect(merged.overrides["reference-dungeon"]).toMatchObject({
      mapType: "building",
      qualityScore: 60
    });
    expect(merged.overrides["Maps/old-dungeon.png"]).toBeUndefined();
  });

  it("parses comma-separated tags", () => {
    expect(parseCsvList("crypt, gothic, crypt")).toEqual(["crypt", "gothic"]);
  });
});
