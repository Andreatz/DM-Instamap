export type AssetCandidate = {
  extension: string;
  path: string;
  source: "local";
};

export function createAssetCandidate(path: string): AssetCandidate {
  const extension = path.includes(".") ? path.split(".").at(-1)?.toLowerCase() : "";

  return {
    extension: extension ?? "",
    path,
    source: "local"
  };
}

export {
  ASSET_CLASSIFICATIONS,
  classifyAsset,
  createAutomaticTags,
  type AssetClassification,
  type AssetClassificationResult,
  type AssetClassificationSource,
  type AssetOverride
} from "./classifier";

export {
  scanAssets,
  SUPPORTED_ASSET_EXTENSIONS,
  type AssetManifest,
  type AssetManifestEntry,
  type AssetScanError,
  type AssetScannerOptions,
  type DominantColor
} from "./scanner";

export {
  groupAssets,
  type AssetGroupEntry,
  type AssetGroupOptions,
  type AssetGroupsFile
} from "./groups";

export {
  createEmbeddingProviderFromEnv,
  createLocalEmbeddingProvider,
  createRemoteEmbeddingProvider,
  explainAssetSearchResult,
  generateAssetEmbeddings,
  loadAssetEmbeddingIndex,
  resolveEmbeddingConfigFromEnv,
  searchAssetsByImage,
  searchAssetsByText,
  type AssetEmbeddingEntry,
  type AssetEmbeddingIndex,
  type AssetEmbeddingInput,
  type AssetEmbeddingOptions,
  type AssetImageSearchOptions,
  type AssetSearchResult,
  type AssetTextSearchOptions,
  type EmbeddingProvider,
  type RemoteEmbeddingProviderConfig,
  type ResolvedEmbeddingConfig
} from "./embeddings";

export {
  matchAssetGroupsForRoom,
  type AssetGroupMatch,
  type AssetMatcherInput,
  type AssetMatchReason,
  type MatchableAssetGroup
} from "./matcher";

export {
  auditAssets,
  buildAssetReviewQueue,
  calculateAssetQualityScore,
  createVisualHash,
  findDuplicateGroups,
  type AssetAuditEntry,
  type AssetAuditFile,
  type AssetAuditOptions,
  type AssetAuditWarning,
  type AssetDuplicateGroup,
  type AssetQualitySignals,
  type AuditableAsset,
  type ReviewPriority
} from "./audit";

export {
  analyzeLocalImage,
  type LocalImageAnalysis
} from "./image-analysis";

export {
  applyPackRulesToEntry,
  importAssetPack,
  listPackPresets,
  PACK_PRESETS,
  type PackImporterOptions,
  type PackImportResult,
  type PackPreset
} from "./pack-importer";

export {
  createAutomatic1111Provider,
  createCustomImageGenerationProvider,
  createImageGenerationProviderFromEnv,
  createReplicateImageGenerationProvider,
  importGeneratedAssetToLibrary,
  resolveImageGenerationConfigFromEnv,
  type Automatic1111ProviderConfig,
  type CustomImageGenerationProviderConfig,
  type GeneratedAssetMetadata,
  type ImageGenerationOutput,
  type ImageGenerationProvider,
  type ImageGenerationRequest,
  type ImportGeneratedAssetOptions,
  type ReplicateProviderConfig,
  type ResolvedImageGenerationConfig
} from "./image-generation";

export {
  scanReferences,
  SUPPORTED_REFERENCE_EXTENSIONS,
  type ReferenceDominantColor,
  type ReferenceManifestEntry,
  type ReferenceMapType,
  type ReferenceScanError,
  type ReferenceScannerOptions,
  type ReferencesManifest,
  type SupportedReferenceExtension
} from "./references";

export {
  buildReferenceStyleDna,
  generateReferenceStyleDna,
  type ReferencePaletteRole,
  type ReferenceStyleDna,
  type ReferenceStyleDnaFile,
  type ReferenceStyleOptions
} from "./reference-style";
