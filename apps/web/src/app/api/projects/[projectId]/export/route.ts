import {
  applyVisibilityMode,
  exportDmImap,
  exportFoundryModule,
  exportMapDocumentDd2Vtt,
  exportMapDocumentRaster,
  exportMapDocumentRasterLayerBundle,
  type ExportFormat,
  type MapVisibilityMode,
  type RasterExportFormat
} from "@dm-instamap/exporters";
import { InvalidProjectIdError, ProjectNotFoundError, readProject } from "@/lib/projects";

type ExportRequest = {
  format?: unknown;
  includeGrid?: unknown;
  mode?: unknown;
  scale?: unknown;
  splitLayers?: unknown;
  webpQuality?: unknown;
};

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

const RASTER_FORMATS = new Set<ExportFormat>(["png", "webp"]);
const VALID_FORMATS = new Set<ExportFormat>(["png", "webp", "dd2vtt", "foundry", "dmimap"]);
const VALID_MODES = new Set<MapVisibilityMode>(["player", "gm", "clean"]);

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const project = await readProject(projectId);
    const body = (await request.json().catch(() => ({}))) as ExportRequest;
    const format = parseFormat(body.format);

    if (!format) {
      return Response.json({ error: "Export format must be png, webp, dd2vtt, foundry, or dmimap.", ok: false }, { status: 400 });
    }

    const mode = parseMode(body.mode);
    const document = applyVisibilityMode(project.document, mode);
    const includeGrid = typeof body.includeGrid === "boolean" ? body.includeGrid : true;
    const scale = typeof body.scale === "number" ? body.scale : 1;
    const splitLayers = typeof body.splitLayers === "boolean" ? body.splitLayers : false;
    const webpQuality = typeof body.webpQuality === "number" ? body.webpQuality : undefined;

    if (RASTER_FORMATS.has(format)) {
      if (splitLayers) {
        const result = await exportMapDocumentRasterLayerBundle(document, {
          format: format as RasterExportFormat,
          includeGrid,
          scale,
          webpQuality
        });

        return responseFromBuffer(result.buffer, result.contentType, namedFilename(result.filename, mode), mode);
      }

      const result = await exportMapDocumentRaster(document, {
        format: format as RasterExportFormat,
        includeGrid,
        scale,
        webpQuality
      });

      return responseFromBuffer(result.buffer, result.contentType, namedFilename(result.filename, mode), mode);
    }

    if (format === "dd2vtt") {
      const result = await exportMapDocumentDd2Vtt(document, {
        embedImage: true,
        imageFormat: "png",
        includeGrid,
        scale
      });

      return responseFromBuffer(
        Buffer.from(result.json, "utf8"),
        "application/json",
        namedFilename(`${slugify(document.name || document.id)}.dd2vtt`, mode),
        mode
      );
    }

    if (format === "foundry") {
      const result = await exportFoundryModule(document, {
        imageFormat: "webp",
        includeGridInImage: includeGrid,
        scale
      });

      return responseFromBuffer(result.buffer, "application/zip", namedFilename(result.filename, mode), mode);
    }

    const result = exportDmImap(document, { mode });
    return responseFromBuffer(result.buffer, result.contentType, result.filename, mode);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return Response.json({ error: error.message, ok: false }, { status: 404 });
    }

    if (error instanceof InvalidProjectIdError) {
      return Response.json({ error: error.message, ok: false }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Could not export project.";
    return Response.json({ error: message, ok: false }, { status: 400 });
  }
}

function parseFormat(value: unknown): ExportFormat | null {
  if (typeof value !== "string") {
    return null;
  }

  return VALID_FORMATS.has(value as ExportFormat) ? (value as ExportFormat) : null;
}

function parseMode(value: unknown): MapVisibilityMode {
  if (typeof value === "string" && VALID_MODES.has(value as MapVisibilityMode)) {
    return value as MapVisibilityMode;
  }

  return "gm";
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

function responseFromBuffer(buffer: Buffer, contentType: string, filename: string, mode: MapVisibilityMode): Response {
  return new Response(toArrayBuffer(buffer), {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": contentType,
      "X-DM-Instamap-Export-Mode": mode
    }
  });
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "dm-instamap-map";
}
