import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  describeExportFormat,
  describeExportMode,
  readProjectExportHistory,
  recordProjectExport,
  summarizeExportHistory
} from "./project-export-history";

describe("project export history", () => {
  it("returns an empty history when nothing has been exported", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "dm-instamap-exports-"));
    const history = await readProjectExportHistory("demo-project", { outputRoot });
    expect(history).toEqual([]);
  });

  it("records exports newest-first and summarizes them", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "dm-instamap-exports-"));

    await recordProjectExport(
      "demo-project",
      { filename: "demo.png", format: "png", includeGrid: true, mode: "gm", scale: 2 },
      { outputRoot, now: new Date("2026-05-01T10:00:00.000Z") }
    );
    await recordProjectExport(
      "demo-project",
      { filename: "demo-session-pack.zip", format: "session-pack", mode: "gm" },
      { outputRoot, now: new Date("2026-05-02T10:00:00.000Z") }
    );

    const history = await readProjectExportHistory("demo-project", { outputRoot });
    expect(history).toHaveLength(2);
    expect(history[0]?.format).toBe("session-pack");
    expect(history[1]?.format).toBe("png");
    expect(history[1]?.scale).toBe(2);

    const summary = summarizeExportHistory(history);
    expect(summary.total).toBe(2);
    expect(summary.lastFormat).toBe("session-pack");
    expect(summary.lastExportAt).toBe("2026-05-02T10:00:00.000Z");
  });

  it("rejects unsafe project ids by recording nothing", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "dm-instamap-exports-"));
    const result = await recordProjectExport(
      "../escape",
      { filename: "x.png", format: "png", mode: "gm" },
      { outputRoot }
    );
    expect(result).toBeNull();
  });

  it("provides Italian labels for formats and modes", () => {
    expect(describeExportFormat("session-pack")).toBe("Session Pack");
    expect(describeExportFormat("dd2vtt")).toMatch(/VTT/);
    expect(describeExportMode("player")).toBe("Giocatori");
    expect(describeExportMode("gm")).toBe("Game Master");
  });
});
