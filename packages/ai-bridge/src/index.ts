import { MapPlanSchema } from "@dm-instamap/core";
import type { MapPlan, PlacedAsset, RoomNode } from "@dm-instamap/core";
import type { ZodError } from "zod";
import { resolveAiConfigFromEnv } from "./providers";

export type BridgeStatus =
  | {
      enabled: false;
      localOnly: true;
      mode: "manual-only";
      reason?: string;
    }
  | {
      enabled: true;
      localOnly: boolean;
      mode: "api" | "mock";
      provider: "anthropic" | "openai" | "mock";
      model?: string;
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
  styleDna?: {
    density: string;
    layoutTraits: string[];
    mood: string[];
    promptSummary: string;
    recommendedAssetTags: string[];
    visualTags: string[];
  } | null;
  tags: string[];
  width?: number | null;
};

export type BridgeAssetSearchSummary = {
  assetId: string;
  classification: string;
  reason: string;
  relativePath: string;
  score: number;
  tags: string[];
};

export type BridgeContext = {
  assetGroups: BridgeAssetGroupSummary[];
  assetSearchResults: BridgeAssetSearchSummary[];
  references: BridgeReferenceSummary[];
};

export type BridgePromptInput = {
  assetGroups: BridgeAssetGroupSummary[];
  assetSearchResults?: BridgeAssetSearchSummary[];
  maxAssetGroups?: number;
  maxReferences?: number;
  maxSearchResults?: number;
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

export function getBridgeStatus(
  env: NodeJS.ProcessEnv = process.env
): BridgeStatus {
  const config = resolveAiConfigFromEnv(env);

  if (!config) {
    return {
      enabled: false,
      localOnly: true,
      mode: "manual-only",
      reason: "AI_PROVIDER or AI_API_KEY is not set."
    };
  }

  return {
    enabled: true,
    localOnly: config.provider === "mock",
    mode: config.provider === "mock" ? "mock" : "api",
    model: config.model,
    provider: config.provider
  };
}

export {
  createAnthropicProvider,
  createCustomProvider,
  createMockProvider,
  createOpenAiProvider,
  createProviderFromEnv,
  resolveAiConfigFromEnv,
  type AiChatMessage,
  type AiCompletionProvider,
  type AiCompletionRequest,
  type AiCompletionResult,
  type AnthropicProviderConfig,
  type CustomProviderConfig,
  type MockProviderConfig,
  type OpenAiProviderConfig,
  type ResolvedAiConfig
} from "./providers";

export {
  AiBlueprintRoomSchema,
  AiBlueprintSchema,
  describeMapWithAi,
  generateMapPlanWithAi,
  generateNarrativeBlueprintWithAi,
  suggestAssetsForRoomWithAi,
  type AiAssetSuggestion,
  type AiBlueprintResult,
  type AiMapPlanResult,
  type AiNarrativeBlueprint,
  type AiOrchestrationOptions,
  type AssetSuggestionInput,
  type AssetSuggestionResult,
  type MapDescriptionInput,
  type MapDescriptionResult
} from "./orchestration";

export function searchBridgeContext(input: BridgePromptInput): BridgeContext {
  const tokens = tokenize(input.userRequest);
  const assetGroups = rankByTokens(
    input.assetGroups,
    tokens,
    summarizeAssetGroupForSearch
  )
    .slice(0, input.maxAssetGroups ?? DEFAULT_ASSET_LIMIT)
    .map((ranked) => ranked.item);
  const references = rankByTokens(
    input.references,
    tokens,
    summarizeReferenceForSearch
  )
    .slice(0, input.maxReferences ?? DEFAULT_REFERENCE_LIMIT)
    .map((ranked) => ranked.item);
  const assetSearchResults = (input.assetSearchResults ?? [])
    .slice()
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.relativePath.localeCompare(right.relativePath)
    )
    .slice(0, input.maxSearchResults ?? 8);

  return {
    assetGroups,
    assetSearchResults,
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
    "LOCAL ASSET SEARCH RESULTS:",
    formatAssetSearchResults(context.assetSearchResults),
    "",
    "SELECTED REFERENCE SUMMARIES:",
    formatReferences(context.references),
    "",
    "REFERENCE STYLE DNA:",
    formatReferenceStyleDna(context.references),
    "",
    "REQUIRED JSON SCHEMA:",
    REQUIRED_MAP_PLAN_SCHEMA,
    "",
    "Return one JSON object matching the schema. Keep rooms rectangular and editable."
  ].join("\n");
}

function formatAssetSearchResults(results: BridgeAssetSearchSummary[]): string {
  if (results.length === 0) {
    return "[]";
  }

  return JSON.stringify(
    results.map((result) => ({
      assetId: result.assetId,
      kind: result.classification,
      path: result.relativePath,
      reason: result.reason,
      score: result.score,
      tags: result.tags.slice(0, 8)
    })),
    null,
    2
  );
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
      errors: [
        error instanceof Error ? error.message : "Response is not valid JSON."
      ],
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
    input.errors.length > 0
      ? input.errors.map((error) => `- ${error}`).join("\n")
      : "- Unknown validation error",
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
      const score = tokens.reduce(
        (sum, token) => sum + (text.includes(token) ? 1 : 0),
        0
      );
      return {
        item,
        score: score + (tokens.length === 0 ? 1 : 0)
      };
    })
    .filter((ranked) => ranked.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        getItemName(left.item).localeCompare(getItemName(right.item))
    );
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
      size:
        reference.width && reference.height
          ? `${reference.width}x${reference.height}`
          : "unknown",
      tags: reference.tags.slice(0, 10)
    })),
    null,
    2
  );
}

function formatReferenceStyleDna(references: BridgeReferenceSummary[]): string {
  const styles = references
    .filter((reference) => reference.styleDna)
    .map((reference) => ({
      density: reference.styleDna?.density,
      layoutTraits: reference.styleDna?.layoutTraits.slice(0, 8),
      mood: reference.styleDna?.mood.slice(0, 8),
      promptSummary: reference.styleDna?.promptSummary,
      recommendedAssetTags: reference.styleDna?.recommendedAssetTags.slice(
        0,
        12
      ),
      referenceId: reference.id,
      visualTags: reference.styleDna?.visualTags.slice(0, 12)
    }));

  return styles.length > 0 ? JSON.stringify(styles, null, 2) : "[]";
}

function summarizeAssetGroupForSearch(group: BridgeAssetGroupSummary): string {
  return tokenize(
    [
      group.id,
      group.kind,
      group.name,
      group.theme ?? "",
      ...group.tags,
      ...(group.usableFor ?? [])
    ].join(" ")
  ).join(" ");
}

function summarizeReferenceForSearch(
  reference: BridgeReferenceSummary
): string {
  return tokenize(
    [
      reference.id,
      reference.mapType,
      reference.path,
      ...(reference.styleDna?.mood ?? []),
      ...(reference.styleDna?.layoutTraits ?? []),
      ...(reference.styleDna?.recommendedAssetTags ?? []),
      ...(reference.styleDna?.visualTags ?? []),
      reference.styleDna?.promptSummary ?? "",
      ...reference.tags
    ].join(" ")
  ).join(" ");
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
  if (
    item &&
    typeof item === "object" &&
    "name" in item &&
    typeof item.name === "string"
  ) {
    return item.name;
  }

  if (
    item &&
    typeof item === "object" &&
    "path" in item &&
    typeof item.path === "string"
  ) {
    return item.path;
  }

  return "";
}

export type PromptPacketInput = BridgePromptInput & {
  packetTitle?: string;
};

export function buildPromptPacket(input: PromptPacketInput): string {
  const context = searchBridgeContext(input);
  const title =
    (input.packetTitle ?? "DM-Instamap Prompt Packet").trim() ||
    "DM-Instamap Prompt Packet";
  const sections: string[] = [
    `# ${title}`,
    "",
    "## User Request",
    "",
    input.userRequest.trim() || "_(empty request)_",
    "",
    "## Local Asset Groups",
    "",
    formatAssetGroupsMarkdown(context.assetGroups),
    "",
    "## Local Asset Search Results",
    "",
    formatAssetSearchMarkdown(context.assetSearchResults),
    "",
    "## Reference Style DNA",
    "",
    formatReferenceStyleMarkdown(context.references),
    "",
    "## Required Output",
    "",
    "Return JSON only. Do not include Markdown fences or commentary.",
    "Do not invent unavailable local assets. Prefer assetGroupIds from the lists above.",
    "",
    "## Schema",
    "",
    "```json",
    REQUIRED_MAP_PLAN_SCHEMA,
    "```"
  ];

  return `${sections.join("\n")}\n`;
}

function formatAssetGroupsMarkdown(groups: BridgeAssetGroupSummary[]): string {
  if (groups.length === 0) {
    return "_(no asset groups selected)_";
  }

  return groups
    .map((group) => {
      const tags = group.tags.slice(0, 8).join(", ");
      const usable = (group.usableFor ?? []).slice(0, 6).join(", ");
      const quality =
        typeof group.qualityScore === "number"
          ? ` quality ${Math.round(group.qualityScore)}`
          : "";
      const theme = group.theme ? ` theme ${group.theme}` : "";

      return [
        `- **${group.name}** id \`${group.id}\` kind ${group.kind} (${group.assetCount} assets${quality}${theme})`,
        tags ? `  - tags: ${tags}` : "",
        usable ? `  - usable for: ${usable}` : ""
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

function formatAssetSearchMarkdown(
  results: BridgeAssetSearchSummary[]
): string {
  if (results.length === 0) {
    return "_(no local search results provided)_";
  }

  return results
    .map((result) => {
      const score = Math.round(result.score * 100);
      const tags = result.tags.slice(0, 6).join(", ");
      return [
        `- \`${result.assetId}\` (${result.classification}, ${score}% match) — \`${result.relativePath}\``,
        result.reason ? `  - reason: ${result.reason}` : "",
        tags ? `  - tags: ${tags}` : ""
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

function formatReferenceStyleMarkdown(
  references: BridgeReferenceSummary[]
): string {
  const styled = references.filter((reference) => reference.styleDna);

  if (styled.length === 0) {
    return "_(no reference style DNA available)_";
  }

  return styled
    .map((reference) => {
      const dna = reference.styleDna;

      if (!dna) {
        return "";
      }

      return [
        `- **${reference.path}** (id \`${reference.id}\`, ${reference.mapType})`,
        `  - mood: ${dna.mood.slice(0, 6).join(", ") || "_(none)_"}`,
        `  - layout: ${dna.layoutTraits.slice(0, 6).join(", ") || "_(none)_"}`,
        `  - density: ${dna.density}`,
        `  - visual tags: ${dna.visualTags.slice(0, 8).join(", ") || "_(none)_"}`,
        `  - recommended asset tags: ${dna.recommendedAssetTags.slice(0, 8).join(", ") || "_(none)_"}`,
        `  - prompt summary: ${dna.promptSummary}`
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export type SemanticIssueLevel = "error" | "warning";

export type SemanticIssue = {
  assetId?: string;
  doorId?: string;
  level: SemanticIssueLevel;
  lightId?: string;
  message: string;
  path: string;
  roomId?: string;
  type:
    | "duplicate_id"
    | "room_out_of_bounds"
    | "door_out_of_bounds"
    | "light_out_of_bounds"
    | "wall_zero_length"
    | "wall_out_of_bounds"
    | "missing_asset"
    | "missing_room_reference"
    | "asset_out_of_bounds"
    | "light_invalid_radius";
  wallId?: string;
};

export type AssetReplacementSuggestion = {
  reason: string;
  score: number;
  suggestionId: string;
};

export type MissingAssetReport = {
  assetId: string;
  placedAssetId?: string;
  suggestions: AssetReplacementSuggestion[];
};

export type SemanticValidationContext = {
  assetGroups: BridgeAssetGroupSummary[];
  assetSearchResults?: BridgeAssetSearchSummary[];
  knownAssetIds?: string[];
  mapHeight?: number;
  mapWidth?: number;
};

export type SemanticValidationResult = {
  issues: SemanticIssue[];
  missingAssets: MissingAssetReport[];
  ok: boolean;
};

export function validatePlanSemantics(
  plan: MapPlan,
  context: SemanticValidationContext = { assetGroups: [] }
): SemanticValidationResult {
  const issues: SemanticIssue[] = [];
  const seenIds = new Set<string>();
  const roomIds = new Set<string>();
  const knownAssetIds = new Set([
    ...(context.knownAssetIds ?? []),
    ...context.assetGroups.map((group) => group.id),
    ...(context.assetSearchResults ?? []).map((result) => result.assetId)
  ]);
  const missingAssetMap = new Map<string, MissingAssetReport>();
  const mapWidth = context.mapWidth ?? Number.POSITIVE_INFINITY;
  const mapHeight = context.mapHeight ?? Number.POSITIVE_INFINITY;

  for (const room of plan.rooms) {
    pushDuplicate(issues, seenIds, room.id, `rooms[${room.id}]`);
    roomIds.add(room.id);

    if (
      Number.isFinite(mapWidth) &&
      Number.isFinite(mapHeight) &&
      (room.bounds.x < 0 ||
        room.bounds.y < 0 ||
        room.bounds.x + room.bounds.width > mapWidth ||
        room.bounds.y + room.bounds.height > mapHeight)
    ) {
      issues.push({
        level: "error",
        message: `Room ${room.id} bounds (${room.bounds.x},${room.bounds.y} ${room.bounds.width}x${room.bounds.height}) escape map ${mapWidth}x${mapHeight}.`,
        path: `rooms[${room.id}].bounds`,
        roomId: room.id,
        type: "room_out_of_bounds"
      });
    }
  }

  for (const room of plan.rooms) {
    for (const connection of room.connections) {
      if (!roomIds.has(connection)) {
        issues.push({
          level: "warning",
          message: `Room ${room.id} connects to unknown room ${connection}.`,
          path: `rooms[${room.id}].connections`,
          roomId: room.id,
          type: "missing_room_reference"
        });
      }
    }
  }

  for (const wall of plan.walls) {
    pushDuplicate(issues, seenIds, wall.id, `walls[${wall.id}]`);

    if (wall.start.x === wall.end.x && wall.start.y === wall.end.y) {
      issues.push({
        level: "error",
        message: `Wall ${wall.id} has zero length (start equals end).`,
        path: `walls[${wall.id}]`,
        type: "wall_zero_length",
        wallId: wall.id
      });
    }

    if (
      Number.isFinite(mapWidth) &&
      Number.isFinite(mapHeight) &&
      (outOfBounds(wall.start.x, mapWidth) ||
        outOfBounds(wall.start.y, mapHeight) ||
        outOfBounds(wall.end.x, mapWidth) ||
        outOfBounds(wall.end.y, mapHeight))
    ) {
      issues.push({
        level: "warning",
        message: `Wall ${wall.id} extends outside the map bounds.`,
        path: `walls[${wall.id}]`,
        type: "wall_out_of_bounds",
        wallId: wall.id
      });
    }

    for (const roomId of wall.roomIds) {
      if (!roomIds.has(roomId)) {
        issues.push({
          level: "warning",
          message: `Wall ${wall.id} references unknown room ${roomId}.`,
          path: `walls[${wall.id}].roomIds`,
          type: "missing_room_reference",
          wallId: wall.id
        });
      }
    }
  }

  for (const door of plan.doors) {
    pushDuplicate(issues, seenIds, door.id, `doors[${door.id}]`);

    if (
      Number.isFinite(mapWidth) &&
      Number.isFinite(mapHeight) &&
      (outOfBounds(door.position.x, mapWidth) ||
        outOfBounds(door.position.y, mapHeight))
    ) {
      issues.push({
        doorId: door.id,
        level: "error",
        message: `Door ${door.id} position (${door.position.x},${door.position.y}) is outside the map.`,
        path: `doors[${door.id}].position`,
        type: "door_out_of_bounds"
      });
    }

    for (const roomId of door.roomIds) {
      if (!roomIds.has(roomId)) {
        issues.push({
          doorId: door.id,
          level: "warning",
          message: `Door ${door.id} references unknown room ${roomId}.`,
          path: `doors[${door.id}].roomIds`,
          type: "missing_room_reference"
        });
      }
    }
  }

  for (const light of plan.lights) {
    pushDuplicate(issues, seenIds, light.id, `lights[${light.id}]`);

    if (
      Number.isFinite(mapWidth) &&
      Number.isFinite(mapHeight) &&
      (outOfBounds(light.position.x, mapWidth) ||
        outOfBounds(light.position.y, mapHeight))
    ) {
      issues.push({
        level: "warning",
        lightId: light.id,
        message: `Light ${light.id} position (${light.position.x},${light.position.y}) is outside the map.`,
        path: `lights[${light.id}].position`,
        type: "light_out_of_bounds"
      });
    }

    if (!Number.isFinite(light.radius) || light.radius <= 0) {
      issues.push({
        level: "error",
        lightId: light.id,
        message: `Light ${light.id} has invalid radius ${light.radius}.`,
        path: `lights[${light.id}].radius`,
        type: "light_invalid_radius"
      });
    }
  }

  for (const asset of plan.assetPlacements) {
    pushDuplicate(issues, seenIds, asset.id, `assetPlacements[${asset.id}]`);

    if (knownAssetIds.size > 0 && !knownAssetIds.has(asset.assetId)) {
      issues.push({
        assetId: asset.assetId,
        level: "warning",
        message: `Placed asset ${asset.id} references unknown asset ${asset.assetId}.`,
        path: `assetPlacements[${asset.id}].assetId`,
        type: "missing_asset"
      });
      const existing = missingAssetMap.get(asset.assetId);

      if (existing) {
        existing.placedAssetId = existing.placedAssetId ?? asset.id;
      } else {
        missingAssetMap.set(asset.assetId, {
          assetId: asset.assetId,
          placedAssetId: asset.id,
          suggestions: suggestAssetReplacements(asset.assetId, {
            assetGroups: context.assetGroups,
            assetSearchResults: context.assetSearchResults ?? [],
            limit: 3
          })
        });
      }
    }

    if (
      Number.isFinite(mapWidth) &&
      Number.isFinite(mapHeight) &&
      (outOfBounds(asset.position.x, mapWidth) ||
        outOfBounds(asset.position.y, mapHeight))
    ) {
      issues.push({
        assetId: asset.assetId,
        level: "warning",
        message: `Placed asset ${asset.id} position (${asset.position.x},${asset.position.y}) is outside the map.`,
        path: `assetPlacements[${asset.id}].position`,
        type: "asset_out_of_bounds"
      });
    }
  }

  const missingAssets = [...missingAssetMap.values()];
  const hasErrors = issues.some((issue) => issue.level === "error");

  return {
    issues,
    missingAssets,
    ok: !hasErrors
  };
}

export type SuggestionInput = {
  assetGroups: BridgeAssetGroupSummary[];
  assetSearchResults?: BridgeAssetSearchSummary[];
  limit?: number;
};

export function suggestAssetReplacements(
  missingAssetId: string,
  input: SuggestionInput
): AssetReplacementSuggestion[] {
  const tokens = tokenize(missingAssetId);
  const limit = Math.max(1, Math.min(10, input.limit ?? 3));
  const groupSuggestions = input.assetGroups.map((group) => {
    const text = summarizeAssetGroupForSearch(group);
    const score = tokens.reduce(
      (sum, token) => sum + (text.includes(token) ? 1 : 0),
      0
    );
    const reason =
      score === 0
        ? "fallback (no token overlap)"
        : `matches ${tokens.filter((token) => text.includes(token)).join(", ")}`;
    return {
      reason,
      score,
      suggestionId: group.id
    };
  });
  const searchSuggestions = (input.assetSearchResults ?? []).map((result) => ({
    reason: `local search hit (${Math.round(result.score * 100)}% — ${result.reason || result.relativePath})`,
    score: 0.5 + result.score,
    suggestionId: result.assetId
  }));
  const combined = [...groupSuggestions, ...searchSuggestions]
    .filter((suggestion) => suggestion.suggestionId !== missingAssetId)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.suggestionId.localeCompare(right.suggestionId)
    );
  const seen = new Set<string>();
  const unique: AssetReplacementSuggestion[] = [];

  for (const suggestion of combined) {
    if (seen.has(suggestion.suggestionId)) {
      continue;
    }

    seen.add(suggestion.suggestionId);
    unique.push(suggestion);

    if (unique.length >= limit) {
      break;
    }
  }

  return unique;
}

export type RepairPlanInput = {
  applyAssetSubstitutions?: boolean;
  context: SemanticValidationContext;
  plan: MapPlan;
};

export type RepairPlanResult = {
  appliedSubstitutions: Array<{
    from: string;
    placedAssetId: string;
    to: string;
  }>;
  plan: MapPlan;
  remainingIssues: SemanticIssue[];
  removed: {
    duplicateIds: string[];
    invalidLights: string[];
    invalidWalls: string[];
    outOfBoundsAssets: string[];
    outOfBoundsDoors: string[];
  };
};

export function repairPlanLocally(input: RepairPlanInput): RepairPlanResult {
  const mapWidth = input.context.mapWidth ?? Number.POSITIVE_INFINITY;
  const mapHeight = input.context.mapHeight ?? Number.POSITIVE_INFINITY;
  const removed = {
    duplicateIds: [] as string[],
    invalidLights: [] as string[],
    invalidWalls: [] as string[],
    outOfBoundsAssets: [] as string[],
    outOfBoundsDoors: [] as string[]
  };
  const appliedSubstitutions: Array<{
    from: string;
    placedAssetId: string;
    to: string;
  }> = [];
  const seenIds = new Set<string>();
  const rooms = dedupe(input.plan.rooms, removed.duplicateIds, seenIds);
  const roomIds = new Set(rooms.map((room) => room.id));
  const sanitizedRooms = rooms.map((room) => ({
    ...room,
    connections: room.connections.filter((connection) =>
      roomIds.has(connection)
    )
  }));
  const walls = dedupe(input.plan.walls, removed.duplicateIds, seenIds).filter(
    (wall) => {
      if (wall.start.x === wall.end.x && wall.start.y === wall.end.y) {
        removed.invalidWalls.push(wall.id);
        return false;
      }

      return true;
    }
  );
  const doors = dedupe(input.plan.doors, removed.duplicateIds, seenIds).filter(
    (door) => {
      if (
        outOfBounds(door.position.x, mapWidth) ||
        outOfBounds(door.position.y, mapHeight)
      ) {
        removed.outOfBoundsDoors.push(door.id);
        return false;
      }

      return true;
    }
  );
  const lights = dedupe(
    input.plan.lights,
    removed.duplicateIds,
    seenIds
  ).filter((light) => {
    if (!Number.isFinite(light.radius) || light.radius <= 0) {
      removed.invalidLights.push(light.id);
      return false;
    }

    return true;
  });
  const knownAssetIds = new Set([
    ...(input.context.knownAssetIds ?? []),
    ...input.context.assetGroups.map((group) => group.id),
    ...(input.context.assetSearchResults ?? []).map((result) => result.assetId)
  ]);
  const apply = input.applyAssetSubstitutions ?? true;
  const placements = dedupe(
    input.plan.assetPlacements,
    removed.duplicateIds,
    seenIds
  )
    .filter((placement) => {
      if (
        outOfBounds(placement.position.x, mapWidth) ||
        outOfBounds(placement.position.y, mapHeight)
      ) {
        removed.outOfBoundsAssets.push(placement.id);
        return false;
      }

      return true;
    })
    .map<PlacedAsset>((placement) => {
      if (
        !apply ||
        knownAssetIds.size === 0 ||
        knownAssetIds.has(placement.assetId)
      ) {
        return placement;
      }

      const suggestions = suggestAssetReplacements(placement.assetId, {
        assetGroups: input.context.assetGroups,
        assetSearchResults: input.context.assetSearchResults ?? [],
        limit: 1
      });
      const replacement = suggestions[0]?.suggestionId;

      if (!replacement) {
        return placement;
      }

      appliedSubstitutions.push({
        from: placement.assetId,
        placedAssetId: placement.id,
        to: replacement
      });

      return {
        ...placement,
        assetId: replacement
      };
    });
  const repairedPlan: MapPlan = MapPlanSchema.parse({
    ...input.plan,
    assetPlacements: placements,
    doors,
    lights,
    rooms: sanitizedRooms,
    walls
  });
  const validation = validatePlanSemantics(repairedPlan, input.context);

  return {
    appliedSubstitutions,
    plan: repairedPlan,
    remainingIssues: validation.issues,
    removed
  };
}

function dedupe<T extends { id: string }>(
  items: T[],
  removedIds: string[],
  seenIds: Set<string>
): T[] {
  const localSeen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (localSeen.has(item.id) || seenIds.has(item.id)) {
      removedIds.push(item.id);
      continue;
    }

    localSeen.add(item.id);
    seenIds.add(item.id);
    result.push(item);
  }

  return result;
}

function outOfBounds(value: number, max: number): boolean {
  return !Number.isFinite(value) || value < 0 || value > max;
}

function pushDuplicate(
  issues: SemanticIssue[],
  seenIds: Set<string>,
  id: string,
  path: string
): void {
  if (seenIds.has(id)) {
    issues.push({
      level: "error",
      message: `Duplicate id ${id} at ${path}.`,
      path,
      type: "duplicate_id"
    });
    return;
  }

  seenIds.add(id);
}

export function listRoomLabels(
  plan: MapPlan
): Array<{ id: string; label: string }> {
  return plan.rooms.map((room: RoomNode) => ({
    id: room.id,
    label: room.label
  }));
}
