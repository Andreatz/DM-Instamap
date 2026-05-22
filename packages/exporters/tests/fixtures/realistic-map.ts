import {
  createMapDocument,
  type DoorSegment,
  type LightSource,
  type MapNote,
  type MapPlan,
  type MapTile,
  type RoomNode,
  type WallSegment
} from "@dm-instamap/core";

/**
 * A small but representative two-room map used to exercise VTT export fidelity:
 * boundary + internal walls, an open and a locked door, two coloured lights,
 * named rooms and a GM note. Deterministic so exports are comparable.
 */
export function createRealisticMap() {
  const width = 12;
  const height = 8;

  const tiles: MapTile[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isBoundary =
        x === 0 || y === 0 || x === width - 1 || y === height - 1;
      tiles.push({
        id: `tile-${x}-${y}`,
        kind: isBoundary ? "wall" : "floor",
        x,
        y
      });
    }
  }

  const walls: WallSegment[] = [
    {
      blocksMovement: true,
      end: { x: 12, y: 0 },
      id: "wall-north",
      roomIds: [],
      start: { x: 0, y: 0 },
      thickness: 1
    },
    {
      blocksMovement: true,
      end: { x: 12, y: 8 },
      id: "wall-east",
      roomIds: [],
      start: { x: 12, y: 0 },
      thickness: 1
    },
    {
      blocksMovement: true,
      end: { x: 0, y: 8 },
      id: "wall-south",
      roomIds: [],
      start: { x: 12, y: 8 },
      thickness: 1
    },
    {
      blocksMovement: true,
      end: { x: 0, y: 0 },
      id: "wall-west",
      roomIds: [],
      start: { x: 0, y: 8 },
      thickness: 1
    },
    {
      blocksMovement: true,
      end: { x: 6, y: 6 },
      id: "wall-divider",
      roomIds: [],
      start: { x: 6, y: 1 },
      thickness: 1
    }
  ];

  const doors: DoorSegment[] = [
    {
      id: "door-open",
      isLocked: false,
      isOpen: true,
      position: { x: 6, y: 3 },
      rotation: 90,
      roomIds: ["room-entrance", "room-vault"],
      width: 1
    },
    {
      id: "door-locked",
      isLocked: true,
      isOpen: false,
      position: { x: 9, y: 0 },
      rotation: 0,
      roomIds: ["room-vault"],
      width: 1
    }
  ];

  const lights: LightSource[] = [
    {
      color: "#ffaa66",
      flicker: true,
      id: "light-torch",
      intensity: 0.8,
      kind: "torch",
      position: { x: 3, y: 4 },
      radius: 4
    },
    {
      color: "#88bbff",
      flicker: false,
      id: "light-glow",
      intensity: 0.5,
      kind: "ambient",
      position: { x: 9, y: 4 },
      radius: 6
    }
  ];

  const rooms: RoomNode[] = [
    {
      bounds: { height: 6, width: 5, x: 1, y: 1 },
      connections: ["room-vault"],
      id: "room-entrance",
      kind: "entrance",
      label: "Entrance Hall",
      tags: ["entrance", "crypt"]
    },
    {
      bounds: { height: 6, width: 5, x: 7, y: 1 },
      connections: ["room-entrance"],
      id: "room-vault",
      kind: "room",
      label: "Sealed Vault",
      tags: ["treasure", "boss"]
    }
  ];

  const gmNotes: MapNote[] = [
    {
      id: "note-trap",
      position: { x: 9, y: 2 },
      text: "Glyph of warding on the vault floor.",
      title: "Warded Floor"
    }
  ];

  const plan: MapPlan = {
    assetPlacements: [],
    doors,
    gmNotes,
    id: "plan-realistic",
    initiative: [],
    lights,
    name: "Realistic Plan",
    notes: [
      "Players enter from the south-west.",
      "The vault is sealed by the locked north door."
    ],
    requestId: "request-realistic",
    rooms,
    walls
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
    id: "realistic-map",
    name: "Realistic Map",
    plan,
    tiles,
    width
  });
}
