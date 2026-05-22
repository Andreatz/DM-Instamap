import { MapPlanSchema } from "@dm-instamap/core";
import type { MapPlan } from "@dm-instamap/core";
import { z } from "zod";
import {
  buildChatGptBridgePrompt,
  buildRepairPrompt,
  validateBridgeResponse,
  type BridgePromptInput
} from "./index";
import type { AiChatMessage, AiCompletionProvider } from "./providers";

export type AiOrchestrationOptions = {
  maxRetries?: number;
  maxTokens?: number;
  temperature?: number;
};

export type AiMapPlanResult =
  | {
      attempts: number;
      ok: true;
      plan: MapPlan;
      providerId: string;
      rawResponses: string[];
    }
  | {
      attempts: number;
      errors: string[];
      ok: false;
      providerId: string;
      rawResponses: string[];
    };

export async function generateMapPlanWithAi(
  input: BridgePromptInput,
  provider: AiCompletionProvider,
  options: AiOrchestrationOptions = {}
): Promise<AiMapPlanResult> {
  const maxRetries = Math.max(0, Math.min(5, options.maxRetries ?? 1));
  const basePrompt = buildChatGptBridgePrompt(input);
  const rawResponses: string[] = [];
  let lastErrors: string[] = [];
  let lastPrompt = basePrompt;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const messages: AiChatMessage[] = buildOrchestrationMessages(lastPrompt);
    const response = await provider.complete({
      maxTokens: options.maxTokens,
      messages,
      temperature: options.temperature ?? 0.2
    });
    rawResponses.push(response.text);
    const validation = validateBridgeResponse(response.text);

    if (validation.ok) {
      return {
        attempts: attempt + 1,
        ok: true,
        plan: validation.data,
        providerId: provider.id,
        rawResponses
      };
    }

    lastErrors = validation.errors;

    if (attempt === maxRetries) {
      break;
    }

    lastPrompt = buildRepairPrompt({
      errors: validation.errors,
      originalPrompt: basePrompt,
      pastedResponse: response.text
    });
  }

  return {
    attempts: rawResponses.length,
    errors: lastErrors,
    ok: false,
    providerId: provider.id,
    rawResponses
  };
}

export const AiBlueprintRoomSchema = z
  .object({
    label: z.string().trim().min(1),
    purpose: z.string().trim().min(1),
    suggestedAssets: z.array(z.string().trim().min(1)).default([]),
    suggestedLights: z.array(z.string().trim().min(1)).default([]),
    suggestedNotes: z.array(z.string().trim().min(1)).default([]),
    tacticalRole: z.enum([
      "entrance",
      "social",
      "combat",
      "puzzle",
      "treasure",
      "hazard",
      "boss",
      "transition",
      "secret",
      "safe"
    ]),
    tags: z.array(z.string().trim().min(1)).default([])
  })
  .strict();

export const AiBlueprintSchema = z
  .object({
    globalTags: z.array(z.string().trim().min(1)).default([]),
    gmNotes: z.array(z.string().trim().min(1)).default([]),
    mood: z
      .enum(["safe", "tense", "hostile", "ominous", "festive"])
      .default("tense"),
    name: z.string().trim().min(1),
    rooms: z.array(AiBlueprintRoomSchema).min(1),
    scale: z.enum(["small", "medium", "large"]).default("medium"),
    structure: z
      .enum([
        "dungeon",
        "building",
        "cave",
        "city",
        "village",
        "outdoor",
        "ship"
      ])
      .default("dungeon"),
    theme: z.string().trim().min(1)
  })
  .strict();

export type AiNarrativeBlueprint = z.infer<typeof AiBlueprintSchema>;

export type AiBlueprintResult =
  | {
      attempts: number;
      blueprint: AiNarrativeBlueprint;
      ok: true;
      providerId: string;
      rawResponses: string[];
    }
  | {
      attempts: number;
      errors: string[];
      ok: false;
      providerId: string;
      rawResponses: string[];
    };

export async function generateNarrativeBlueprintWithAi(
  request: string,
  provider: AiCompletionProvider,
  options: AiOrchestrationOptions = {}
): Promise<AiBlueprintResult> {
  const maxRetries = Math.max(0, Math.min(5, options.maxRetries ?? 1));
  const prompt = buildBlueprintPrompt(request);
  const rawResponses: string[] = [];
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await provider.complete({
      maxTokens: options.maxTokens,
      messages: buildOrchestrationMessages(
        prompt,
        attempt > 0 ? lastErrors : []
      ),
      temperature: options.temperature ?? 0.3
    });
    rawResponses.push(response.text);
    const validation = parseAndValidate(response.text, AiBlueprintSchema);

    if (validation.ok) {
      return {
        attempts: attempt + 1,
        blueprint: validation.data,
        ok: true,
        providerId: provider.id,
        rawResponses
      };
    }

    lastErrors = validation.errors;
  }

  return {
    attempts: rawResponses.length,
    errors: lastErrors,
    ok: false,
    providerId: provider.id,
    rawResponses
  };
}

export type AssetSuggestionInput = {
  availableAssetIds: string[];
  roomLabel: string;
  roomPurpose?: string;
  styleTags?: string[];
};

const AssetSuggestionSchema = z
  .object({
    suggestions: z
      .array(
        z
          .object({
            assetId: z.string().trim().min(1),
            reason: z.string().trim().min(1)
          })
          .strict()
      )
      .min(1)
  })
  .strict();

export type AiAssetSuggestion = {
  assetId: string;
  reason: string;
};

export type AssetSuggestionResult =
  | {
      attempts: number;
      ok: true;
      providerId: string;
      rawResponses: string[];
      suggestions: AiAssetSuggestion[];
    }
  | {
      attempts: number;
      errors: string[];
      ok: false;
      providerId: string;
      rawResponses: string[];
    };

export async function suggestAssetsForRoomWithAi(
  input: AssetSuggestionInput,
  provider: AiCompletionProvider,
  options: AiOrchestrationOptions = {}
): Promise<AssetSuggestionResult> {
  if (input.availableAssetIds.length === 0) {
    return {
      attempts: 0,
      errors: ["No local assets available to suggest from."],
      ok: false,
      providerId: provider.id,
      rawResponses: []
    };
  }

  const maxRetries = Math.max(0, Math.min(3, options.maxRetries ?? 1));
  const prompt = buildAssetSuggestionPrompt(input);
  const rawResponses: string[] = [];
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await provider.complete({
      maxTokens: options.maxTokens ?? 1024,
      messages: buildOrchestrationMessages(
        prompt,
        attempt > 0 ? lastErrors : []
      ),
      temperature: options.temperature ?? 0.2
    });
    rawResponses.push(response.text);
    const validation = parseAndValidate(response.text, AssetSuggestionSchema);

    if (validation.ok) {
      const available = new Set(input.availableAssetIds);
      const suggestions = validation.data.suggestions.filter((suggestion) =>
        available.has(suggestion.assetId)
      );

      if (suggestions.length === 0) {
        lastErrors = [
          "AI returned no suggestions matching the available asset library."
        ];
        continue;
      }

      return {
        attempts: attempt + 1,
        ok: true,
        providerId: provider.id,
        rawResponses,
        suggestions
      };
    }

    lastErrors = validation.errors;
  }

  return {
    attempts: rawResponses.length,
    errors: lastErrors,
    ok: false,
    providerId: provider.id,
    rawResponses
  };
}

export type MapDescriptionInput = {
  mapName: string;
  rooms: Array<{
    id: string;
    label: string;
    tags?: string[];
  }>;
  styleTags?: string[];
  theme?: string;
};

export type MapDescriptionResult =
  | {
      description: string;
      ok: true;
      providerId: string;
    }
  | {
      errors: string[];
      ok: false;
      providerId: string;
    };

export async function describeMapWithAi(
  input: MapDescriptionInput,
  provider: AiCompletionProvider,
  options: AiOrchestrationOptions = {}
): Promise<MapDescriptionResult> {
  const prompt = buildMapDescriptionPrompt(input);
  const response = await provider.complete({
    maxTokens: options.maxTokens ?? 1024,
    messages: buildOrchestrationMessages(prompt),
    temperature: options.temperature ?? 0.5
  });
  const text = response.text.trim();

  if (text.length === 0) {
    return {
      errors: ["AI returned an empty description."],
      ok: false,
      providerId: provider.id
    };
  }

  return {
    description: text,
    ok: true,
    providerId: provider.id
  };
}

function buildOrchestrationMessages(
  prompt: string,
  repairHints: string[] = []
): AiChatMessage[] {
  const system = [
    "You are DM-Instamap's AI bridge: a server-side assistant that drafts strict JSON for D&D battle map planning.",
    "Always return only JSON unless the user prompt explicitly asks for prose.",
    "Do not invent assets, rooms, or fields beyond the requested schema."
  ].join(" ");
  const userParts = [prompt];

  if (repairHints.length > 0) {
    userParts.push(
      "",
      "Previous validation errors:",
      ...repairHints.map((hint) => `- ${hint}`)
    );
  }

  return [
    { content: system, role: "system" },
    { content: userParts.join("\n"), role: "user" }
  ];
}

function buildBlueprintPrompt(request: string): string {
  return [
    "Generate a narrative blueprint JSON for a D&D map.",
    "Return JSON only. Do not include Markdown fences or commentary.",
    "",
    "USER REQUEST:",
    request.trim() || "(empty request)",
    "",
    "REQUIRED SCHEMA:",
    JSON.stringify(BLUEPRINT_SCHEMA_HINT, null, 2),
    "",
    "Use 3-7 rooms. Each room must have a tacticalRole, label, purpose, and suggested assets/lights/notes."
  ].join("\n");
}

const BLUEPRINT_SCHEMA_HINT = {
  globalTags: ["one or more thematic tags"],
  gmNotes: ["optional GM-facing notes"],
  mood: "safe | tense | hostile | ominous | festive",
  name: "Map name",
  rooms: [
    {
      label: "Room label",
      purpose: "One sentence describing what the room is for.",
      suggestedAssets: ["altar", "candle"],
      suggestedLights: ["torch"],
      suggestedNotes: ["GM hint"],
      tacticalRole:
        "entrance | social | combat | puzzle | treasure | hazard | boss | transition | secret | safe",
      tags: ["thematic tag"]
    }
  ],
  scale: "small | medium | large",
  structure: "dungeon | building | cave | city | village | outdoor | ship",
  theme: "theme keyword"
};

function buildAssetSuggestionPrompt(input: AssetSuggestionInput): string {
  return [
    "Pick assets that fit a room's purpose, using only the assetIds provided below.",
    'Return JSON only with shape: { "suggestions": [{ "assetId": string, "reason": string }] }.',
    "Do not invent assetIds that are not in the available list.",
    "",
    "ROOM:",
    `- label: ${input.roomLabel}`,
    input.roomPurpose ? `- purpose: ${input.roomPurpose}` : "",
    input.styleTags && input.styleTags.length > 0
      ? `- style tags: ${input.styleTags.join(", ")}`
      : "",
    "",
    "AVAILABLE ASSET IDS:",
    JSON.stringify(input.availableAssetIds.slice(0, 200), null, 2)
  ]
    .filter(Boolean)
    .join("\n");
}

function buildMapDescriptionPrompt(input: MapDescriptionInput): string {
  return [
    "Write a short DM-facing narrative description (3-5 paragraphs) for the following map.",
    "Prose only. No JSON, no Markdown headings. Focus on tone, sensory detail, and prep utility.",
    "",
    `MAP NAME: ${input.mapName}`,
    input.theme ? `THEME: ${input.theme}` : "",
    input.styleTags && input.styleTags.length > 0
      ? `STYLE TAGS: ${input.styleTags.join(", ")}`
      : "",
    "",
    "ROOMS:",
    JSON.stringify(
      input.rooms.map((room) => ({
        id: room.id,
        label: room.label,
        tags: room.tags ?? []
      })),
      null,
      2
    )
  ]
    .filter(Boolean)
    .join("\n");
}

type ParseAndValidate<T> =
  | { data: T; ok: true }
  | { errors: string[]; ok: false };

function parseAndValidate<T>(
  value: string,
  schema: z.ZodType<T>
): ParseAndValidate<T> {
  try {
    const parsed = JSON.parse(stripCodeFence(value));
    const result = schema.safeParse(parsed);

    if (result.success) {
      return { data: result.data, ok: true };
    }

    return {
      errors: result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
        return `${path}: ${issue.message}`;
      }),
      ok: false
    };
  } catch (error) {
    return {
      errors: [
        error instanceof Error ? error.message : "Response is not valid JSON."
      ],
      ok: false
    };
  }
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  return match?.[1] ?? trimmed;
}

export { MapPlanSchema };
