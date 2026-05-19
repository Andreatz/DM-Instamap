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
  createLocalEmbeddingProvider,
  generateAssetEmbeddings,
  loadAssetEmbeddingIndex,
  searchAssetsByImage,
  searchAssetsByText,
  type AssetEmbeddingEntry,
  type AssetEmbeddingIndex,
  type AssetEmbeddingInput,
  type AssetEmbeddingOptions,
  type AssetImageSearchOptions,
  type AssetSearchResult,
  type AssetTextSearchOptions,
  type EmbeddingProvider
} from "./embeddings";

export {
  matchAssetGroupsForRoom,
  type AssetGroupMatch,
  type AssetMatcherInput,
  type AssetMatchReason,
  type MatchableAssetGroup
} from "./matcher";

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
