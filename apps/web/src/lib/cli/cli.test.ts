import { describe, expect, it } from "vitest";
import { parseCampaignsArgs } from "./campaigns";
import { parseSnapshotsArgs } from "./snapshots";

describe("web local-data CLI argument parsing", () => {
  it("parses snapshot create", () => {
    expect(parseSnapshotsArgs(["create", "crypt", "--label", "before boss"])).toEqual({
      label: "before boss",
      projectId: "crypt",
      type: "create"
    });
  });

  it("parses snapshot restore", () => {
    expect(parseSnapshotsArgs(["restore", "crypt", "abc123"])).toEqual({
      contentHash: "abc123",
      projectId: "crypt",
      type: "restore"
    });
  });

  it("parses campaign create", () => {
    expect(parseCampaignsArgs(["create", "--name", "Whispering Woods", "--tags", "fey, local"])).toEqual({
      description: undefined,
      name: "Whispering Woods",
      tags: ["fey", "local"],
      type: "create"
    });
  });
});
