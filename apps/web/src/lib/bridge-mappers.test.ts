import { describe, expect, it } from "vitest";
import { toBridgeAssetGroup, toBridgeReference } from "./bridge-mappers";
import type { AssetGroupView } from "./asset-groups";
import type { ReferenceMapView } from "./references";

describe("bridge mappers", () => {
  it("maps an asset group view to a bridge summary", () => {
    const group: AssetGroupView = {
      assetCount: 4,
      assetIds: ["a1", "a2", "a3", "a4"],
      id: "group-doors",
      kind: "door",
      name: "Iron Doors",
      previewUrl: null,
      qualityScore: 73,
      representativeAssetId: "a1",
      representativeThumbnail: null,
      sourceFolders: ["doors/iron"],
      tags: ["iron", "wood"],
      theme: "crypt",
      themes: ["crypt", "ruin"],
      usableFor: ["dungeon", "ruin"]
    };

    const summary = toBridgeAssetGroup(group);

    expect(summary).toEqual({
      assetCount: 4,
      id: "group-doors",
      kind: "door",
      name: "Iron Doors",
      qualityScore: 73,
      tags: ["iron", "wood"],
      theme: "crypt",
      usableFor: ["dungeon", "ruin"]
    });
  });

  it("maps a reference with style DNA to a bridge reference", () => {
    const reference: ReferenceMapView = {
      dominantColors: [],
      extension: "png",
      height: 1024,
      id: "ref-1",
      mapType: "dungeon",
      mapTypeConfidence: 0.85,
      path: "references/dungeon-01.png",
      previewUrl: "/references/preview/ref-1",
      tags: ["dungeon", "stone"],
      thumbnailPath: null,
      width: 1024,
      styleDna: {
        confidence: 0.7,
        density: "medium",
        grid: { confidence: 0.5, detected: true, estimatedCellSizePx: 70 },
        id: "style-1",
        layoutTraits: ["axial"],
        mood: ["grim"],
        palette: [],
        promptSummary: "stone dungeon",
        recommendedAssetTags: ["stone", "torch"],
        referenceId: "ref-1",
        visualTags: ["grim", "stone"]
      }
    };

    const summary = toBridgeReference(reference);

    expect(summary).toEqual({
      height: 1024,
      id: "ref-1",
      mapType: "dungeon",
      mapTypeConfidence: 0.85,
      path: "references/dungeon-01.png",
      styleDna: {
        density: "medium",
        layoutTraits: ["axial"],
        mood: ["grim"],
        promptSummary: "stone dungeon",
        recommendedAssetTags: ["stone", "torch"],
        visualTags: ["grim", "stone"]
      },
      tags: ["dungeon", "stone"],
      width: 1024
    });
  });

  it("returns null styleDna when missing", () => {
    const reference: ReferenceMapView = {
      dominantColors: [],
      extension: "png",
      height: null,
      id: "ref-2",
      mapType: "unknown",
      mapTypeConfidence: 0,
      path: "references/ref-2.png",
      previewUrl: "/references/preview/ref-2",
      tags: [],
      thumbnailPath: null,
      width: null,
      styleDna: null
    };

    expect(toBridgeReference(reference).styleDna).toBeNull();
  });
});
