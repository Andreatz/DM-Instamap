import { readFile } from "node:fs/promises";
import path from "node:path";
import { findWorkspaceRoot } from "./assets-manifest";
import { parseJsonFileContent } from "./json-file";

export type AuditReviewPriority = "low" | "medium" | "high" | "critical";

export type AuditEntryView = {
  assetId: string;
  classification: string;
  confidence: number;
  duplicateConfidence: number | null;
  duplicateGroupId: string | null;
  fileHash: string | null;
  qualityScore: number;
  qualitySignals: {
    classificationConfidence: number;
    filenameSignal: number;
    resolution: number;
    sharpness: number;
    transparency: number;
  };
  reasons: string[];
  relativePath: string;
  reviewPriority: AuditReviewPriority;
  tags: string[];
  visualHash: string;
};

export type AuditDuplicateGroupView = {
  assetIds: string[];
  classificationConflict: boolean;
  confidence: number;
  id: string;
  reason: "file-hash" | "visual-hash";
  visualHash: string;
};

export type AuditWarningView = {
  assetId?: string;
  message: string;
  type: "classification_conflict" | "missing_metadata" | "low_confidence" | "low_quality";
};

export type LoadedAssetAudit = {
  assetCount: number;
  auditPath: string;
  classificationWarnings: AuditWarningView[];
  duplicateGroupCount: number;
  duplicateGroups: AuditDuplicateGroupView[];
  generatedAt: string | null;
  lowQualityCount: number;
  missing: boolean;
  needsReviewCount: number;
  reviewQueue: AuditEntryView[];
};

export type AssetAuditBatchId =
  | "critical"
  | "high"
  | "medium"
  | "duplicates"
  | "low-quality"
  | "unknown-classification"
  | "missing-metadata"
  | "classification-conflict";

export type AssetAuditBatch = {
  description: string;
  entries: AuditEntryView[];
  id: AssetAuditBatchId;
  label: string;
};

export async function loadAssetAudit(): Promise<LoadedAssetAudit> {
  const workspaceRoot = await findWorkspaceRoot(process.cwd());
  const auditPath = path.join(workspaceRoot, "data", "indexes", "asset-audit.json");

  try {
    const raw = await readFile(auditPath, "utf8");
    const file = parseJsonFileContent(raw) as Record<string, unknown>;
    const reviewQueue = normalizeEntries(Array.isArray(file.reviewQueue) ? file.reviewQueue : []);
    const duplicateGroups = normalizeDuplicateGroups(
      Array.isArray(file.duplicateGroups) ? file.duplicateGroups : []
    );
    const classificationWarnings = normalizeWarnings(
      Array.isArray(file.classificationWarnings) ? file.classificationWarnings : []
    );

    return {
      assetCount: typeof file.assetCount === "number" ? file.assetCount : reviewQueue.length,
      auditPath,
      classificationWarnings,
      duplicateGroupCount: typeof file.duplicateGroupCount === "number" ? file.duplicateGroupCount : duplicateGroups.length,
      duplicateGroups,
      generatedAt: typeof file.generatedAt === "string" ? file.generatedAt : null,
      lowQualityCount: typeof file.lowQualityCount === "number" ? file.lowQualityCount : 0,
      missing: false,
      needsReviewCount: typeof file.needsReviewCount === "number" ? file.needsReviewCount : reviewQueue.length,
      reviewQueue
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        assetCount: 0,
        auditPath,
        classificationWarnings: [],
        duplicateGroupCount: 0,
        duplicateGroups: [],
        generatedAt: null,
        lowQualityCount: 0,
        missing: true,
        needsReviewCount: 0,
        reviewQueue: []
      };
    }

    throw error;
  }
}

export function buildAuditBatches(audit: LoadedAssetAudit): AssetAuditBatch[] {
  const queue = audit.reviewQueue;
  const duplicateAssetIds = new Set(audit.duplicateGroups.flatMap((group) => group.assetIds));
  const conflictAssetIds = new Set(
    audit.duplicateGroups.filter((group) => group.classificationConflict).flatMap((group) => group.assetIds)
  );
  const missingMetadataIds = new Set(
    audit.classificationWarnings.filter((warning) => warning.type === "missing_metadata").map((warning) => warning.assetId ?? "")
  );

  return [
    {
      description: "Problemi gravi che impediscono l'uso sicuro dell'asset.",
      entries: queue.filter((entry) => entry.reviewPriority === "critical"),
      id: "critical",
      label: "Critici"
    },
    {
      description: "Probabilmente problematici. Da correggere presto.",
      entries: queue.filter((entry) => entry.reviewPriority === "high"),
      id: "high",
      label: "Alta priorita"
    },
    {
      description: "Classificazione o qualita potenzialmente dubbia.",
      entries: queue.filter((entry) => entry.reviewPriority === "medium"),
      id: "medium",
      label: "Priorita media"
    },
    {
      description: "Duplicati visuali o di hash file rilevati localmente.",
      entries: queue.filter((entry) => duplicateAssetIds.has(entry.assetId)),
      id: "duplicates",
      label: "Duplicati"
    },
    {
      description: "Punteggio qualita sotto la soglia sicura.",
      entries: queue.filter((entry) => entry.qualityScore < 45),
      id: "low-quality",
      label: "Bassa qualita"
    },
    {
      description: "Il classificatore automatico non ha assegnato un tipo affidabile.",
      entries: queue.filter((entry) => entry.classification === "unknown"),
      id: "unknown-classification",
      label: "Classificazione sconosciuta"
    },
    {
      description: "Asset senza metadati di larghezza, altezza o trasparenza.",
      entries: queue.filter((entry) => missingMetadataIds.has(entry.assetId)),
      id: "missing-metadata",
      label: "Metadati mancanti"
    },
    {
      description: "Gruppi duplicati con classificazioni non coerenti.",
      entries: queue.filter((entry) => conflictAssetIds.has(entry.assetId)),
      id: "classification-conflict",
      label: "Conflitto classificazione"
    }
  ];
}

function normalizeEntries(raw: unknown[]): AuditEntryView[] {
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const input = entry as Record<string, unknown>;
      const assetId = typeof input.assetId === "string" ? input.assetId : null;
      const relativePath = typeof input.relativePath === "string" ? input.relativePath : null;

      if (!assetId || !relativePath) {
        return null;
      }

      const signals = (input.qualitySignals && typeof input.qualitySignals === "object"
        ? (input.qualitySignals as Record<string, unknown>)
        : {}) as Record<string, unknown>;

      return {
        assetId,
        classification: typeof input.classification === "string" ? input.classification : "unknown",
        confidence: readNumber(input.confidence, 0),
        duplicateConfidence:
          typeof input.duplicateConfidence === "number" && Number.isFinite(input.duplicateConfidence)
            ? input.duplicateConfidence
            : null,
        duplicateGroupId: typeof input.duplicateGroupId === "string" ? input.duplicateGroupId : null,
        fileHash: typeof input.fileHash === "string" ? input.fileHash : null,
        qualityScore: readNumber(input.qualityScore, 0),
        qualitySignals: {
          classificationConfidence: readNumber(signals.classificationConfidence, 0),
          filenameSignal: readNumber(signals.filenameSignal, 0),
          resolution: readNumber(signals.resolution, 0),
          sharpness: readNumber(signals.sharpness, 0),
          transparency: readNumber(signals.transparency, 0)
        },
        reasons: Array.isArray(input.reasons) ? input.reasons.filter((reason): reason is string => typeof reason === "string") : [],
        relativePath,
        reviewPriority: normalizePriority(input.reviewPriority),
        tags: Array.isArray(input.tags) ? input.tags.filter((tag): tag is string => typeof tag === "string") : [],
        visualHash: typeof input.visualHash === "string" ? input.visualHash : ""
      };
    })
    .filter((entry): entry is AuditEntryView => entry !== null);
}

function normalizeDuplicateGroups(raw: unknown[]): AuditDuplicateGroupView[] {
  return raw
    .map((group) => {
      if (!group || typeof group !== "object") {
        return null;
      }

      const input = group as Record<string, unknown>;
      const id = typeof input.id === "string" ? input.id : null;

      if (!id) {
        return null;
      }

      const reasonRaw = input.reason;

      return {
        assetIds: Array.isArray(input.assetIds)
          ? input.assetIds.filter((value): value is string => typeof value === "string")
          : [],
        classificationConflict: Boolean(input.classificationConflict),
        confidence: readNumber(input.confidence, 0),
        id,
        reason: reasonRaw === "file-hash" || reasonRaw === "visual-hash" ? reasonRaw : "visual-hash",
        visualHash: typeof input.visualHash === "string" ? input.visualHash : ""
      };
    })
    .filter((group): group is AuditDuplicateGroupView => group !== null);
}

function normalizeWarnings(raw: unknown[]): AuditWarningView[] {
  const allowed = new Set([
    "classification_conflict",
    "missing_metadata",
    "low_confidence",
    "low_quality"
  ] as const);
  const result: AuditWarningView[] = [];

  for (const warning of raw) {
    if (!warning || typeof warning !== "object") {
      continue;
    }

    const input = warning as Record<string, unknown>;
    const type =
      typeof input.type === "string" && allowed.has(input.type as never) ? (input.type as AuditWarningView["type"]) : null;
    const message = typeof input.message === "string" ? input.message : null;

    if (!type || !message) {
      continue;
    }

    const entry: AuditWarningView = { message, type };

    if (typeof input.assetId === "string") {
      entry.assetId = input.assetId;
    }

    result.push(entry);
  }

  return result;
}

function normalizePriority(value: unknown): AuditReviewPriority {
  if (value === "critical" || value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return "low";
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "ENOENT";
}
