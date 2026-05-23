import { describe, expect, it } from "vitest";
import {
  createMapDocument,
  type MapNote,
  type MapPlan,
  type RoomNode
} from "@dm-instamap/core";
import { exportFoundryModule } from "../src";

const XSS = "<script>alert('xss')</script>";

function maliciousDocument() {
  const rooms: RoomNode[] = [
    {
      bounds: { height: 3, width: 4, x: 0, y: 0 },
      connections: [`conn ${XSS}`],
      id: "room-evil",
      kind: "room",
      label: `Room ${XSS}`,
      tags: [`tag ${XSS}`]
    }
  ];
  const gmNotes: MapNote[] = [
    {
      id: "note-evil",
      position: { x: 1, y: 1 },
      text: `<img src=x onerror=alert(1)> ${XSS}`,
      title: "Evil Note"
    }
  ];
  const plan: MapPlan = {
    assetPlacements: [],
    doors: [],
    gmNotes,
    id: "plan-evil",
    initiative: [],
    lights: [],
    name: `Plan ${XSS}`,
    notes: [`Plan note ${XSS}`],
    requestId: "request-evil",
    rooms,
    walls: []
  };

  return createMapDocument({
    grid: {
      cellSize: 5,
      height: 4,
      pixelsPerCell: 70,
      type: "square",
      unit: "ft",
      width: 5
    },
    height: 4,
    id: "foundry-xss-test",
    name: `Map ${XSS}`,
    plan,
    tiles: Array.from({ length: 20 }, (_unused, index) => ({
      id: `tile-${index}`,
      kind: "floor" as const,
      x: index % 5,
      y: Math.floor(index / 5)
    })),
    width: 5
  });
}

describe("Foundry journal sanitization", () => {
  it("escapes HTML in every journal content field", async () => {
    const result = await exportFoundryModule(maliciousDocument(), {
      moduleId: "xss-test"
    });

    const allContent = result.journalJson
      .flatMap((entry) => [
        entry.content,
        ...entry.pages.map((page) => page.text.content)
      ])
      .join("\n");

    // No raw tag opener survives: every "<" from user data is escaped, so an
    // <img>/<script> payload becomes inert text instead of a live element.
    expect(allContent).not.toContain("<script>");
    expect(allContent).not.toContain("<img");
    // The text is preserved in escaped form, so DMs still read it.
    expect(allContent).toContain("&lt;script&gt;");
  });
});
