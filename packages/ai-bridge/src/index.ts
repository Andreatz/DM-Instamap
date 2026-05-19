import { MapPlanSchema } from "@dm-instamap/core";
import type { MapPlan } from "@dm-instamap/core";
import type { ZodError } from "zod";

export type BridgeStatus = {
  enabled: false;
  mode: "manual-only";
};

export type BridgeAssetGroupSummary = {
  assetCount: number;
  id: string;
  kind: string;
  name: string;
  qualityScore?: number | null;
  tags: string[];
  theme?: string | null;
  usableFor?: string[];
};

export type BridgeReferenceSummary = {
  height?: number | null;
  id: string;
  mapType: string;
  mapTypeConfidence?: number;
  path: string;
  tags: string[];
  width?: number | null;
};

export type BridgeContext = {
  assetGroups: BridgeAssetGroupSummary[];
  references: BridgeReferenceSummary[];
};

export type BridgePromptInput = {
  assetGroups: BridgeAssetGroupSummary[];
  maxAssetGroups?: number;
  maxReferences?: number;
  references: BridgeReferenceSummary[];
  userRequest: string;
};

export type BridgeValidationResult =
  | {
      data: MapPlan;
      ok: true;
    }
  | {
      errors: string[];
      ok: false;
    };

const DEFAULT_ASSET_LIMIT = 12;
const DEFAULT_REFERENCE_LIMIT = 5;

export function getBridgeStatus(): BridgeStatus {
  return {
    enabled: false,
    mode: "manual-only"
  };
}

export function searchBridgeContext(input: BridgePromptInput): BridgeContext {
  const tokens = tokenize(input.userRequest);
  const assetGroups = rankByTokens(input.assetGroups, tokens, summarizeAssetGroupForSearch)
    .slice(0, input.maxAssetGroups ?? DEFAULT_ASSET_LIMIT)
    .map((ranked) => ranked.item);
  const references = rankByTokens(input.references, tokens, summarizeReferenceForSearch)
    .slice(0, input.maxReferences ?? DEFAULT_REFERENCE_LIMIT)
    .map((ranked) => ranked.item);

  return {
    assetGroups,
    references
  };
}

export function buildChatGptBridgePrompt(input: BridgePromptInput): string {
  const context = searchBridgeContext(input);

  return [
    "You are helping design an editable D&D battle map for DM-Instamap.",
    "Do not invent unavailable local assets. Prefer assetGroupIds from the available asset groups.",
    "Return JSON only. Do not include Markdown fences or commentary.",
    "",
    "USER REQUEST:",
    input.userRequest.trim() || "(empty request)",
    "",
    "AVAILABLE ASSET GROUPS:",
    formatAssetGroups(context.assetGroups),
    "",
    "SELECTED REFERENCE SUMMARIES:",
    formatReferences(context.references),
    "",
    "REQUIRED JSON SCHEMA:",
    REQUIRED_MAP_PLAN_SCHEMA,
    "",
    "Return one JSON object matching the schema. Keep rooms rectangular and editable."
  ].join("\n");
}

export function validateBridgeResponse(value: string): BridgeValidationResult {
  try {
    const parsed = JSON.parse(stripCodeFence(value));
    const result = MapPlanSchema.safeParse(parsed);

    if (result.success) {
      return {
        data: result.data,
        ok: true
      };
    }

    return {
      errors: formatZodErrors(result.error),
      ok: false
    };
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : "Response is not valid JSON."],
      ok: false
    };
  }
}

export function buildRepairPrompt(input: {
  errors: string[];
  originalPrompt: string;
  pastedResponse: string;
}): string {
  return [
    "Repair this DM-Instamap JSON response.",
    "Return JSON only. Do not include Markdown fences or explanation.",
    "",
    "VALIDATION ERRORS:",
    input.errors.length > 0 ? input.errors.map((error) => `- ${error}`).join("\n") : "- Unknown validation error",
    "",
    "REQUIRED JSON SCHEMA:",
    REQUIRED_MAP_PLAN_SCHEMA,
    "",
    "ORIGINAL PROMPT:",
    input.originalPrompt,
    "",
    "INVALID RESPONSE:",
    input.pastedResponse.trim() || "(empty response)"
  ].join("\n");
}

export const REQUIRED_MAP_PLAN_SCHEMA = JSON.stringify(
  {
    assetPlacements: [
      {
        assetId: "asset or asset group representative id",
        id: "placed-unique-id",
        layer: "floor | wall | object | lighting | annotation",
        locked: false,
        position: { x: 0, y: 0 },
        rotation: 0,
        scale: 1,
        tags: ["editable"]
      }
    ],
    doors: [
      {
        id: "door-unique-id",
        isLocked: false,
        isOpen: false,
        position: { x: 0, y: 0 },
        rotation: 0,
        roomIds: ["room-a", "room-b"],
        width: 1
      }
    ],
    id: "plan-unique-id",
    lights: [
      {
        color: "#ffcc88",
        id: "light-unique-id",
        intensity: 0.8,
        kind: "torch | lantern | magic | daylight | ambient",
        position: { x: 0, y: 0 },
        radius: 6
      }
    ],
    name: "Plan name",
    notes: ["brief implementation notes"],
    requestId: "manual-chatgpt-bridge",
    rooms: [
      {
        bounds: { height: 6, width: 8, x: 2, y: 3 },
        connections: ["room-b"],
        id: "room-unique-id",
        kind: "entrance | room | corridor | stairs | secret | service",
        label: "Room label",
        tags: ["crypt", "library"]
      }
    ],
    walls: [
      {
        blocksMovement: true,
        end: { x: 10, y: 0 },
        id: "wall-unique-id",
        material: "stone",
        roomIds: ["room-a"],
        start: { x: 0, y: 0 },
        thickness: 1
      }
    ]
  },
  null,
  2
);

function rankByTokens<T>(
  items: T[],
  tokens: string[],
  summarize: (item: T) => string
): Array<{ item: T; score: number }> {
  return items
    .map((item) => {
      const text = summarize(item);
      const score = tokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);
      return {
        item,
        score: score + (tokens.length === 0 ? 1 : 0)
      };
    })
    .filter((ranked) => ranked.score > 0)
    .sort((left, right) => right.score - left.score || getItemName(left.item).localeCompare(getItemName(right.item)));
}

function formatAssetGroups(groups: BridgeAssetGroupSummary[]): string {
  if (groups.length === 0) {
    return "[]";
  }

  return JSON.stringify(
    groups.map((group) => ({
      assetCount: group.assetCount,
      id: group.id,
      kind: group.kind,
      name: group.name,
      qualityScore: group.qualityScore ?? null,
      tags: group.tags.slice(0, 8),
      theme: group.theme ?? null,
      usableFor: (group.usableFor ?? []).slice(0, 6)
    })),
    null,
    2
  );
}

function formatReferences(references: BridgeReferenceSummary[]): string {
  if (references.length === 0) {
    return "[]";
  }

  return JSON.stringify(
    references.map((reference) => ({
      id: reference.id,
      mapType: reference.mapType,
      path: reference.path,
      size: reference.width && reference.height ? `${reference.width}x${reference.height}` : "unknown",
      tags: reference.tags.slice(0, 10)
    })),
    null,
    2
  );
}

function summarizeAssetGroupForSearch(group: BridgeAssetGroupSummary): string {
  return tokenize([
    group.id,
    group.kind,
    group.name,
    group.theme ?? "",
    ...group.tags,
    ...(group.usableFor ?? [])
  ].join(" ")).join(" ");
}

function summarizeReferenceForSearch(reference: BridgeReferenceSummary): string {
  return tokenize([reference.id, reference.mapType, reference.path, ...reference.tags].join(" ")).join(" ");
}

function formatZodErrors(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  return match?.[1] ?? trimmed;
}

function tokenize(value: string): string[] {
  return [
    ...new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .map((token) => token.trim())
        .filter(Boolean)
    )
  ];
}

function getItemName(item: unknown): string {
  if (item && typeof item === "object" && "name" in item && typeof item.name === "string") {
    return item.name;
  }

  if (item && typeof item === "object" && "path" in item && typeof item.path === "string") {
    return item.path;
  }

  return "";
}
