import { describe, expect, it } from "vitest";
import type { RoomNode } from "@dm-instamap/core";
import {
  generateDungeon,
  generateRoomRoleNotes,
  inferRoomRole,
  withRoomRoleNotes
} from "../src";

function room(
  overrides: Partial<RoomNode> & Pick<RoomNode, "id" | "kind">
): RoomNode {
  return {
    bounds: { height: 4, width: 4, x: 0, y: 0 },
    connections: [],
    label: "Room",
    tags: [],
    ...overrides
  } as RoomNode;
}

describe("room role inference", () => {
  it("prefers an explicit blueprint role tag", () => {
    expect(
      inferRoomRole(
        room({ id: "r", kind: "room", tags: ["role-treasure", "crypt"] })
      )
    ).toBe("treasure");
  });

  it("infers roles from kind and keywords", () => {
    expect(inferRoomRole(room({ id: "e", kind: "entrance" }))).toBe("entrance");
    expect(inferRoomRole(room({ id: "c", kind: "corridor" }))).toBe(
      "transition"
    );
    expect(
      inferRoomRole(
        room({ id: "b", kind: "room", label: "Final Room", tags: ["boss"] })
      )
    ).toBe("boss");
    expect(
      inferRoomRole(
        room({ id: "v", kind: "room", label: "Vault", tags: ["treasure"] })
      )
    ).toBe("treasure");
    expect(
      inferRoomRole(room({ id: "p", kind: "room", label: "Library", tags: [] }))
    ).toBe("puzzle");
    expect(
      inferRoomRole(
        room({ id: "h", kind: "room", label: "Flooded Pit", tags: ["water"] })
      )
    ).toBe("hazard");
    expect(
      inferRoomRole(
        room({ id: "s", kind: "room", label: "Common Room", tags: ["tavern"] })
      )
    ).toBe("social");
    expect(
      inferRoomRole(
        room({ id: "x", kind: "room", label: "Guard Post", tags: [] })
      )
    ).toBe("combat");
  });
});

describe("deterministic room role notes", () => {
  const map = generateDungeon({
    heightCells: 28,
    requiredRooms: ["boss", "library"],
    roomCount: 6,
    theme: "crypt",
    widthCells: 36
  });

  it("creates one stable note per playable room", () => {
    const first = generateRoomRoleNotes(map);
    const second = generateRoomRoleNotes(map);

    expect(first.length).toBeGreaterThan(0);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.every((note) => note.id.startsWith("note-role-"))).toBe(true);
    expect(first.some((note) => note.title === "Ingresso")).toBe(true);
  });

  it("merges notes idempotently into the plan", () => {
    const once = withRoomRoleNotes(map);
    const twice = withRoomRoleNotes(once);

    const roleNotes =
      once.plan?.gmNotes.filter((note) => note.id.startsWith("note-role-")) ??
      [];
    expect(roleNotes.length).toBe(generateRoomRoleNotes(map).length);
    expect(JSON.stringify(twice.plan?.gmNotes)).toBe(
      JSON.stringify(once.plan?.gmNotes)
    );
  });
});
