import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSafeWorkspaceId,
  LocalPathValidationError,
  resolveWithinWorkspace,
  validateLocalPath
} from "./local-paths";

describe("local path validation", () => {
  function workspaceRoot() {
    return mkdtempSync(path.join(os.tmpdir(), "dm-instamap-workspace-"));
  }

  it("resolves relative paths inside the workspace", () => {
    const root = workspaceRoot();

    expect(
      validateLocalPath({
        inputPath: "local-assets/pack",
        workspaceRoot: root
      })
    ).toBe(path.join(root, "local-assets", "pack"));
  });

  it("rejects relative path traversal outside the workspace", () => {
    const root = workspaceRoot();

    expect(() =>
      validateLocalPath({
        inputPath: "../secret-pack",
        workspaceRoot: root
      })
    ).toThrow(/workspace/);
  });

  it("rejects absolute paths outside the workspace by default", () => {
    const root = workspaceRoot();
    const outside = path.join(os.tmpdir(), "dm-instamap-outside-pack");

    expect(() =>
      validateLocalPath({
        inputPath: outside,
        workspaceRoot: root
      })
    ).toThrow(/workspace/);
  });

  it("allows specific absolute local paths when explicitly enabled", () => {
    const root = workspaceRoot();
    const outside = path.join(os.tmpdir(), "dm-instamap-specific-pack");

    expect(
      validateLocalPath({
        allowAbsoluteOutsideWorkspace: true,
        inputPath: outside,
        workspaceRoot: root
      })
    ).toBe(path.resolve(outside));
  });

  it("rejects broad local roots even when absolute paths are enabled", () => {
    const root = workspaceRoot();

    expect(() =>
      validateLocalPath({
        allowAbsoluteOutsideWorkspace: true,
        inputPath: os.homedir(),
        workspaceRoot: root
      })
    ).toThrow(/broad or system/);
  });

  it("can require the path to exist", () => {
    const root = workspaceRoot();

    expect(() =>
      validateLocalPath({
        inputPath: "missing-pack",
        mustExist: true,
        workspaceRoot: root
      })
    ).toThrow(/does not exist/);
  });

  it("rejects the drive root even when absolute paths are enabled", () => {
    const root = workspaceRoot();
    const driveRoot = path.parse(os.tmpdir()).root;

    expect(() =>
      validateLocalPath({
        allowAbsoluteOutsideWorkspace: true,
        inputPath: driveRoot,
        workspaceRoot: root
      })
    ).toThrow(/broad or system/);
  });

  it("rejects system folders even when absolute paths are enabled", () => {
    const root = workspaceRoot();
    const systemFolder =
      process.platform === "win32" ? "C:\\Windows\\System32" : "/etc";

    expect(() =>
      validateLocalPath({
        allowAbsoluteOutsideWorkspace: true,
        inputPath: systemFolder,
        workspaceRoot: root
      })
    ).toThrow(/broad or system/);
  });
});

describe("assertSafeWorkspaceId", () => {
  it("accepts safe id segments", () => {
    expect(assertSafeWorkspaceId("dungeon-01")).toBe("dungeon-01");
    expect(assertSafeWorkspaceId("Asset_42.webp", "assetId")).toBe(
      "Asset_42.webp"
    );
  });

  it("rejects traversal and separators", () => {
    for (const value of [
      "",
      "..",
      "../secret",
      "a/b",
      "a\\b",
      ".hidden",
      "with space",
      "x".repeat(200)
    ]) {
      expect(() => assertSafeWorkspaceId(value)).toThrow(
        LocalPathValidationError
      );
    }
  });
});

describe("resolveWithinWorkspace", () => {
  it("joins segments inside the workspace", () => {
    const root = path.resolve("/tmp/dm-instamap-ws");

    expect(resolveWithinWorkspace(root, "data", "previews", "a.webp")).toBe(
      path.resolve(root, "data", "previews", "a.webp")
    );
  });

  it("rejects segments that escape the workspace", () => {
    const root = path.resolve("/tmp/dm-instamap-ws");

    expect(() => resolveWithinWorkspace(root, "..", "..", "etc")).toThrow(
      LocalPathValidationError
    );
  });
});
