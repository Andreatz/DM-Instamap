import { describe, expect, it } from "vitest";
import { createAssetCandidate } from "../src";

describe("createAssetCandidate", () => {
  it("keeps asset classification local", () => {
    const candidate = createAssetCandidate("tiles/stone-floor.png");

    expect(candidate.extension).toBe("png");
    expect(candidate.source).toBe("local");
  });
});
