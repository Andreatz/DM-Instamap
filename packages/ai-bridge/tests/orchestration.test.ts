import { describe, expect, it } from "vitest";
import {
  createAnthropicProvider,
  createCustomProvider,
  createOpenAiProvider,
  createProviderFromEnv,
  describeMapWithAi,
  generateMapPlanWithAi,
  generateNarrativeBlueprintWithAi,
  resolveAiConfigFromEnv,
  suggestAssetsForRoomWithAi,
  type AiCompletionProvider,
  type AiCompletionResult
} from "../src";

function createScriptedProvider(
  responses: AiCompletionResult[]
): AiCompletionProvider {
  let index = 0;
  return createCustomProvider({
    id: "scripted",
    model: "scripted",
    async complete() {
      const response = responses[index] ?? responses[responses.length - 1];
      index += 1;

      if (!response) {
        throw new Error("Scripted provider exhausted with no responses.");
      }

      return response;
    }
  });
}

const validPlanJson = JSON.stringify({
  assetPlacements: [],
  doors: [],
  id: "plan-test",
  lights: [],
  name: "Test Plan",
  notes: ["AI-generated"],
  requestId: "request-test",
  rooms: [
    {
      bounds: { height: 4, width: 4, x: 1, y: 1 },
      connections: [],
      id: "room-1",
      kind: "room",
      label: "Sample Room",
      tags: ["test"]
    }
  ],
  walls: []
});

describe("resolveAiConfigFromEnv", () => {
  it("returns null when env is incomplete", () => {
    expect(resolveAiConfigFromEnv({})).toBeNull();
    expect(resolveAiConfigFromEnv({ AI_PROVIDER: "anthropic" })).toBeNull();
    expect(resolveAiConfigFromEnv({ AI_API_KEY: "key" })).toBeNull();
  });

  it("parses anthropic config from env", () => {
    const config = resolveAiConfigFromEnv({
      AI_API_KEY: "secret",
      AI_MAX_TOKENS: "1024",
      AI_MODEL: "claude-opus-4-7",
      AI_PROVIDER: "anthropic"
    });

    expect(config).toEqual({
      apiKey: "secret",
      baseUrl: undefined,
      maxTokens: 1024,
      model: "claude-opus-4-7",
      provider: "anthropic"
    });
  });

  it("creates a working provider from env", () => {
    const provider = createProviderFromEnv({
      AI_API_KEY: "secret",
      AI_PROVIDER: "openai"
    });

    expect(provider?.vendor).toBe("openai");
  });
});

describe("createAnthropicProvider", () => {
  it("posts the request to the messages endpoint and extracts text", async () => {
    let capturedBody: unknown = null;
    let capturedHeaders: Record<string, string> = {};
    const fetchImpl: typeof fetch = async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body ?? "{}"));
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;

      return new Response(
        JSON.stringify({
          content: [{ text: "hello", type: "text" }],
          stop_reason: "end_turn"
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      );
    };
    const provider = createAnthropicProvider({
      apiKey: "secret-token",
      fetchImpl,
      model: "claude-opus-4-7"
    });
    const result = await provider.complete({
      messages: [
        { content: "system rules", role: "system" },
        { content: "hi", role: "user" }
      ]
    });

    expect(result.text).toBe("hello");
    expect(result.finishReason).toBe("end_turn");
    expect(capturedHeaders["x-api-key"]).toBe("secret-token");
    expect((capturedBody as { system?: string }).system).toBe("system rules");
    expect((capturedBody as { model: string }).model).toBe("claude-opus-4-7");
  });

  it("throws when the API responds with an error", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("rate limited", { status: 429 });
    const provider = createAnthropicProvider({ apiKey: "x", fetchImpl });

    await expect(
      provider.complete({ messages: [{ content: "hi", role: "user" }] })
    ).rejects.toThrow(/Anthropic request failed \(429\)/u);
  });
});

describe("createOpenAiProvider", () => {
  it("posts to chat/completions and extracts the first choice", async () => {
    let capturedBody: unknown = null;
    const fetchImpl: typeof fetch = async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body ?? "{}"));
      return new Response(
        JSON.stringify({
          choices: [{ finish_reason: "stop", message: { content: "ok" } }]
        }),
        { status: 200 }
      );
    };
    const provider = createOpenAiProvider({
      apiKey: "sk",
      fetchImpl,
      model: "gpt-4o-mini"
    });
    const result = await provider.complete({
      messages: [{ content: "hi", role: "user" }]
    });

    expect(result.text).toBe("ok");
    expect((capturedBody as { model: string }).model).toBe("gpt-4o-mini");
  });
});

describe("generateMapPlanWithAi", () => {
  it("returns a validated MapPlan when the first attempt is valid", async () => {
    const provider = createScriptedProvider([{ text: validPlanJson }]);
    const result = await generateMapPlanWithAi(
      {
        assetGroups: [],
        references: [],
        userRequest: "A simple test room"
      },
      provider
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.rooms).toHaveLength(1);
      expect(result.attempts).toBe(1);
    }
  });

  it("retries with a repair prompt when the first attempt is invalid", async () => {
    const provider = createScriptedProvider([
      { text: "not json" },
      { text: validPlanJson }
    ]);
    const result = await generateMapPlanWithAi(
      {
        assetGroups: [],
        references: [],
        userRequest: "Retry test"
      },
      provider,
      { maxRetries: 2 }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attempts).toBe(2);
      expect(result.rawResponses).toHaveLength(2);
    }
  });

  it("reports errors when all attempts fail", async () => {
    const provider = createScriptedProvider([
      { text: "still not json" },
      { text: "{}" }
    ]);
    const result = await generateMapPlanWithAi(
      { assetGroups: [], references: [], userRequest: "fail" },
      provider,
      { maxRetries: 1 }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.attempts).toBe(2);
    }
  });
});

describe("generateNarrativeBlueprintWithAi", () => {
  it("parses a valid blueprint response", async () => {
    const blueprint = {
      globalTags: ["crypt"],
      gmNotes: ["watch the seal"],
      mood: "ominous",
      name: "Sealed Crypt",
      rooms: [
        {
          label: "Entry",
          purpose: "Threshold from the cathedral above.",
          suggestedAssets: ["stairs"],
          suggestedLights: ["torch"],
          suggestedNotes: ["light is dim"],
          tacticalRole: "entrance",
          tags: ["entrance"]
        },
        {
          label: "Ritual",
          purpose: "Final binding chamber.",
          suggestedAssets: ["altar"],
          suggestedLights: ["candle"],
          suggestedNotes: [],
          tacticalRole: "boss",
          tags: ["ritual"]
        }
      ],
      scale: "medium",
      structure: "dungeon",
      theme: "crypt"
    };
    const provider = createScriptedProvider([
      { text: JSON.stringify(blueprint) }
    ]);
    const result = await generateNarrativeBlueprintWithAi(
      "crypt below the cathedral",
      provider
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blueprint.rooms).toHaveLength(2);
      expect(result.blueprint.mood).toBe("ominous");
    }
  });

  it("reports validation errors when the response is malformed", async () => {
    const provider = createScriptedProvider([{ text: '{"invalid": true}' }]);
    const result = await generateNarrativeBlueprintWithAi(
      "malformed",
      provider,
      { maxRetries: 0 }
    );

    expect(result.ok).toBe(false);
  });
});

describe("suggestAssetsForRoomWithAi", () => {
  it("filters suggestions to the available asset library", async () => {
    const provider = createScriptedProvider([
      {
        text: JSON.stringify({
          suggestions: [
            { assetId: "asset-altar", reason: "matches chapel" },
            { assetId: "asset-hallucination", reason: "should be filtered" }
          ]
        })
      }
    ]);
    const result = await suggestAssetsForRoomWithAi(
      {
        availableAssetIds: ["asset-altar", "asset-candle"],
        roomLabel: "Chapel",
        roomPurpose: "Quiet sanctuary",
        styleTags: ["sacred"]
      },
      provider
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.suggestions).toEqual([
        { assetId: "asset-altar", reason: "matches chapel" }
      ]);
    }
  });

  it("returns ok:false when the library is empty", async () => {
    const provider = createScriptedProvider([{ text: "{}" }]);
    const result = await suggestAssetsForRoomWithAi(
      { availableAssetIds: [], roomLabel: "Empty" },
      provider
    );

    expect(result.ok).toBe(false);
  });
});

describe("describeMapWithAi", () => {
  it("returns the AI prose when non-empty", async () => {
    const provider = createScriptedProvider([
      { text: "  The crypt smells of cold incense.\n" }
    ]);
    const result = await describeMapWithAi(
      {
        mapName: "Sealed Crypt",
        rooms: [{ id: "room-1", label: "Entrance", tags: ["entrance"] }],
        styleTags: ["sacred"],
        theme: "crypt"
      },
      provider
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.description).toBe("The crypt smells of cold incense.");
    }
  });

  it("returns ok:false when the response is empty", async () => {
    const provider = createScriptedProvider([{ text: "   " }]);
    const result = await describeMapWithAi(
      { mapName: "Empty", rooms: [{ id: "r", label: "r" }] },
      provider
    );

    expect(result.ok).toBe(false);
  });
});
