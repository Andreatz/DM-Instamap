import type { MapPlan } from "@dm-instamap/core";

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

export type PromptPacketInput = BridgePromptInput & {
  packetTitle?: string;
};

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

export type SuggestionInput = {
  assetGroups: BridgeAssetGroupSummary[];
  assetSearchResults?: BridgeAssetSearchSummary[];
  limit?: number;
};

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
