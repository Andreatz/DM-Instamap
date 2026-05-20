import { describe, expect, it } from "vitest";
import {
  buildChatGptBridgePrompt,
  buildRepairPrompt,
  getBridgeStatus,
  searchBridgeContext,
  validateBridgeResponse
} from "../src";

const assetGroups = [
  {
    assetCount: 4,
    id: "group-library",
    kind: "furniture",
    name: "Library Shelves",
    qualityScore: 88,
    tags: ["library", "book", "shelf"],
    theme: "keep",
    usableFor: ["library"]
  },
  {
    assetCount: 2,
    id: "group-forge",
    kind: "prop",
    name: "Forge Tools",
    qualityScore: 74,
    tags: ["forge", "anvil"],
    usableFor: ["forge"]
  }
];

const references = [
  {
    height: 900,
    id: "reference-library",
    mapType: "building",
    mapTypeConfidence: 0.82,
    path: "keeps/library-map.png",
    styleDna: {
      density: "dense",
      layoutTraits: ["room-cluster"],
      mood: ["urban", "warm-lit"],
      promptSummary: "Warm-lit keep library battlemap with dense room-cluster layout.",
      recommendedAssetTags: ["library", "bookshelf", "table"],
      visualTags: ["building", "dense", "warm-lit"]
    },
    tags: ["library", "keep"],
    width: 1200
  }
];

const assetSearchResults = [
  {
    assetId: "asset-bookshelf",
    classification: "furniture",
    reason: "matched library, shelf",
    relativePath: "props/bookshelf.png",
    score: 0.91,
    tags: ["library", "shelf"]
  }
];

describe("getBridgeStatus", () => {
  it("keeps integration manual and disabled", () => {
    expect(getBridgeStatus()).toEqual({
      enabled: false,
      mode: "manual-only"
    });
  });
});

describe("searchBridgeContext", () => {
  it("finds local asset groups and references by request tokens", () => {
    const context = searchBridgeContext({
      assetGroups,
      references,
      userRequest: "Make a keep library with shelves"
    });

    expect(context.assetGroups[0]?.id).toBe("group-library");
    expect(context.references[0]?.id).toBe("reference-library");
  });
});

describe("buildChatGptBridgePrompt", () => {
  it("includes the user request, local context, and required schema", () => {
    const prompt = buildChatGptBridgePrompt({
      assetGroups,
      assetSearchResults,
      references,
      userRequest: "Create a haunted library."
    });

    expect(prompt).toContain("Create a haunted library.");
    expect(prompt).toContain("AVAILABLE ASSET GROUPS");
    expect(prompt).toContain("LOCAL ASSET SEARCH RESULTS");
    expect(prompt).toContain("asset-bookshelf");
    expect(prompt).toContain("SELECTED REFERENCE SUMMARIES");
    expect(prompt).toContain("REFERENCE STYLE DNA");
    expect(prompt).toContain("Warm-lit keep library battlemap");
    expect(prompt).toContain("REQUIRED JSON SCHEMA");
    expect(prompt).toContain("\"rooms\"");
  });
});

describe("validateBridgeResponse", () => {
  it("accepts a valid MapPlan JSON response", () => {
    const result = validateBridgeResponse(
      JSON.stringify({
        id: "plan-library",
        name: "Library Plan",
        requestId: "manual-chatgpt-bridge",
        rooms: [
          {
            bounds: { height: 6, width: 8, x: 2, y: 3 },
            id: "room-library",
            kind: "room",
            label: "Library",
            tags: ["library"]
          }
        ]
      })
    );

    expect(result.ok).toBe(true);
  });

  it("returns clear errors for invalid JSON", () => {
    const result = validateBridgeResponse("{ bad json");

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual(expect.arrayContaining([expect.stringContaining("JSON")]));
  });

  it("returns clear Zod path errors for invalid plans", () => {
    const result = validateBridgeResponse(JSON.stringify({ id: "", name: "Broken", requestId: "request" }));

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.some((error) => error.includes("id"))).toBe(true);
  });
});

describe("buildRepairPrompt", () => {
  it("includes validation errors and invalid response", () => {
    const prompt = buildRepairPrompt({
      errors: ["id: Too small"],
      originalPrompt: "Original prompt",
      pastedResponse: "{\"id\":\"\"}"
    });

    expect(prompt).toContain("id: Too small");
    expect(prompt).toContain("INVALID RESPONSE");
    expect(prompt).toContain("{\"id\":\"\"}");
  });
});
