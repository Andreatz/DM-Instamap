/**
 * Hydration budget for the editor.
 *
 * The project editor receives the matched asset groups as serialized props that
 * Next.js then hydrates on the client. With a very large library this payload
 * (and the work to revive it) grows unbounded, so we cap how many groups are
 * shipped to the editor. Keeping the cap and the slicing logic here makes the
 * budget an explicit, testable contract instead of a magic number buried in the
 * page component.
 */

/** Maximum number of asset groups hydrated into the editor at once. */
export const EDITOR_ASSET_GROUP_LIMIT = 500;

export type HydrationBudgetResult<T> = {
  /** Groups actually hydrated into the editor (length <= limit). */
  groups: T[];
  /** Whether the source list was truncated to fit the budget. */
  truncated: boolean;
  /** Number of groups dropped because they exceeded the budget. */
  omitted: number;
};

/**
 * Trim a list of asset groups down to the hydration budget. Returns the kept
 * slice plus enough metadata for the caller to surface an honest "showing N of
 * M" message instead of silently hiding data.
 */
export function limitAssetGroupsForHydration<T>(
  groups: readonly T[],
  limit: number = EDITOR_ASSET_GROUP_LIMIT
): HydrationBudgetResult<T> {
  const safeLimit = Math.max(0, Math.floor(limit));
  const kept = groups.slice(0, safeLimit);

  return {
    groups: kept,
    omitted: Math.max(0, groups.length - kept.length),
    truncated: groups.length > kept.length
  };
}
