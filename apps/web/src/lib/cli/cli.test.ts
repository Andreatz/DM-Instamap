import { describe, expect, it } from "vitest";
import { parseCampaignsArgs } from "./campaigns";
import { parseDataArgs } from "./data";
import { parseSnapshotsArgs } from "./snapshots";

describe("web local-data CLI argument parsing", () => {
  it("parses snapshot create", () => {
    expect(
      parseSnapshotsArgs(["create", "crypt", "--label", "before boss"])
    ).toEqual({
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
    expect(
      parseCampaignsArgs([
        "create",
        "--name",
        "Whispering Woods",
        "--tags",
        "fey, local"
      ])
    ).toEqual({
      description: undefined,
      name: "Whispering Woods",
      tags: ["fey", "local"],
      type: "create"
    });
  });

  it("parses data backup with default destination", () => {
    expect(parseDataArgs(["backup"])).toEqual({
      destination: "backups",
      includeIndexes: false,
      type: "backup"
    });
  });

  it("parses data backup with custom destination and indexes", () => {
    expect(
      parseDataArgs(["backup", "--out", "/mnt/usb", "--include-indexes"])
    ).toEqual({
      destination: "/mnt/usb",
      includeIndexes: true,
      type: "backup"
    });
  });

  it("parses data restore with flags", () => {
    expect(
      parseDataArgs(["restore", "backups/today", "--dry-run", "--force"])
    ).toEqual({
      backupDir: "backups/today",
      dryRun: true,
      force: true,
      type: "restore"
    });
  });
});
