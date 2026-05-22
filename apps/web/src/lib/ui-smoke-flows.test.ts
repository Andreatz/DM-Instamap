import { describe, expect, it } from "vitest";
import { UI_SMOKE_FLOWS, validateUiSmokeFlows } from "./ui-smoke-flows";

describe("UI_SMOKE_FLOWS", () => {
  it("keeps at least eight local-first UI flows covered by lightweight tests", () => {
    expect(validateUiSmokeFlows()).toEqual([]);
    expect(UI_SMOKE_FLOWS.length).toBeGreaterThanOrEqual(8);
    expect(UI_SMOKE_FLOWS.every((flow) => flow.localOnly)).toBe(true);
    expect(UI_SMOKE_FLOWS.every((flow) => !flow.requiresExternalApi)).toBe(
      true
    );
  });

  it("tracks the fragile MVP flows from the corrective roadmap", () => {
    expect(UI_SMOKE_FLOWS.map((flow) => flow.id)).toEqual(
      expect.arrayContaining([
        "home-loads",
        "create-project-wizard",
        "editor-save-reopen",
        "snapshots-diff-restore",
        "export-session-pack",
        "asset-browser-empty-manifest",
        "manual-ai-bridge",
        "generate-preview"
      ])
    );
  });

  it("marks the save/export/editor flows as critical", () => {
    const criticalIds = UI_SMOKE_FLOWS.filter((flow) => flow.critical).map(
      (flow) => flow.id
    );

    expect(criticalIds).toEqual(
      expect.arrayContaining([
        "create-project-wizard",
        "editor-save-reopen",
        "snapshots-diff-restore",
        "export-session-pack"
      ])
    );
  });
});
