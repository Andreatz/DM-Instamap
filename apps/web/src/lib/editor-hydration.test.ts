import { describe, expect, it } from "vitest";
import {
  EDITOR_ASSET_GROUP_LIMIT,
  limitAssetGroupsForHydration
} from "./editor-hydration";

function makeGroups(count: number): Array<{ id: string }> {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `group-${index}`
  }));
}

describe("limitAssetGroupsForHydration", () => {
  it("keeps every group when below the budget", () => {
    const result = limitAssetGroupsForHydration(makeGroups(120));

    expect(result.groups).toHaveLength(120);
    expect(result.truncated).toBe(false);
    expect(result.omitted).toBe(0);
  });

  it("caps a very large library to the hydration budget", () => {
    // Simulate N large groups: 5 000 in, only the budget is hydrated.
    const result = limitAssetGroupsForHydration(makeGroups(5_000));

    expect(result.groups).toHaveLength(EDITOR_ASSET_GROUP_LIMIT);
    expect(result.truncated).toBe(true);
    expect(result.omitted).toBe(5_000 - EDITOR_ASSET_GROUP_LIMIT);
    expect(result.groups[0]).toEqual({ id: "group-0" });
    expect(result.groups.at(-1)).toEqual({
      id: `group-${EDITOR_ASSET_GROUP_LIMIT - 1}`
    });
  });

  it("honors a custom limit", () => {
    const result = limitAssetGroupsForHydration(makeGroups(10), 3);

    expect(result.groups).toHaveLength(3);
    expect(result.omitted).toBe(7);
  });

  it("treats a negative limit as zero", () => {
    const result = limitAssetGroupsForHydration(makeGroups(10), -5);

    expect(result.groups).toHaveLength(0);
    expect(result.truncated).toBe(true);
  });
});
