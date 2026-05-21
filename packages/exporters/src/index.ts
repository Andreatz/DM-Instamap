export {
  exportMapDocumentRaster,
  exportMapDocumentRasterLayerBundle,
  exportMapDocumentRasterLayers,
  renderMapDocumentSvg,
  type RasterExportFormat,
  type RasterLayerBundleResult,
  type RasterExportLayer,
  type RasterExportOptions,
  type RasterExportResult
} from "./raster";

export {
  exportMapDocumentDd2Vtt,
  importDd2Vtt,
  importDd2VttFile,
  type Dd2VttEmbeddedImage,
  type Dd2VttExportObject,
  type Dd2VttExportOptions,
  type Dd2VttExportResult,
  type Dd2VttImportOptions,
  type Dd2VttImportResult
} from "./dd2vtt";

export {
  exportFoundryModule,
  type FoundryAmbientLightData,
  type FoundryExportOptions,
  type FoundryJournalEntryData,
  type FoundryModuleExportResult,
  type FoundryModuleManifest,
  type FoundrySceneData,
  type FoundryWallData
} from "./foundry";

export {
  exportSessionPack,
  type SessionPackArtifact,
  type SessionPackOptions,
  type SessionPackResult
} from "./session-pack";

export {
  applyVisibilityMode,
  isHiddenRoom,
  listVisibilityModes,
  type MapVisibilityMode
} from "./visibility";

export {
  DMIMAP_FORMAT_VERSION,
  exportDmImap,
  type DmImapExportOptions,
  type DmImapExportPayload,
  type DmImapExportResult
} from "./dmimap";

export {
  createAssetManifestResolver,
  type AssetManifestResolverOptions,
  type AssetResolver,
  type RasterAssetSource
} from "./asset-resolver";

export type ExportFormat = "png" | "webp" | "dd2vtt" | "foundry" | "dmimap";

export function listSupportedExportFormats(): ExportFormat[] {
  return ["png", "webp", "dd2vtt", "foundry", "dmimap"];
}
