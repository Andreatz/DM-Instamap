export {
  exportMapDocumentRaster,
  renderMapDocumentSvg,
  type RasterExportFormat,
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
  type FoundryModuleExportResult,
  type FoundryModuleManifest,
  type FoundrySceneData,
  type FoundryWallData
} from "./foundry";

export type ExportFormat = "png" | "webp" | "dd2vtt" | "foundry";

export function listSupportedExportFormats(): ExportFormat[] {
  return ["png", "webp", "dd2vtt", "foundry"];
}
