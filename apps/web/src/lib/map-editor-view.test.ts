import { describe, expect, it } from "vitest";
import { generateDungeon } from "@dm-instamap/generator";
import {
  addPlacedAsset,
  ensureEditorLayers,
  updateMapLayer
} from "./map-editor";
import {
  assetToLayerKind,
  clamp,
  createExportFilename,
  createSelectionBounds,
  createToolStatus,
  formatToolName,
  getFileName,
  hasLockedSelectedAsset,
  isSelectionVisible,
  layerLabel,
  parseInteger,
  parseOptionalInteger,
  toggleSelection,
  tokenizeText,
  toolToLayerKind
} from "./map-editor-view";

const baseDocument = ensureEditorLayers(
  generateDungeon({
    heightCells: 24,
    requiredRooms: ["boss"],
    roomCount: 4,
    theme: "crypt",
    widthCells: 30
  })
);

describe("map editor view helpers", () => {
  it("maps tools and asset layers to canonical layer kinds", () => {
    expect(toolToLayerKind("paint-floor")).toBe("terrain");
    expect(toolToLayerKind("paint-empty")).toBe("terrain");
    expect(toolToLayerKind("paint-wall")).toBe("walls");
    expect(toolToLayerKind("door")).toBe("walls");
    expect(toolToLayerKind("light")).toBe("lighting");
    expect(toolToLayerKind("note")).toBe("notes");
    expect(toolToLayerKind("select")).toBe("props");

    expect(assetToLayerKind("floor")).toBe("terrain");
    expect(assetToLayerKind("wall")).toBe("walls");
    expect(assetToLayerKind("lighting")).toBe("lighting");
    expect(assetToLayerKind("annotation")).toBe("gm-only");
    expect(assetToLayerKind("object")).toBe("props");
  });

  it("formats Italian labels for layers and tools", () => {
    expect(layerLabel("walls")).toBe("Muri");
    expect(layerLabel("gm-only")).toBe("Solo GM");
    expect(formatToolName("paint-wall")).toBe("Muro");
    expect(formatToolName("select")).toBe("Seleziona");
    expect(createToolStatus("door", { x: 3, y: 4 })).toBe("Porta a 3, 4");
  });

  it("clamps, parses, and slugifies values", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-2, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
    expect(parseInteger("12", 1)).toBe(12);
    expect(parseInteger("abc", 7)).toBe(7);
    expect(parseOptionalInteger("9")).toBe(9);
    expect(parseOptionalInteger("nope")).toBeUndefined();
    expect(getFileName("packs/crypt/sarcofago.png")).toBe("sarcofago.png");
    expect(getFileName("a\\b\\c.webp")).toBe("c.webp");
    expect(tokenizeText("Old Stone Table!")).toEqual(["old", "stone", "table"]);
    expect(createExportFilename("Cripta del Boss", "png")).toBe(
      "cripta-del-boss.png"
    );
    expect(createExportFilename("***", "webp")).toBe("map.webp");
  });

  it("normalizes marquee bounds and toggles selection ids", () => {
    expect(createSelectionBounds({ x: 5, y: 8 }, { x: 1, y: 2 })).toEqual({
      maxX: 5,
      maxY: 8,
      minX: 1,
      minY: 2
    });
    expect(toggleSelection(["a", "b"], "b")).toEqual(["a"]);
    expect(toggleSelection(["a"], "c")).toEqual(["a", "c"]);
  });

  it("reports selection visibility based on layer state", () => {
    const withAsset = addPlacedAsset(
      baseDocument,
      { id: "asset-x", kind: "prop", name: "Crate", thumbnailUrl: null },
      { x: 3, y: 3 }
    );
    const assetId = withAsset.assets[0]?.id ?? "";

    expect(isSelectionVisible(withAsset, { id: assetId, type: "asset" })).toBe(
      true
    );

    const hiddenProps = updateMapLayer(withAsset, "props", { visible: false });
    expect(
      isSelectionVisible(hiddenProps, { id: assetId, type: "asset" })
    ).toBe(false);
    expect(
      isSelectionVisible(hiddenProps, { id: "door-1", type: "door" })
    ).toBe(true);
  });

  it("detects locked layers in the selected asset set", () => {
    const withAsset = addPlacedAsset(
      baseDocument,
      { id: "asset-y", kind: "prop", name: "Barrel", thumbnailUrl: null },
      { x: 4, y: 4 }
    );
    const assetId = withAsset.assets[0]?.id ?? "";
    const selected = withAsset.assets.filter((asset) => asset.id === assetId);

    expect(hasLockedSelectedAsset(withAsset, selected, [assetId])).toBe(false);

    const lockedProps = updateMapLayer(withAsset, "props", { locked: true });
    const lockedSelected = lockedProps.assets.filter(
      (asset) => asset.id === assetId
    );
    expect(hasLockedSelectedAsset(lockedProps, lockedSelected, [assetId])).toBe(
      true
    );
  });
});
