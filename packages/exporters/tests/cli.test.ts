import { describe, expect, it } from "vitest";
import { parseSessionPackArgs } from "../src/cli/session-pack";

describe("session pack CLI argument parsing", () => {
  it("parses project and export options", () => {
    expect(
      parseSessionPackArgs([
        "crypt",
        "--scale",
        "2",
        "--format",
        "webp",
        "--include-initiative",
        "--description",
        "Session prep"
      ])
    ).toMatchObject({
      description: "Session prep",
      imageFormat: "webp",
      includeInitiative: true,
      projectId: "crypt",
      scale: 2
    });
  });
});
