import { describe, expect, it } from "vitest";
import { parseAiBlueprintArgs } from "../src/cli/blueprint";
import { parseAiPlanArgs } from "../src/cli/plan";

describe("AI CLI argument parsing", () => {
  it("parses blueprint request text", () => {
    expect(
      parseAiBlueprintArgs(["crypt below cathedral", "--max-retries", "2"])
    ).toEqual({
      maxRetries: 2,
      request: "crypt below cathedral"
    });
  });

  it("parses plan request text", () => {
    expect(parseAiPlanArgs(["outdoor shrine", "with river"])).toEqual({
      maxRetries: undefined,
      request: "outdoor shrine with river"
    });
  });
});
