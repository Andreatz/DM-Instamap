import type { RoomNode } from "@dm-instamap/core";
import { describe, expect, it } from "vitest";
import { matchAssetGroupsForRoom, type MatchableAssetGroup } from "../src";

const cryptRoom: RoomNode = {
  bounds: { height: 6, width: 7, x: 2, y: 3 },
  connections: [],
  id: "room-final",
  kind: "room",
  label: "Final Room",
  tags: ["room", "final", "boss", "crypt"]
};

describe("matchAssetGroupsForRoom", () => {
  it("selects local asset groups by kind, tags, theme, usableFor and quality", () => {
    const groups: MatchableAssetGroup[] = [
      {
        assetIds: ["asset-throne"],
        id: "group-throne",
        kind: "furniture",
        name: "Crypt Throne",
        qualityScore: 92,
        tags: ["crypt", "boss", "stone"],
        theme: "crypt",
        usableFor: ["boss", "final"]
      },
      {
        assetIds: ["asset-tree"],
        id: "group-tree",
        kind: "terrain",
        name: "Forest Tree",
        qualityScore: 98,
        tags: ["forest"],
        theme: "forest",
        usableFor: ["wilderness"]
      }
    ];

    const matches = matchAssetGroupsForRoom({
      groups,
      room: cryptRoom,
      theme: "crypt"
    });

    expect(matches[0]?.group.id).toBe("group-throne");
    expect(matches[0]?.score).toBeGreaterThan(0.8);
    expect(matches[0]?.reasons.map((reason) => reason.label)).toEqual([
      "kind",
      "tags",
      "theme",
      "usableFor",
      "quality"
    ]);
  });

  it("prefers better fitting tags over unrelated high quality groups", () => {
    const groups: MatchableAssetGroup[] = [
      {
        id: "group-generic-prop",
        kind: "prop",
        name: "Generic Prop",
        qualityScore: 100,
        tags: ["market"],
        usableFor: ["city"]
      },
      {
        id: "group-altar",
        kind: "decoration",
        name: "Boss Altar",
        qualityScore: 55,
        tags: ["crypt", "boss"],
        theme: "crypt",
        usableFor: ["final"]
      }
    ];

    const matches = matchAssetGroupsForRoom({
      groups,
      room: cryptRoom,
      theme: "crypt"
    });

    expect(matches[0]?.group.id).toBe("group-altar");
    expect(matches[0]?.reasons.some((reason) => reason.label === "theme")).toBe(
      true
    );
  });

  it("supports explicit preferred kind filters", () => {
    const matches = matchAssetGroupsForRoom({
      groups: [
        {
          id: "group-door",
          kind: "door",
          name: "Iron Door",
          qualityScore: 70,
          tags: ["crypt"],
          usableFor: ["entrance"]
        },
        {
          id: "group-chair",
          kind: "furniture",
          name: "Chair",
          qualityScore: 90,
          tags: ["crypt"]
        }
      ],
      preferredKinds: ["door"],
      room: cryptRoom,
      theme: "crypt"
    });

    expect(matches[0]?.group.id).toBe("group-door");
  });
});
