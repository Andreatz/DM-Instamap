import { describe, expect, it } from "vitest";
import * as browser from "../src/browser";
import * as server from "../src/server";

describe("core entrypoints", () => {
  it("keeps the browser entrypoint limited to browser-safe model APIs", () => {
    expect(browser.MapDocumentSchema).toBeDefined();
    expect(browser.createMapDocument).toBeDefined();
    expect("readSnapshotFromDirectory" in browser).toBe(false);
    expect("writeSnapshotToDirectory" in browser).toBe(false);
  });

  it("exposes filesystem-backed snapshot APIs only from the server entrypoint", () => {
    expect(server.MapDocumentSchema).toBeDefined();
    expect(server.readSnapshotFromDirectory).toBeDefined();
    expect(server.writeSnapshotToDirectory).toBeDefined();
  });
});
