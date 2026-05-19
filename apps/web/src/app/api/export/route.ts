import { MapDocumentSchema } from "@dm-instamap/core";
import { exportMapDocumentRaster, type RasterExportFormat } from "@dm-instamap/exporters";

type ExportRequest = {
  document?: unknown;
  format?: unknown;
  includeGrid?: unknown;
  scale?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExportRequest;
    const document = MapDocumentSchema.parse(body.document);
    const format = parseFormat(body.format);

    if (!format) {
      return Response.json({ error: "Export format must be png or webp." }, { status: 400 });
    }

    const result = await exportMapDocumentRaster(document, {
      format,
      includeGrid: typeof body.includeGrid === "boolean" ? body.includeGrid : true,
      scale: typeof body.scale === "number" ? body.scale : 1
    });

    return new Response(toArrayBuffer(result.buffer), {
      headers: {
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Type": result.contentType,
        "X-DM-Instamap-Export-Height": String(result.height),
        "X-DM-Instamap-Export-Width": String(result.width)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not export map.";
    return Response.json({ error: message }, { status: 400 });
  }
}

function parseFormat(value: unknown): RasterExportFormat | null {
  return value === "png" || value === "webp" ? value : null;
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}
