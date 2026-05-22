import { z } from "zod";
import {
  MapDocumentSchema,
  MapDocumentV2Schema,
  type MapDocument,
  type MapDocumentV2
} from "../index";
import { migrateV0ToV1 } from "./v0-to-v1";

export const CURRENT_MAP_DOCUMENT_VERSION = 1 as const;

export class MapDocumentMigrationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "MapDocumentMigrationError";
    this.cause = options?.cause;
  }
}

export function migrateMapDocument(input: unknown): MapDocument {
  const candidate = unwrapDmimapPayload(input);

  try {
    const version = readMapDocumentVersion(candidate);
    const migrated = version === 0 ? migrateV0ToV1(candidate) : candidate;
    return MapDocumentSchema.parse(migrated);
  } catch (error) {
    if (error instanceof MapDocumentMigrationError) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      throw new MapDocumentMigrationError(
        `Invalid MapDocument after migration: ${z.prettifyError(error)}`,
        {
          cause: error
        }
      );
    }

    throw new MapDocumentMigrationError(
      `Could not migrate MapDocument: ${error instanceof Error ? error.message : "unknown error"}`,
      { cause: error }
    );
  }
}

export function upgradeMapDocumentToV2(input: unknown): MapDocumentV2 {
  const candidate = unwrapDmimapPayload(input);
  const candidateVersion = readMapDocumentVersion(candidate);

  if (candidateVersion === 2) {
    return MapDocumentV2Schema.parse(candidate);
  }

  const v1 = migrateMapDocument(candidate);
  return MapDocumentV2Schema.parse({
    ...v1,
    metadata: {
      exportHistory: [],
      schemaChangelog: ["v1-to-v2"]
    },
    version: 2
  });
}

function unwrapDmimapPayload(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const record = input as Record<string, unknown>;

  if (record.format === "dmimap" && record.document !== undefined) {
    return record.document;
  }

  return input;
}

function readMapDocumentVersion(input: unknown): 0 | 1 | 2 {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new MapDocumentMigrationError(
      "MapDocument input must be a JSON object."
    );
  }

  const version = (input as Record<string, unknown>).version;

  if (version === undefined || version === null) {
    return 0;
  }

  if (version === CURRENT_MAP_DOCUMENT_VERSION) {
    return CURRENT_MAP_DOCUMENT_VERSION;
  }

  if (version === 2) {
    return 2;
  }

  throw new MapDocumentMigrationError(
    `Unsupported MapDocument version: ${String(version)}.`
  );
}
