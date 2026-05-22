import type {
  BridgeAssetGroupSummary,
  BridgeAssetSearchSummary,
  BridgeContext,
  BridgePromptInput,
  BridgeReferenceSummary,
  PromptPacketInput
} from "./types";

const DEFAULT_ASSET_LIMIT = 12;
const DEFAULT_REFERENCE_LIMIT = 5;

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

export function summarizeAssetGroupForSearch(
  group: BridgeAssetGroupSummary
): string {
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

export function tokenize(value: string): string[] {
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
