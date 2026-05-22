import {
  migrateMapDocument,
  type MapDocument
} from "@dm-instamap/core/browser";
import { applyVisibilityMode, type MapVisibilityMode } from "./visibility";

export type DmImapExportOptions = {
  mode?: MapVisibilityMode;
};

export type DmImapExportResult = {
  buffer: Buffer;
  contentType: "application/json";
  filename: string;
  json: string;
};

export type DmImapExportPayload = {
  document: MapDocument;
  exportedAt: string;
  format: "dmimap";
  mode: MapVisibilityMode;
  version: 1;
};

export const DMIMAP_FORMAT_VERSION = 1 as const;

export function exportDmImap(
  document: MapDocument,
  options: DmImapExportOptions = {}
): DmImapExportResult {
  const mode: MapVisibilityMode = options.mode ?? "gm";
  const visibleDocument = applyVisibilityMode(
    migrateMapDocument(document),
    mode
  );
  const payload: DmImapExportPayload = {
    document: visibleDocument,
    exportedAt: new Date().toISOString(),
    format: "dmimap",
    mode,
    version: DMIMAP_FORMAT_VERSION
  };
  const json = `${JSON.stringify(payload, null, 2)}\n`;

  return {
    buffer: Buffer.from(json, "utf8"),
    contentType: "application/json",
    filename: `${slugify(visibleDocument.name || visibleDocument.id)}-${mode}.dmimap.json`,
    json
  };
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "") || "dm-instamap-map"
  );
}
