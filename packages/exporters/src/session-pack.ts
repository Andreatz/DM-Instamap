import JSZip from "jszip";
import type { MapDocument } from "@dm-instamap/core/browser";
import type { AssetResolver } from "./asset-resolver";
import { exportMapDocumentRaster, type RasterExportFormat } from "./raster";
import { applyVisibilityMode } from "./visibility";

export type SessionPackOptions = {
  assetResolver?: AssetResolver;
  description?: string;
  filenameSuffix?: string;
  imageFormat?: RasterExportFormat;
  includeGrid?: boolean;
  includeInitiative?: boolean;
  scale?: number;
};

export type SessionPackArtifact = {
  contentType: string;
  path: string;
  size: number;
};

export type SessionPackResult = {
  artifacts: SessionPackArtifact[];
  buffer: Buffer;
  filename: string;
};

export async function exportSessionPack(
  document: MapDocument,
  options: SessionPackOptions = {}
): Promise<SessionPackResult> {
  const format = options.imageFormat ?? "png";
  const scale = options.scale ?? 1;
  const includeGrid = options.includeGrid ?? true;
  const slug = slugify(document.name || document.id);

  const fullImage = await exportMapDocumentRaster(document, {
    assetResolver: options.assetResolver,
    format,
    includeGrid,
    scale
  });
  const gmImage = await exportMapDocumentRaster(applyVisibilityMode(document, "gm"), {
    assetResolver: options.assetResolver,
    format,
    includeGrid,
    scale
  });
  const playerImage = await exportMapDocumentRaster(applyVisibilityMode(document, "player"), {
    assetResolver: options.assetResolver,
    format,
    includeGrid,
    scale
  });

  const zip = new JSZip();
  const artifacts: SessionPackArtifact[] = [];
  const addBinary = (filePath: string, contentType: string, buffer: Buffer): void => {
    zip.file(filePath, buffer);
    artifacts.push({ contentType, path: filePath, size: buffer.length });
  };
  const addText = (filePath: string, content: string): void => {
    const buffer = Buffer.from(content, "utf8");
    zip.file(filePath, buffer);
    artifacts.push({ contentType: "text/plain", path: filePath, size: buffer.length });
  };
  const addJson = (filePath: string, payload: unknown): void => {
    const buffer = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
    zip.file(filePath, buffer);
    artifacts.push({ contentType: "application/json", path: filePath, size: buffer.length });
  };

  addBinary(`maps/${slug}-full.${format}`, fullImage.contentType, fullImage.buffer);
  addBinary(`maps/${slug}-gm.${format}`, gmImage.contentType, gmImage.buffer);
  addBinary(`maps/${slug}-player.${format}`, playerImage.contentType, playerImage.buffer);

  const gmNotes = (document.plan?.gmNotes ?? []).map((note) => ({
    id: note.id,
    position: note.position,
    text: note.text,
    title: note.title
  }));
  const planNotes = document.plan?.notes ?? [];
  addJson("notes/gm-notes.json", { entries: gmNotes });

  if (planNotes.length > 0) {
    addText("notes/plan-notes.txt", planNotes.join("\n\n"));
  }

  if (options.description) {
    addText("notes/description.txt", options.description);
  }

  if (options.includeInitiative !== false) {
    addJson("initiative/initiative.json", {
      entries: document.plan?.initiative ?? []
    });
  }

  addJson("manifest.json", buildManifest(document, artifacts, format));

  const buffer = await zip.generateAsync({ compression: "DEFLATE", type: "nodebuffer" });
  const filename = `${slug}${options.filenameSuffix ?? ""}-session-pack.zip`;

  return {
    artifacts,
    buffer,
    filename
  };
}

function buildManifest(document: MapDocument, artifacts: SessionPackArtifact[], format: RasterExportFormat) {
  return {
    artifacts: artifacts.map((artifact) => ({
      contentType: artifact.contentType,
      path: artifact.path,
      size: artifact.size
    })),
    documentId: document.id,
    format,
    generatedAt: new Date().toISOString(),
    grid: document.grid,
    mapName: document.name,
    rooms:
      document.plan?.rooms.map((room) => ({
        bounds: room.bounds,
        id: room.id,
        kind: room.kind,
        label: room.label,
        tags: room.tags
      })) ?? [],
    version: 1
  };
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "session";
}
