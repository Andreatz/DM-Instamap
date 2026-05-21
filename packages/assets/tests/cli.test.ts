import { describe, expect, it } from "vitest";
import { parseGenerateAssetArgs } from "../src/cli/generate";
import { parseImportPackArgs } from "../src/cli/import-pack";

describe("asset CLI argument parsing", () => {
  it("parses import-pack options", () => {
    expect(
      parseImportPackArgs([
        "--root",
        "./local-assets/fa",
        "--preset",
        "forgotten-adventures",
        "--default-tags",
        "owned, reviewed,owned"
      ])
    ).toEqual({
      defaultTags: ["owned", "reviewed"],
      preset: "forgotten-adventures",
      root: "./local-assets/fa"
    });
  });

  it("parses generate options", () => {
    expect(
      parseGenerateAssetArgs([
        "--prompt",
        "mossy stone altar",
        "--classification",
        "prop",
        "--seed",
        "42",
        "--style-tags",
        "crypt, moss"
      ])
    ).toMatchObject({
      classification: "prop",
      prompt: "mossy stone altar",
      seed: 42,
      styleTags: ["crypt", "moss"]
    });
  });
});
