/**
 * Permissive parser for Dungeondraft `.dungeondraft_tags` files.
 *
 * Dungeondraft writes mostly-standard JSON, but exports occasionally contain
 * trailing commas and stray whitespace that break a strict `JSON.parse`. The
 * parser here first tries strict parsing and only falls back to a tolerant
 * pass when that fails, so well-formed files stay on the fast path.
 */

export type DungeondraftTagsFile = {
  /** sourceTag (e.g. ".Table") -> list of asset paths. */
  tags: Record<string, string[]>;
  /** Named tag sets, when present. Preserved for completeness. */
  sets?: Record<string, string[]>;
};

export type ImportedTags = {
  /** Relative paths of every `.dungeondraft_tags` file that was merged in. */
  sourceFiles: string[];
  /** sourceTag -> deduped, sorted asset paths. */
  tags: Record<string, string[]>;
  /** asset path -> the original sourceTags that referenced it. */
  assets: Record<string, { sourceTags: string[] }>;
  stats: {
    sourceFiles: number;
    sourceTags: number;
    uniqueAssetPaths: number;
    dedupedAssociations: number;
    parseErrors: Array<{ file: string; message: string }>;
  };
};

/**
 * Parse the textual content of a single `.dungeondraft_tags` file. Tolerates
 * trailing commas. Throws only when the content cannot be recovered into JSON.
 */
export function parseDungeondraftTags(content: string): DungeondraftTagsFile {
  const parsed = parsePermissiveJson(content);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Tag file did not contain a JSON object.");
  }

  const root = parsed as Record<string, unknown>;
  const tags = normalizeTagMap(root.tags);
  const sets = root.sets ? normalizeTagMap(root.sets) : undefined;

  return sets ? { tags, sets } : { tags };
}

function normalizeTagMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const result: Record<string, string[]> = {};

  for (const [tag, paths] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(paths)) {
      continue;
    }

    const cleaned = paths
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (cleaned.length > 0) {
      result[tag] = cleaned;
    }
  }

  return result;
}

function parsePermissiveJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return JSON.parse(stripTrailingCommas(content));
  }
}

/**
 * Remove trailing commas that appear before a closing brace/bracket. We only
 * touch commas immediately followed by `}` or `]` (ignoring whitespace), which
 * is the shape Dungeondraft emits; asset paths never end with whitespace plus a
 * closing bracket, so legitimate string content is left untouched.
 */
function stripTrailingCommas(content: string): string {
  return content.replace(/,(\s*[}\]])/gu, "$1");
}

/**
 * Merge one parsed tag file into an accumulator, deduplicating by
 * `sourceTag + path` and preserving the original sourceTags per asset.
 */
export function createImportedTagsAccumulator(): ImportedTags {
  return {
    sourceFiles: [],
    tags: {},
    assets: {},
    stats: {
      sourceFiles: 0,
      sourceTags: 0,
      uniqueAssetPaths: 0,
      dedupedAssociations: 0,
      parseErrors: []
    }
  };
}

export function mergeTagFileIntoImport(
  accumulator: ImportedTags,
  sourceFile: string,
  file: DungeondraftTagsFile
): void {
  if (!accumulator.sourceFiles.includes(sourceFile)) {
    accumulator.sourceFiles.push(sourceFile);
  }

  for (const [tag, paths] of Object.entries(file.tags)) {
    accumulator.tags[tag] ??= [];
    const tagBucket = accumulator.tags[tag]!;
    const tagSeen = new Set(tagBucket);

    for (const rawPath of paths) {
      const path = normalizePath(rawPath);

      if (!tagSeen.has(path)) {
        tagSeen.add(path);
        tagBucket.push(path);
      }

      accumulator.assets[path] ??= { sourceTags: [] };
      const assetEntry = accumulator.assets[path]!;

      if (!assetEntry.sourceTags.includes(tag)) {
        assetEntry.sourceTags.push(tag);
      }
    }
  }
}

export function finalizeImportedTags(accumulator: ImportedTags): ImportedTags {
  let dedupedAssociations = 0;

  for (const tag of Object.keys(accumulator.tags)) {
    const sorted = [...new Set(accumulator.tags[tag])].sort((a, b) =>
      a.localeCompare(b)
    );
    accumulator.tags[tag] = sorted;
    dedupedAssociations += sorted.length;
  }

  for (const path of Object.keys(accumulator.assets)) {
    accumulator.assets[path]!.sourceTags = [
      ...new Set(accumulator.assets[path]!.sourceTags)
    ].sort((a, b) => a.localeCompare(b));
  }

  accumulator.sourceFiles.sort((a, b) => a.localeCompare(b));
  accumulator.stats = {
    sourceFiles: accumulator.sourceFiles.length,
    sourceTags: Object.keys(accumulator.tags).length,
    uniqueAssetPaths: Object.keys(accumulator.assets).length,
    dedupedAssociations,
    parseErrors: accumulator.stats.parseErrors
  };

  return accumulator;
}

function normalizePath(value: string): string {
  return value.trim().replaceAll("\\", "/");
}
