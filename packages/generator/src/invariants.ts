import type { MapDocument, RoomNode } from "@dm-instamap/core";
import type { MultiFloorDungeon } from "./algorithms";

const VALID_TILE_KINDS = new Set<string>(["floor", "wall", "door", "empty"]);
const WALKABLE_KINDS = new Set<string>(["floor", "door"]);
const PLAYABLE_ROOM_KINDS = new Set<RoomNode["kind"]>([
  "entrance",
  "room",
  "corridor",
  "secret",
  "service",
  "stairs"
]);

export type InvariantResult = {
  ok: boolean;
  violations: string[];
};

function key(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Largest connected component of walkable (floor/door) cells, as a set of
 * "x,y" keys. 4-connectivity flood fill.
 */
function largestWalkableComponent(walkable: Set<string>): Set<string> {
  const visited = new Set<string>();
  let best = new Set<string>();

  for (const start of walkable) {
    if (visited.has(start)) {
      continue;
    }

    const component = new Set<string>();
    const stack = [start];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current)) {
        continue;
      }
      visited.add(current);
      component.add(current);

      const [cx, cy] = current.split(",").map(Number) as [number, number];
      for (const [nx, ny] of [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1]
      ] as Array<[number, number]>) {
        const neighbor = key(nx, ny);
        if (walkable.has(neighbor) && !visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    if (component.size > best.size) {
      best = component;
    }
  }

  return best;
}

/**
 * Hard playability invariants for a single generated map document:
 * - only valid tile kinds (no debug tiles);
 * - doors in bounds and on a door tile;
 * - placed assets in bounds and inside the structure (not on empty cells);
 * - every playable room reachable through the main walkable region.
 */
export function checkMapInvariants(document: MapDocument): InvariantResult {
  const violations: string[] = [];
  const { height, width } = document;
  const inBounds = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height;

  const tileKindAt = new Map<string, string>();
  const walkable = new Set<string>();
  for (const tile of document.tiles) {
    if (!VALID_TILE_KINDS.has(tile.kind)) {
      violations.push(
        `tile (${tile.x},${tile.y}) has invalid kind "${tile.kind}"`
      );
    }
    tileKindAt.set(key(tile.x, tile.y), tile.kind);
    if (WALKABLE_KINDS.has(tile.kind)) {
      walkable.add(key(tile.x, tile.y));
    }
  }

  for (const door of document.plan?.doors ?? []) {
    if (!inBounds(door.position.x, door.position.y)) {
      violations.push(`door ${door.id} is out of bounds`);
      continue;
    }
    // A door must sit on a walkable threshold (floor or door tile), i.e. a
    // valid cell connecting two areas, not a wall or empty cell.
    if (
      !WALKABLE_KINDS.has(
        tileKindAt.get(key(door.position.x, door.position.y)) ?? "empty"
      )
    ) {
      violations.push(`door ${door.id} is not on a walkable cell`);
    }
  }

  for (const asset of document.assets) {
    const x = Math.round(asset.position.x);
    const y = Math.round(asset.position.y);
    if (!inBounds(x, y)) {
      violations.push(`asset ${asset.id} is out of bounds`);
      continue;
    }
    if (tileKindAt.get(key(x, y)) === "empty") {
      violations.push(`asset ${asset.id} is outside the structure`);
    }
  }

  const mainComponent = largestWalkableComponent(walkable);
  const playableRooms = (document.plan?.rooms ?? []).filter((room) =>
    PLAYABLE_ROOM_KINDS.has(room.kind)
  );

  for (const room of playableRooms) {
    let hasWalkableCell = false;
    let reachable = false;

    for (
      let y = room.bounds.y;
      y < room.bounds.y + room.bounds.height;
      y += 1
    ) {
      for (
        let x = room.bounds.x;
        x < room.bounds.x + room.bounds.width;
        x += 1
      ) {
        if (!walkable.has(key(x, y))) {
          continue;
        }
        hasWalkableCell = true;
        if (mainComponent.has(key(x, y))) {
          reachable = true;
        }
      }
    }

    if (hasWalkableCell && !reachable) {
      violations.push(`room ${room.id} is not reachable from the main area`);
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Invariants for a multi-floor dungeon: each floor satisfies the single-map
 * invariants, and every stair link is paired and references stairs rooms that
 * exist on both connected floors.
 */
export function checkMultiFloorInvariants(
  result: MultiFloorDungeon
): InvariantResult {
  const violations: string[] = [];

  result.floors.forEach((floor, index) => {
    const floorResult = checkMapInvariants(floor);
    for (const violation of floorResult.violations) {
      violations.push(`floor ${index + 1}: ${violation}`);
    }
  });

  if (result.floors.length >= 2 && result.links.length === 0) {
    violations.push("multi-floor dungeon has no stair links between floors");
  }

  for (const link of result.links) {
    const upper = result.floors[link.fromFloor];
    const lower = result.floors[link.toFloor];

    if (!upper || !lower) {
      violations.push(
        `stair link references missing floor (${link.fromFloor} -> ${link.toFloor})`
      );
      continue;
    }

    const hasDown = (upper.plan?.rooms ?? []).some(
      (room) => room.id === link.fromRoomId && room.kind === "stairs"
    );
    const hasUp = (lower.plan?.rooms ?? []).some(
      (room) => room.id === link.toRoomId && room.kind === "stairs"
    );

    if (!hasDown) {
      violations.push(`stair link ${link.fromRoomId} missing on source floor`);
    }
    if (!hasUp) {
      violations.push(`stair link ${link.toRoomId} missing on target floor`);
    }
  }

  return { ok: violations.length === 0, violations };
}
