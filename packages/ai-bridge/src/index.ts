import { resolveAiConfigFromEnv } from "./providers";
import type { BridgeStatus } from "./types";

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

export type {
  AssetReplacementSuggestion,
  BridgeAssetGroupSummary,
  BridgeAssetSearchSummary,
  BridgeContext,
  BridgePromptInput,
  BridgeReferenceSummary,
  BridgeStatus,
  BridgeValidationResult,
  MissingAssetReport,
  PromptPacketInput,
  RepairPlanInput,
  RepairPlanResult,
  SemanticIssue,
  SemanticIssueLevel,
  SemanticValidationContext,
  SemanticValidationResult,
  SuggestionInput
} from "./types";

export {
  buildChatGptBridgePrompt,
  buildPromptPacket,
  buildRepairPrompt,
  REQUIRED_MAP_PLAN_SCHEMA,
  searchBridgeContext
} from "./prompt";

export {
  listRoomLabels,
  repairPlanLocally,
  suggestAssetReplacements,
  validateBridgeResponse,
  validatePlanSemantics
} from "./validation";
