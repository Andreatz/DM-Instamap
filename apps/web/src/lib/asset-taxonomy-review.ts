import type { AssetOverrideEntry } from "@dm-instamap/assets/taxonomy";

/**
 * Streamlined review of the semantic taxonomy groups. Reviewers approve a
 * group, change its status, or correct its classification
 * (macroCategory / assetGroups / themeTags). Each action is translated into
 * asset-level override entries (keyed by path) that the pipeline applies on the
 * next `pnpm assets:manifest`. Split/merge/remove from the old folder-based
 * review do not apply: groups here are derived from classification, so you fix
 * the classification instead.
 */

export const REVIEW_STATUSES = [
  "approved",
  "needs-review",
  "quarantine",
  "rejected"
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export type TaxonomyReviewAction =
  | { type: "confirm"; groupId: string }
  | { type: "set-status"; groupId: string; status: ReviewStatus }
  | {
      type: "correct";
      groupId: string;
      macroCategory?: string;
      assetGroups?: string[];
      themeTags?: string[];
      status?: ReviewStatus;
    };

/** Minimal asset view needed to compute review overrides. */
export type ReviewMember = {
  path: string;
  status: string;
  macroCategory: string;
  assetGroups: string[];
  themeTags: string[];
};

export type ReviewOverrideEntry = {
  path: string;
  entry: AssetOverrideEntry;
};

/** The semantic group an asset belongs to: `macroCategory / firstAssetGroup`. */
export function memberGroupId(member: {
  macroCategory: string;
  assetGroups: string[];
}): string {
  const assetGroup = member.assetGroups[0] ?? member.macroCategory;
  return `${member.macroCategory}/${assetGroup}`;
}

/**
 * Translate a review action into the per-path override entries to persist.
 * Entries that would not change the current value are skipped, so confirming an
 * already-approved group writes nothing.
 */
export function buildReviewOverrideEntries(
  members: ReviewMember[],
  action: TaxonomyReviewAction
): ReviewOverrideEntry[] {
  if (action.type === "confirm") {
    return members
      .filter((member) => member.status !== "approved")
      .map((member) => ({ entry: { status: "approved" }, path: member.path }));
  }

  if (action.type === "set-status") {
    return members
      .filter((member) => member.status !== action.status)
      .map((member) => ({
        entry: { status: action.status },
        path: member.path
      }));
  }

  // correct
  return members
    .map((member) => {
      const entry = buildCorrectionEntry(member, action);
      return entry ? { entry, path: member.path } : null;
    })
    .filter((value): value is ReviewOverrideEntry => value !== null);
}

function buildCorrectionEntry(
  member: ReviewMember,
  action: Extract<TaxonomyReviewAction, { type: "correct" }>
): AssetOverrideEntry | null {
  const entry: AssetOverrideEntry = {};

  if (action.macroCategory && action.macroCategory !== member.macroCategory) {
    entry.macroCategory =
      action.macroCategory as AssetOverrideEntry["macroCategory"];
  }
  if (
    action.assetGroups &&
    !arraysEqual(action.assetGroups, member.assetGroups)
  ) {
    entry.assetGroups = action.assetGroups;
  }
  if (action.themeTags && !arraysEqual(action.themeTags, member.themeTags)) {
    entry.themeTags = action.themeTags;
  }
  if (action.status && action.status !== member.status) {
    entry.status = action.status;
  }

  return Object.keys(entry).length > 0 ? entry : null;
}

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return (
    typeof value === "string" &&
    (REVIEW_STATUSES as readonly string[]).includes(value)
  );
}

export function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}
