import { describe, expect, it } from "vitest";
import {
  buildChatGptBridgePrompt,
  buildPromptPacket,
  buildRepairPrompt,
  createProviderFromEnv,
  getBridgeStatus,
  repairPlanLocally,
  searchBridgeContext,
  suggestAssetReplacements,
  validateBridgeResponse,
  validatePlanSemantics
} from "../src";
import { MapPlanSchema } from "@dm-instamap/core";

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
      promptSummary:
        "Warm-lit keep library battlemap with dense room-cluster layout.",
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
  it("reports manual-only mode when no AI env is configured", () => {
    const status = getBridgeStatus({});

    expect(status.enabled).toBe(false);
    expect(status.localOnly).toBe(true);
    expect(status.mode).toBe("manual-only");
  });

  it("reports api mode when AI_PROVIDER and AI_API_KEY are set", () => {
    const status = getBridgeStatus({
      AI_API_KEY: "sk-test-token",
      AI_MODEL: "claude-opus-4-7",
      AI_PROVIDER: "anthropic"
    });

    expect(status).toEqual({
      enabled: true,
      localOnly: false,
      mode: "api",
      model: "claude-opus-4-7",
      provider: "anthropic"
    });
  });

  it("reports local mock mode without requiring API keys", () => {
    const status = getBridgeStatus({
      AI_PROVIDER: "mock"
    });

    expect(status).toEqual({
      enabled: true,
      localOnly: true,
      mode: "mock",
      model: "offline-mock",
      provider: "mock"
    });
  });

  it("creates a mock provider from env for tests and demos", async () => {
    const provider = createProviderFromEnv({ AI_PROVIDER: "mock" });
    const response = await provider?.complete({
      messages: [{ content: "hello", role: "user" }]
    });

    expect(provider?.vendor).toBe("mock");
    expect(response?.text).toContain("plan-mock");
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
    expect(prompt).toContain('"rooms"');
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
    expect(result.ok ? [] : result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("JSON")])
    );
  });

  it("returns clear Zod path errors for invalid plans", () => {
    const result = validateBridgeResponse(
      JSON.stringify({ id: "", name: "Broken", requestId: "request" })
    );

    expect(result.ok).toBe(false);
    expect(
      result.ok ? [] : result.errors.some((error) => error.includes("id"))
    ).toBe(true);
  });
});

describe("buildRepairPrompt", () => {
  it("includes validation errors and invalid response", () => {
    const prompt = buildRepairPrompt({
      errors: ["id: Too small"],
      originalPrompt: "Original prompt",
      pastedResponse: '{"id":""}'
    });

    expect(prompt).toContain("id: Too small");
    expect(prompt).toContain("INVALID RESPONSE");
    expect(prompt).toContain('{"id":""}');
  });
});

describe("buildPromptPacket", () => {
  it("renders a markdown packet with user request, assets, references, and schema", () => {
    const packet = buildPromptPacket({
      assetGroups,
      assetSearchResults,
      references,
      userRequest: "Design a haunted keep library."
    });

    expect(packet).toContain("# DM-Instamap Prompt Packet");
    expect(packet).toContain("## User Request");
    expect(packet).toContain("Design a haunted keep library.");
    expect(packet).toContain("## Local Asset Groups");
    expect(packet).toContain("`group-library`");
    expect(packet).toContain("## Reference Style DNA");
    expect(packet).toContain("Warm-lit keep library battlemap");
    expect(packet).toContain("## Schema");
    expect(packet).toContain("```json");
  });

  it("supports an optional packet title", () => {
    const packet = buildPromptPacket({
      assetGroups: [],
      references: [],
      packetTitle: "Custom Title",
      userRequest: "anything"
    });

    expect(packet.startsWith("# Custom Title")).toBe(true);
  });
});

const samplePlan = MapPlanSchema.parse({
  assetPlacements: [
    {
      assetId: "group-library",
      id: "place-1",
      layer: "object",
      locked: false,
      position: { x: 4, y: 4 },
      rotation: 0,
      scale: 1,
      tags: []
    },
    {
      assetId: "missing_asset",
      id: "place-2",
      layer: "object",
      locked: false,
      position: { x: 6, y: 6 },
      rotation: 0,
      scale: 1,
      tags: []
    }
  ],
  doors: [
    {
      id: "door-1",
      isLocked: false,
      isOpen: false,
      position: { x: 5, y: 5 },
      rotation: 0,
      roomIds: ["room-library"],
      width: 1
    }
  ],
  id: "plan-test",
  lights: [],
  name: "Plan",
  notes: [],
  requestId: "test-request",
  rooms: [
    {
      bounds: { height: 6, width: 8, x: 2, y: 3 },
      connections: [],
      id: "room-library",
      kind: "room",
      label: "Library",
      tags: ["library"]
    }
  ],
  walls: []
});

describe("validatePlanSemantics", () => {
  it("flags missing assets, out-of-bounds elements, and unknown connections", () => {
    const result = validatePlanSemantics(
      {
        ...samplePlan,
        doors: [
          {
            id: "door-1",
            isLocked: false,
            isOpen: false,
            position: { x: 99, y: 99 },
            rotation: 0,
            roomIds: ["room-missing"],
            width: 1
          }
        ]
      },
      {
        assetGroups,
        mapHeight: 16,
        mapWidth: 16
      }
    );

    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.type === "door_out_of_bounds")
    ).toBe(true);
    expect(result.issues.some((issue) => issue.type === "missing_asset")).toBe(
      true
    );
    expect(
      result.issues.some((issue) => issue.type === "missing_room_reference")
    ).toBe(true);
    expect(
      result.missingAssets.find((report) => report.assetId === "missing_asset")
        ?.suggestions.length ?? 0
    ).toBeGreaterThan(0);
  });

  it("returns ok when there are no issues", () => {
    const result = validatePlanSemantics(samplePlan, {
      assetGroups,
      knownAssetIds: ["missing_asset", "group-library"],
      mapHeight: 16,
      mapWidth: 16
    });

    expect(result.ok).toBe(true);
  });
});

describe("suggestAssetReplacements", () => {
  it("returns a ranked list of replacements", () => {
    const suggestions = suggestAssetReplacements("library_book_shelf_missing", {
      assetGroups,
      limit: 2
    });

    expect(suggestions.length).toBe(2);
    expect(suggestions[0]?.suggestionId).toBeTruthy();
  });
});

describe("repairPlanLocally", () => {
  it("removes invalid elements and substitutes missing assets", () => {
    const broken = MapPlanSchema.parse({
      ...samplePlan,
      lights: [
        {
          color: "#ffffff",
          id: "light-bad",
          intensity: 0.5,
          kind: "ambient",
          position: { x: 4, y: 4 },
          radius: 1
        }
      ],
      walls: [
        {
          blocksMovement: true,
          end: { x: 1, y: 1 },
          id: "wall-zero",
          material: "stone",
          roomIds: [],
          start: { x: 1, y: 1 },
          thickness: 1
        }
      ]
    });
    const result = repairPlanLocally({
      context: {
        assetGroups,
        mapHeight: 16,
        mapWidth: 16
      },
      plan: broken
    });

    expect(result.removed.invalidWalls).toContain("wall-zero");
    expect(
      result.appliedSubstitutions.some(
        (substitution) => substitution.from === "missing_asset"
      )
    ).toBe(true);
    expect(
      result.remainingIssues.filter((issue) => issue.level === "error").length
    ).toBe(0);
  });
});
