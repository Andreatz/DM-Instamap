import { describe, expect, it } from "vitest";
import { createSimpleDungeon, generateDungeon } from "../src";

describe("createSimpleDungeon", () => {
  it("creates an editable room with boundary walls", () => {
    const map = createSimpleDungeon({ height: 4, width: 4 });

    expect(map.editable).toBe(true);
    expect(map.tiles).toHaveLength(16);
    expect(map.tiles.find((tile) => tile.x === 0 && tile.y === 0)?.kind).toBe(
      "wall"
    );
    expect(map.tiles.find((tile) => tile.x === 1 && tile.y === 1)?.kind).toBe(
      "floor"
    );
  });
});

describe("generateDungeon", () => {
  it("creates non-overlapping rectangular rooms", () => {
    const map = generateDungeon({
      heightCells: 40,
      roomCount: 8,
      theme: "crypt",
      widthCells: 56
    });
    const rooms = getRooms(map);

    for (let leftIndex = 0; leftIndex < rooms.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < rooms.length;
        rightIndex += 1
      ) {
        expect(rectsOverlap(rooms[leftIndex]!, rooms[rightIndex]!)).toBe(false);
      }
    }
  });

  it("connects every room to the room graph", () => {
    const map = generateDungeon({
      heightCells: 42,
      requiredRooms: ["library", "armory"],
      roomCount: 9,
      theme: "keep",
      widthCells: 60
    });
    const rooms = getRooms(map);
    const reachable = collectReachableRoomIds(map, "room-entrance");

    expect(rooms.every((room) => reachable.has(room.id))).toBe(true);
  });

  it("always includes an entrance room", () => {
    const map = generateDungeon({
      heightCells: 32,
      roomCount: 5,
      theme: "cave",
      widthCells: 44
    });

    expect(
      map.plan?.rooms.find((room) => room.id === "room-entrance")
    ).toMatchObject({
      kind: "entrance",
      label: "Entrance"
    });
  });

  it("includes a final room when requested", () => {
    const map = generateDungeon({
      heightCells: 36,
      requiredRooms: ["boss"],
      roomCount: 6,
      theme: "infernal",
      widthCells: 48
    });

    expect(
      map.plan?.rooms.find((room) => room.id === "room-final")
    ).toMatchObject({
      label: "Final Room",
      tags: expect.arrayContaining(["boss", "final"])
    });
  });

  it("adds doors and surrounding walls", () => {
    const map = generateDungeon({
      heightCells: 32,
      roomCount: 5,
      theme: "ruin",
      widthCells: 44
    });

    expect(map.plan?.doors.length).toBeGreaterThan(0);
    expect(map.plan?.walls.length).toBeGreaterThan(0);
    expect(map.tiles.some((tile) => tile.kind === "door")).toBe(true);
    expect(map.tiles.some((tile) => tile.kind === "wall")).toBe(true);
  });
});

type BoundsLike = {
  bounds: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  id: string;
};

function getRooms(map: ReturnType<typeof generateDungeon>) {
  return (
    map.plan?.rooms.filter(
      (room) => room.kind === "room" || room.kind === "entrance"
    ) ?? []
  );
}

function rectsOverlap(left: BoundsLike, right: BoundsLike): boolean {
  return (
    left.bounds.x < right.bounds.x + right.bounds.width &&
    left.bounds.x + left.bounds.width > right.bounds.x &&
    left.bounds.y < right.bounds.y + right.bounds.height &&
    left.bounds.y + left.bounds.height > right.bounds.y
  );
}

function collectReachableRoomIds(
  map: ReturnType<typeof generateDungeon>,
  startId: string
): Set<string> {
  const nodes = new Map((map.plan?.rooms ?? []).map((room) => [room.id, room]));
  const queue = [startId];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift() as string;

    if (seen.has(id)) {
      continue;
    }

    seen.add(id);

    for (const connection of nodes.get(id)?.connections ?? []) {
      queue.push(connection);
    }
  }

  return new Set(
    [...seen].filter((id) => {
      const node = nodes.get(id);
      return node?.kind === "room" || node?.kind === "entrance";
    })
  );
}
