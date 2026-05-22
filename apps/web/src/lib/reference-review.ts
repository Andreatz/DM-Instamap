import type { ReferenceMapView } from "./references";

export const REFERENCE_REVIEW_MAP_TYPES = [
  "dungeon",
  "city",
  "building",
  "cave",
  "wilderness",
  "ship"
] as const;

export type ReferenceReviewMapType =
  (typeof REFERENCE_REVIEW_MAP_TYPES)[number];

export type ReferenceCorrection = {
  layoutTags: string[];
  mapType: ReferenceReviewMapType;
  notes: string;
  qualityScore: number;
  styleTags: string[];
  themeTags: string[];
};

export type ReferenceOverridesFile = {
  overrides: Record<string, Partial<ReferenceCorrection>>;
};

export type ReferenceReviewDraft = {
  layoutTagsText: string;
  mapType: ReferenceReviewMapType;
  notes: string;
  qualityScore: number;
  styleTagsText: string;
  themeTagsText: string;
};

export function createReferenceReviewDraft(
  reference: ReferenceMapView,
  override?: Partial<ReferenceCorrection>
): ReferenceReviewDraft {
  return {
    layoutTagsText: (override?.layoutTags ?? []).join(", "),
    mapType: normalizeReferenceMapType(override?.mapType ?? reference.mapType),
    notes: override?.notes ?? "",
    qualityScore: clampScore(
      override?.qualityScore ?? Math.round(reference.mapTypeConfidence * 100)
    ),
    styleTagsText: (override?.styleTags ?? []).join(", "),
    themeTagsText: (override?.themeTags ?? reference.tags).join(", ")
  };
}

export function buildReferenceCorrectionFromDraft(
  draft: ReferenceReviewDraft
): ReferenceCorrection {
  return {
    layoutTags: parseCsvList(draft.layoutTagsText),
    mapType: normalizeReferenceMapType(draft.mapType),
    notes: draft.notes.trim(),
    qualityScore: clampScore(draft.qualityScore),
    styleTags: parseCsvList(draft.styleTagsText),
    themeTags: parseCsvList(draft.themeTagsText)
  };
}

export function filterReferenceReviewQueue(
  references: ReferenceMapView[],
  filters: {
    lowConfidenceOnly: boolean;
    unknownOnly: boolean;
  },
  threshold = 0.5
): ReferenceMapView[] {
  return references.filter((reference) => {
    if (filters.unknownOnly && reference.mapType !== "unknown") {
      return false;
    }

    if (filters.lowConfidenceOnly && reference.mapTypeConfidence > threshold) {
      return false;
    }

    return true;
  });
}

export function findReferenceOverride(
  overrides: ReferenceOverridesFile,
  reference: ReferenceMapView
): Partial<ReferenceCorrection> | undefined {
  return (
    overrides.overrides[reference.id] ?? overrides.overrides[reference.path]
  );
}

export function mergeReferenceOverride(
  existing: ReferenceOverridesFile,
  reference: Pick<ReferenceMapView, "id" | "path">,
  correction: ReferenceCorrection
): ReferenceOverridesFile {
  const overrides = { ...existing.overrides };
  delete overrides[reference.path];
  overrides[reference.id] = correction;

  return { overrides };
}

export function normalizeReferenceOverridesFile(
  input: unknown
): ReferenceOverridesFile {
  if (!input || typeof input !== "object") {
    return { overrides: {} };
  }

  const candidate = input as { overrides?: unknown };
  const rawOverrides =
    candidate.overrides && typeof candidate.overrides === "object"
      ? candidate.overrides
      : {};
  const overrides: ReferenceOverridesFile["overrides"] = {};

  for (const [key, value] of Object.entries(
    rawOverrides as Record<string, unknown>
  )) {
    const correction = normalizeCorrection(value);

    if (correction) {
      overrides[key] = correction;
    }
  }

  return { overrides };
}

export function parseCsvList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ];
}

export function formatReferenceMapType(mapType: string): string {
  switch (mapType) {
    case "dungeon":
      return "dungeon";
    case "city":
      return "citta";
    case "building":
      return "edificio";
    case "cave":
      return "grotta";
    case "wilderness":
      return "selvaggio";
    case "ship":
      return "nave";
    case "unknown":
      return "sconosciuto";
    default:
      return mapType;
  }
}

function normalizeCorrection(
  value: unknown
): Partial<ReferenceCorrection> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const input = value as {
    layoutTags?: unknown;
    mapType?: unknown;
    notes?: unknown;
    qualityScore?: unknown;
    styleTags?: unknown;
    themeTags?: unknown;
  };
  const correction: Partial<ReferenceCorrection> = {};

  if (typeof input.mapType === "string") {
    correction.mapType = normalizeReferenceMapType(input.mapType);
  }

  if (Array.isArray(input.themeTags)) {
    correction.themeTags = input.themeTags.filter(
      (tag): tag is string => typeof tag === "string"
    );
  }

  if (Array.isArray(input.styleTags)) {
    correction.styleTags = input.styleTags.filter(
      (tag): tag is string => typeof tag === "string"
    );
  }

  if (Array.isArray(input.layoutTags)) {
    correction.layoutTags = input.layoutTags.filter(
      (tag): tag is string => typeof tag === "string"
    );
  }

  if (
    typeof input.qualityScore === "number" &&
    Number.isFinite(input.qualityScore)
  ) {
    correction.qualityScore = clampScore(input.qualityScore);
  }

  if (typeof input.notes === "string") {
    correction.notes = input.notes;
  }

  return Object.keys(correction).length > 0 ? correction : null;
}

function normalizeReferenceMapType(value: string): ReferenceReviewMapType {
  if (REFERENCE_REVIEW_MAP_TYPES.includes(value as ReferenceReviewMapType)) {
    return value as ReferenceReviewMapType;
  }

  return "dungeon";
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}
