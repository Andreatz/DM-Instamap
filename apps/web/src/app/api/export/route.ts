import { migrateMapDocument, type MapDocument } from "@dm-instamap/core/server";
import {
  applyVisibilityMode,
  exportDmImap,
  exportFoundryModule,
  exportMapDocumentDd2Vtt,
  exportMapDocumentRaster,
  exportMapDocumentRasterLayerBundle,
  exportSessionPack,
  type ExportFormat,
  type MapVisibilityMode,
  type RasterExportFormat
} from "@dm-instamap/exporters";
import { createWorkspaceAssetResolver } from "@/lib/export-assets";

type WebExportFormat = ExportFormat | "session-pack";

type ExportRequest = {
  description?: unknown;
  document?: unknown;
  format?: unknown;
  includeGrid?: unknown;
  includeInitiative?: unknown;
  includeJournals?: unknown;
  mode?: unknown;
  scale?: unknown;
  splitLayers?: unknown;
  webpQuality?: unknown;
};

const RASTER_FORMATS = new Set<WebExportFormat>(["png", "webp"]);
const VALID_FORMATS = new Set<WebExportFormat>([
  "png",
  "webp",
  "dd2vtt",
  "foundry",
  "dmimap",
  "session-pack"
]);
const VALID_MODES = new Set<MapVisibilityMode>(["player", "gm", "clean"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExportRequest;
    const baseDocument = migrateMapDocument(body.document);
    const format = parseFormat(body.format);

    if (!format) {
      return Response.json(
        {
          error: "Export format must be png, webp, dd2vtt, foundry, or dmimap."
        },
        { status: 400 }
      );
    }

    const mode = parseMode(body.mode);
    const document = applyVisibilityMode(baseDocument, mode);
    const includeGrid =
      typeof body.includeGrid === "boolean" ? body.includeGrid : true;
    const scale = typeof body.scale === "number" ? body.scale : 1;
    const splitLayers =
      typeof body.splitLayers === "boolean" ? body.splitLayers : false;
    const webpQuality =
      typeof body.webpQuality === "number" ? body.webpQuality : undefined;
    const assetResolver = await createWorkspaceAssetResolver();

    if (RASTER_FORMATS.has(format)) {
      if (splitLayers) {
        const result = await exportMapDocumentRasterLayerBundle(document, {
          assetResolver,
          format: format as RasterExportFormat,
          includeGrid,
          scale,
          webpQuality
        });

        return new Response(toArrayBuffer(result.buffer), {
          headers: buildHeaders({
            contentType: result.contentType,
            filename: namedFilename(result.filename, mode),
            mode
          })
        });
      }

      const result = await exportMapDocumentRaster(document, {
        assetResolver,
        format: format as RasterExportFormat,
        includeGrid,
        scale,
        webpQuality
      });

      return new Response(toArrayBuffer(result.buffer), {
        headers: buildHeaders({
          contentType: result.contentType,
          filename: namedFilename(result.filename, mode),
          mode
        })
      });
    }

    if (format === "dd2vtt") {
      const result = await exportMapDocumentDd2Vtt(document, {
        assetResolver,
        embedImage: true,
        imageFormat: "png",
        includeGrid,
        scale
      });

      return new Response(toArrayBuffer(Buffer.from(result.json, "utf8")), {
        headers: buildHeaders({
          contentType: "application/json",
          filename: namedFilename(buildFilename(document, "dd2vtt"), mode),
          mode
        })
      });
    }

    if (format === "foundry") {
      const includeJournals =
        typeof body.includeJournals === "boolean" ? body.includeJournals : true;
      const result = await exportFoundryModule(document, {
        assetResolver,
        imageFormat: "webp",
        includeGridInImage: includeGrid,
        includeJournals,
        scale
      });

      return new Response(toArrayBuffer(result.buffer), {
        headers: buildHeaders({
          contentType: "application/zip",
          filename: namedFilename(result.filename, mode),
          mode
        })
      });
    }

    if (format === "session-pack") {
      const description =
        typeof body.description === "string" ? body.description : undefined;
      const includeInitiative =
        typeof body.includeInitiative === "boolean"
          ? body.includeInitiative
          : true;
      const result = await exportSessionPack(document, {
        assetResolver,
        description,
        imageFormat: "png",
        includeGrid,
        includeInitiative,
        scale
      });

      return new Response(toArrayBuffer(result.buffer), {
        headers: buildHeaders({
          contentType: "application/zip",
          filename: namedFilename(result.filename, mode),
          mode
        })
      });
    }

    const result = exportDmImap(document, { mode });

    return new Response(toArrayBuffer(result.buffer), {
      headers: buildHeaders({
        contentType: result.contentType,
        filename: result.filename,
        mode
      })
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not export map.";
    return Response.json({ error: message }, { status: 400 });
  }
}

function parseFormat(value: unknown): WebExportFormat | null {
  if (typeof value !== "string") {
    return null;
  }

  return VALID_FORMATS.has(value as WebExportFormat)
    ? (value as WebExportFormat)
    : null;
}

function parseMode(value: unknown): MapVisibilityMode {
  if (
    typeof value === "string" &&
    VALID_MODES.has(value as MapVisibilityMode)
  ) {
    return value as MapVisibilityMode;
  }

  return "gm";
}

function buildFilename(document: MapDocument, extension: string): string {
  const slug =
    document.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "") || "dm-instamap-map";
  return `${slug}.${extension}`;
}

function namedFilename(filename: string, mode: MapVisibilityMode): string {
  if (mode === "gm") {
    return filename;
  }

  const dotIndex = filename.lastIndexOf(".");

  if (dotIndex <= 0) {
    return `${filename}-${mode}`;
  }

  return `${filename.slice(0, dotIndex)}-${mode}${filename.slice(dotIndex)}`;
}

function buildHeaders(input: {
  contentType: string;
  filename: string;
  mode: MapVisibilityMode;
}): HeadersInit {
  return {
    "Content-Disposition": `attachment; filename="${input.filename}"`,
    "Content-Type": input.contentType,
    "X-DM-Instamap-Export-Mode": input.mode
  };
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}
