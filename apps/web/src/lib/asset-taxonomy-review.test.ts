import { describe, expect, it } from "vitest";
import {
  buildReviewOverrideEntries,
  memberGroupId,
  parseCsv,
  type ReviewMember
} from "./asset-taxonomy-review";

function member(overrides: Partial<ReviewMember>): ReviewMember {
  return {
    assetGroups: ["table"],
    macroCategory: "furniture",
    path: "textures/objects/table_01.png",
    status: "needs-review",
    themeTags: [],
    ...overrides
  };
}

describe("memberGroupId", () => {
  it("keys by macroCategory / first assetGroup", () => {
    expect(
      memberGroupId({ assetGroups: ["table"], macroCategory: "furniture" })
    ).toBe("furniture/table");
    expect(memberGroupId({ assetGroups: [], macroCategory: "unknown" })).toBe(
      "unknown/unknown"
    );
  });
});

describe("buildReviewOverrideEntries", () => {
  it("confirm only writes entries for non-approved members", () => {
    const members = [
      member({ path: "a.png", status: "needs-review" }),
      member({ path: "b.png", status: "approved" })
    ];
    const entries = buildReviewOverrideEntries(members, {
      groupId: "furniture/table",
      type: "confirm"
    });
    expect(entries).toEqual([{ entry: { status: "approved" }, path: "a.png" }]);
  });

  it("set-status only writes entries that change", () => {
    const members = [
      member({ path: "a.png", status: "approved" }),
      member({ path: "b.png", status: "needs-review" })
    ];
    const entries = buildReviewOverrideEntries(members, {
      groupId: "furniture/table",
      status: "quarantine",
      type: "set-status"
    });
    expect(entries.map((entry) => entry.path)).toEqual(["a.png", "b.png"]);
    expect(entries[0]?.entry).toEqual({ status: "quarantine" });
  });

  it("correct writes only the fields that differ", () => {
    const members = [
      member({
        path: "a.png",
        macroCategory: "prop",
        assetGroups: ["misc"],
        themeTags: [],
        status: "needs-review"
      })
    ];
    const entries = buildReviewOverrideEntries(members, {
      assetGroups: ["table"],
      groupId: "prop/misc",
      macroCategory: "furniture",
      status: "approved",
      themeTags: ["tavern"],
      type: "correct"
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.entry).toEqual({
      assetGroups: ["table"],
      macroCategory: "furniture",
      status: "approved",
      themeTags: ["tavern"]
    });
  });

  it("correct skips members already matching the target", () => {
    const members = [
      member({
        path: "a.png",
        macroCategory: "furniture",
        assetGroups: ["table"],
        status: "approved"
      })
    ];
    const entries = buildReviewOverrideEntries(members, {
      assetGroups: ["table"],
      groupId: "furniture/table",
      macroCategory: "furniture",
      status: "approved",
      type: "correct"
    });
    expect(entries).toHaveLength(0);
  });
});

describe("parseCsv", () => {
  it("splits, trims and lowercases", () => {
    expect(parseCsv(" Table , CHAIR ,, bench ")).toEqual([
      "table",
      "chair",
      "bench"
    ]);
  });
});
