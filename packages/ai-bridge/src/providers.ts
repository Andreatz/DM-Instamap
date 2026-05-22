export type AiChatMessage = {
  content: string;
  role: "system" | "user" | "assistant";
};

export type AiCompletionRequest = {
  maxTokens?: number;
  messages: AiChatMessage[];
  temperature?: number;
};

export type AiCompletionResult = {
  finishReason?: string;
  raw?: unknown;
  text: string;
};

export type AiCompletionProvider = {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
  id: string;
  model: string;
  vendor: "anthropic" | "openai" | "custom" | "mock";
};

export type AnthropicProviderConfig = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxTokens?: number;
  model?: string;
};

export type OpenAiProviderConfig = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxTokens?: number;
  model?: string;
};

export type CustomProviderConfig = {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
  id?: string;
  model?: string;
};

export type MockProviderConfig = {
  id?: string;
  model?: string;
  responses?: string[];
};

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_TOKENS = 4096;

export function createAnthropicProvider(config: AnthropicProviderConfig): AiCompletionProvider {
  if (!config.apiKey) {
    throw new Error("createAnthropicProvider: apiKey is required.");
  }

  const baseUrl = (config.baseUrl ?? "https://api.anthropic.com").replace(/\/$/u, "");
  const model = config.model ?? DEFAULT_ANTHROPIC_MODEL;
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error("createAnthropicProvider: fetch is not available in this runtime.");
  }

  return {
    id: `anthropic:${model}`,
    model,
    vendor: "anthropic",
    async complete(request) {
      const system = request.messages.find((message) => message.role === "system")?.content;
      const turns = request.messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          content: message.content,
          role: message.role === "assistant" ? "assistant" : "user"
        }));
      const response = await fetchImpl(`${baseUrl}/v1/messages`, {
        body: JSON.stringify({
          max_tokens: request.maxTokens ?? config.maxTokens ?? DEFAULT_MAX_TOKENS,
          messages: turns,
          model,
          system,
          temperature: request.temperature
        }),
        headers: {
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "x-api-key": config.apiKey
        },
        method: "POST"
      });

      if (!response.ok) {
        const errorText = await safeReadText(response);
        throw new Error(`Anthropic request failed (${response.status}): ${errorText}`);
      }

      const payload = (await response.json()) as {
        content?: Array<{ text?: string; type?: string }>;
        stop_reason?: string;
      };
      const text = (payload.content ?? [])
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text ?? "")
        .join("");

      return {
        finishReason: payload.stop_reason,
        raw: payload,
        text
      };
    }
  };
}

export function createOpenAiProvider(config: OpenAiProviderConfig): AiCompletionProvider {
  if (!config.apiKey) {
    throw new Error("createOpenAiProvider: apiKey is required.");
  }

  const baseUrl = (config.baseUrl ?? "https://api.openai.com").replace(/\/$/u, "");
  const model = config.model ?? DEFAULT_OPENAI_MODEL;
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error("createOpenAiProvider: fetch is not available in this runtime.");
  }

  return {
    id: `openai:${model}`,
    model,
    vendor: "openai",
    async complete(request) {
      const response = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
        body: JSON.stringify({
          max_tokens: request.maxTokens ?? config.maxTokens ?? DEFAULT_MAX_TOKENS,
          messages: request.messages.map((message) => ({
            content: message.content,
            role: message.role
          })),
          model,
          temperature: request.temperature
        }),
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        const errorText = await safeReadText(response);
        throw new Error(`OpenAI request failed (${response.status}): ${errorText}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{
          finish_reason?: string;
          message?: {
            content?: string;
          };
        }>;
      };
      const choice = payload.choices?.[0];

      return {
        finishReason: choice?.finish_reason,
        raw: payload,
        text: choice?.message?.content ?? ""
      };
    }
  };
}

export function createCustomProvider(config: CustomProviderConfig): AiCompletionProvider {
  return {
    id: config.id ?? "custom",
    model: config.model ?? "custom",
    vendor: "custom",
    complete: config.complete
  };
}

export function createMockProvider(config: MockProviderConfig = {}): AiCompletionProvider {
  const responses = config.responses && config.responses.length > 0 ? config.responses : [DEFAULT_MOCK_PLAN_RESPONSE];
  let index = 0;

  return {
    id: config.id ?? "mock:offline",
    model: config.model ?? "offline-mock",
    vendor: "mock",
    async complete() {
      const text = responses[Math.min(index, responses.length - 1)] ?? DEFAULT_MOCK_PLAN_RESPONSE;
      index += 1;
      return {
        finishReason: "stop",
        raw: { mock: true },
        text
      };
    }
  };
}

export type ResolvedAiConfig = {
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  model?: string;
  provider: "anthropic" | "openai" | "mock";
};

export function resolveAiConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ResolvedAiConfig | null {
  const provider = (env.AI_PROVIDER ?? "").trim().toLowerCase();

  if (provider === "mock") {
    return {
      model: (env.AI_MODEL ?? "").trim() || "offline-mock",
      provider: "mock"
    };
  }

  if (provider !== "anthropic" && provider !== "openai") {
    return null;
  }

  const apiKey = (env.AI_API_KEY ?? "").trim();

  if (!apiKey) {
    return null;
  }

  const model = (env.AI_MODEL ?? "").trim() || undefined;
  const baseUrl = (env.AI_BASE_URL ?? "").trim() || undefined;
  const maxTokensRaw = (env.AI_MAX_TOKENS ?? "").trim();
  const maxTokens = maxTokensRaw ? Number.parseInt(maxTokensRaw, 10) : undefined;

  return {
    apiKey,
    baseUrl,
    maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
    model,
    provider
  };
}

export function createProviderFromEnv(env: NodeJS.ProcessEnv = process.env): AiCompletionProvider | null {
  const resolved = resolveAiConfigFromEnv(env);

  if (!resolved) {
    return null;
  }

  if (resolved.provider === "anthropic") {
    return createAnthropicProvider({
      apiKey: resolved.apiKey ?? "",
      baseUrl: resolved.baseUrl,
      maxTokens: resolved.maxTokens,
      model: resolved.model
    });
  }

  if (resolved.provider === "mock") {
    return createMockProvider({ model: resolved.model });
  }

  return createOpenAiProvider({
    apiKey: resolved.apiKey ?? "",
    baseUrl: resolved.baseUrl,
    maxTokens: resolved.maxTokens,
    model: resolved.model
  });
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "(unable to read response body)";
  }
}

const DEFAULT_MOCK_PLAN_RESPONSE = JSON.stringify({
  id: "plan-mock",
  name: "Mock Offline Plan",
  notes: ["Generated by the local mock provider."],
  requestId: "mock-provider",
  rooms: [
    {
      bounds: { height: 6, width: 8, x: 2, y: 2 },
      connections: [],
      id: "room-mock",
      kind: "room",
      label: "Mock Room",
      tags: ["mock"]
    }
  ]
});
