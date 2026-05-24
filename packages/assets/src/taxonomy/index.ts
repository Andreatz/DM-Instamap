export {
  ASSET_STATUSES,
  createDefaultUsageRules,
  createEmptyMetadata,
  isAssetStatus,
  isMacroCategory,
  MACRO_CATEGORIES,
  MANIFEST_VERSION,
  type AssetManifest,
  type AssetManifestItem,
  type AssetManifestStats,
  type AssetMetadata,
  type AssetStatus,
  type AssetUsageRules,
  type MacroCategory
} from "./schema";

export {
  createImportedTagsAccumulator,
  finalizeImportedTags,
  mergeTagFileIntoImport,
  parseDungeondraftTags,
  type DungeondraftTagsFile,
  type ImportedTags
} from "./parse-tags";

export {
  extractSourcePacks,
  mapSourceTags,
  type MappedAsset,
  type MapSourceTagsInput
} from "./mapping";

export {
  applyOverrides,
  type ApplyOverridesResult,
  type AssetOverrideEntry,
  type AssetOverridesFile,
  type GroupOverrideEntry,
  type PackOverrideEntry
} from "./overrides";

export {
  findAssets,
  findAssetsScored,
  isSuspiciousLight,
  type FindAssetsQuery,
  type FindAssetsResult
} from "./find-assets";

export {
  assembleManifestItem,
  buildManifest,
  computeStats,
  createAssetId,
  TAXONOMY_PATHS
} from "./manifest-io";

export {
  auditManifest,
  renderAuditMarkdown,
  type AuditCheck,
  type AuditReport
} from "./audit";

export {
  validateManifest,
  type ValidateOptions,
  type ValidationIssue,
  type ValidationResult
} from "./validate";
