import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateLocalPath } from "./local-paths";

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
});
