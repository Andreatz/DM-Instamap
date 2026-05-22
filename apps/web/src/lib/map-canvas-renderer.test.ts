import { describe, expect, it, vi } from "vitest";
import { generateDungeon } from "@dm-instamap/generator";
import { addLightAtCell, addPlacedAsset, ensureEditorLayers, setTileKind, updateMapLayer } from "./map-editor";
import { drawMapCanvas, getTileColor, type MapCanvasRenderInput } from "./map-canvas-renderer";

function createMockContext() {
  const calls: Record<string, number> = {};
  const record = (name: string) =>
    vi.fn(() => {
      calls[name] = (calls[name] ?? 0) + 1;
    });

  const context = {
    arc: record("arc"),
    beginPath: record("beginPath"),
    clearRect: record("clearRect"),
    closePath: record("closePath"),
    fill: record("fill"),
    fillRect: record("fillRect"),
    fillText: record("fillText"),
    lineTo: record("lineTo"),
    moveTo: record("moveTo"),
    restore: record("restore"),
    rotate: record("rotate"),
    save: record("save"),
    scale: record("scale"),
    setLineDash: record("setLineDash"),
    stroke: record("stroke"),
    strokeRect: record("strokeRect"),
    translate: record("translate"),
    fillStyle: "",
    font: "",
    globalAlpha: 1,
    lineCap: "butt",
    lineWidth: 1,
    strokeStyle: "",
    textAlign: "start",
    textBaseline: "alphabetic"
  };

  return { calls, context };
}

function createMockCanvas(context: unknown): HTMLCanvasElement {
  return { getContext: () => context } as unknown as HTMLCanvasElement;
}

const document = ensureEditorLayers(
  generateDungeon({
    heightCells: 20,
    requiredRooms: ["boss"],
    roomCount: 4,
    theme: "crypt",
    widthCells: 26
  })
);

function createInput(doc = document): MapCanvasRenderInput {
  return {
    canvasSize: { height: 480, width: 640 },
    document: doc,
    hoverCell: { x: 2, y: 2 },
    layers: doc.layers,
    marqueeSelection: { current: { x: 4, y: 4 }, start: { x: 1, y: 1 } },
    selectedAssetId: null,
    selectedAssetIds: [],
    selectedDoor: null,
    selectedLight: null,
    selectedNote: null,
    selectedRoomId: doc.plan?.rooms[0]?.id ?? null,
    visibleCellKeys: [],
    viewport: { offsetX: 24, offsetY: 24, zoom: 1 }
  };
}

describe("map canvas renderer", () => {
  it("returns palette colors per tile kind", () => {
    expect(getTileColor("floor")).toBe("#a88d5d");
    expect(getTileColor("wall")).toBe("#394348");
    expect(getTileColor("door")).toBe("#8a6431");
    expect(getTileColor("empty")).toBe("#080a0b");
    expect(getTileColor("unknown")).toBe("#080a0b");
  });

  it("clears, transforms, and paints the scene without throwing", () => {
    const { calls, context } = createMockContext();
    const withAsset = addLightAtCell(addPlacedAsset(document, { id: "asset-z", kind: "prop", name: "Crate", thumbnailUrl: null }, { x: 3, y: 3 }), { x: 5, y: 5 });
    const painted = setTileKind(withAsset, { x: 1, y: 1 }, "floor");

    drawMapCanvas(createMockCanvas(context), createInput(painted));

    expect(calls.clearRect).toBe(1);
    expect(calls.translate).toBeGreaterThanOrEqual(1);
    expect(calls.scale).toBeGreaterThanOrEqual(1);
    expect(calls.fillRect).toBeGreaterThan(0);
    expect(calls.strokeRect).toBeGreaterThan(0);
    // hover + marquee both stroke rectangles
    expect(calls.setLineDash).toBe(2);
  });

  it("skips drawing layers that are hidden", () => {
    const hidden = updateMapLayer(
      updateMapLayer(updateMapLayer(document, "terrain", { visible: false }), "walls", { visible: false }),
      "notes",
      { visible: false }
    );
    const { calls: hiddenCalls, context: hiddenContext } = createMockContext();
    const { calls: shownCalls, context: shownContext } = createMockContext();

    drawMapCanvas(createMockCanvas(hiddenContext), createInput(hidden));
    drawMapCanvas(createMockCanvas(shownContext), createInput(document));

    expect(hiddenCalls.fillRect ?? 0).toBeLessThan(shownCalls.fillRect ?? 0);
  });

  it("ignores canvases without a 2d context", () => {
    expect(() => drawMapCanvas(createMockCanvas(null), createInput())).not.toThrow();
  });
});
