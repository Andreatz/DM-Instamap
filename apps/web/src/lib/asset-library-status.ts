export type AssetLibraryStatusInput = {
  audit: {
    assetCount: number;
    classificationWarnings: unknown[];
    duplicateGroupCount: number;
    generatedAt: string | null;
    lowQualityCount: number;
    missing: boolean;
    needsReviewCount: number;
  };
  groupCount: number;
  manifest: {
    assetCount: number;
    generatedAt: string | null;
    missing: boolean;
  };
};

export type AssetLibraryStatusTone = "empty" | "warning" | "ready";

export type AssetLibraryStatus = {
  assetCount: number;
  duplicateGroupCount: number;
  groupCount: number;
  headline: string;
  issueCount: number;
  lastScan: string | null;
  lowQualityCount: number;
  needsReviewCount: number;
  ready: boolean;
  tone: AssetLibraryStatusTone;
};

/**
 * Folds the manifest, group index and audit reports into a single, display
 * friendly status. Pure so the home and library pages stay consistent.
 */
export function summarizeAssetLibrary(
  input: AssetLibraryStatusInput
): AssetLibraryStatus {
  const assetCount = Math.max(
    input.manifest.assetCount,
    input.audit.assetCount
  );
  const duplicateGroupCount = input.audit.duplicateGroupCount;
  const needsReviewCount = input.audit.needsReviewCount;
  const lowQualityCount = input.audit.lowQualityCount;
  const issueCount =
    duplicateGroupCount +
    needsReviewCount +
    lowQualityCount +
    input.audit.classificationWarnings.length;
  const lastScan = input.audit.generatedAt ?? input.manifest.generatedAt;
  const empty =
    assetCount === 0 || (input.manifest.missing && input.audit.missing);

  const tone: AssetLibraryStatusTone = empty
    ? "empty"
    : issueCount > 0
      ? "warning"
      : "ready";
  const ready = tone === "ready";

  return {
    assetCount,
    duplicateGroupCount,
    groupCount: input.groupCount,
    headline: buildHeadline({
      assetCount,
      empty,
      groupCount: input.groupCount,
      issueCount
    }),
    issueCount,
    lastScan,
    lowQualityCount,
    needsReviewCount,
    ready,
    tone
  };
}

function buildHeadline(input: {
  assetCount: number;
  empty: boolean;
  groupCount: number;
  issueCount: number;
}): string {
  if (input.empty) {
    return "Nessun asset indicizzato: avvia una scansione per iniziare.";
  }

  const base = `${input.assetCount} asset in ${input.groupCount} gruppi`;

  if (input.issueCount === 0) {
    return `${base}, libreria in ordine.`;
  }

  return `${base}, ${input.issueCount} elementi da rivedere.`;
}
