import { describe, expect, it } from "vitest";
import { createStarterProject } from "./starter-project";

describe("createStarterProject", () => {
  it("creates an editable starter map", () => {
    const project = createStarterProject();

    expect(project.map.editable).toBe(true);
    expect(project.map.tiles.length).toBeGreaterThan(0);
    expect(project.modules).toContain("Simple dungeon generator");
  });
});
