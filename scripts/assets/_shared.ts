/**
 * Shared helpers for the asset-taxonomy pipeline CLIs (scripts/assets/*.ts).
 * These scripts run from the repository root via `tsx` and import the taxonomy
 * core from `packages/assets/src/taxonomy` by relative path.
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

/** Default roots that may contain Dungeondraft packs / asset files. */
export const ASSET_ROOTS = ["local-assets", "assets", "data/raw-assets"];

export function resolveRepoPath(relativePath: string): string {
  return path.resolve(REPO_ROOT, relativePath);
}

export async function loadJson<T>(relativePath: string): Promise<T> {
  const raw = await readFile(resolveRepoPath(relativePath), "utf8");
  return JSON.parse(raw) as T;
}

export async function tryLoadJson<T>(relativePath: string): Promise<T | null> {
  try {
    return await loadJson<T>(relativePath);
  } catch {
    return null;
  }
}

export async function saveJson(
  relativePath: string,
  data: unknown,
  options: { pretty?: boolean } = {}
): Promise<void> {
  const absolute = resolveRepoPath(relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  const serialized = options.pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
  await writeFile(absolute, `${serialized}\n`, "utf8");
}

export async function saveText(
  relativePath: string,
  text: string
): Promise<void> {
  const absolute = resolveRepoPath(relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, text, "utf8");
}

/** Recursively collect files under `root` matching the predicate. */
export async function walkFiles(
  root: string,
  match: (fileName: string, fullPath: string) => boolean
): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: Awaited<ReturnType<typeof readdir>>;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) {
          continue;
        }
        await walk(full);
      } else if (entry.isFile() && match(entry.name, full)) {
        results.push(full);
      }
    }
  }

  await walk(root);
  return results.sort((a, b) => a.localeCompare(b));
}

/**
 * Resolve CLI patterns (file paths, directories, or simple globs) into a list
 * of `.dungeondraft_tags` files. Globs are reduced to their literal prefix dir
 * and walked recursively for the extension.
 */
export async function resolveTagFiles(patterns: string[]): Promise<string[]> {
  const roots = patterns.length > 0 ? patterns : ASSET_ROOTS;
  const found = new Set<string>();

  for (const pattern of roots) {
    const literalPrefix = pattern.split(/[*?[]/u)[0] ?? pattern;
    const base = path.isAbsolute(literalPrefix)
      ? literalPrefix
      : resolveRepoPath(literalPrefix);

    if (pattern.endsWith(".dungeondraft_tags") && !/[*?[]/u.test(pattern)) {
      found.add(base);
      continue;
    }

    const dir = /[*?[]/u.test(pattern) ? path.dirname(base) : base;
    const matches = await walkFiles(dir, (name) =>
      name.endsWith(".dungeondraft_tags")
    );
    for (const match of matches) {
      found.add(match);
    }
  }

  return [...found].sort((a, b) => a.localeCompare(b));
}

/**
 * Build an index from a normalized asset path suffix (e.g. "textures/...") to
 * the first absolute file found on disk. Used by metadata enrichment and
 * contact sheets to locate real files without pack info in the manifest path.
 */
export async function buildAssetFileIndex(
  roots: string[] = ASSET_ROOTS
): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  const imageExtensions = new Set([
    ".png",
    ".webp",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp"
  ]);

  for (const root of roots) {
    const absRoot = resolveRepoPath(root);
    const files = await walkFiles(absRoot, (name) =>
      imageExtensions.has(path.extname(name).toLowerCase())
    );

    for (const file of files) {
      const normalized = file.replaceAll("\\", "/");
      const key = normalizeAssetKey(normalized);
      if (key && !index.has(key)) {
        index.set(key, file);
      }
      // Also index by bare filename as a fallback lookup.
      const base = path.basename(normalized).toLowerCase();
      const fallbackKey = `@name:${base}`;
      if (!index.has(fallbackKey)) {
        index.set(fallbackKey, file);
      }
    }
  }

  return index;
}

export function lookupAssetFile(
  index: Map<string, string>,
  assetPath: string
): string | null {
  const normalized = assetPath.replaceAll("\\", "/");
  const key = normalizeAssetKey(normalized);
  if (key && index.has(key)) {
    return index.get(key) ?? null;
  }
  const base = path.basename(normalized).toLowerCase();
  return index.get(`@name:${base}`) ?? null;
}

function normalizeAssetKey(value: string): string {
  const lower = value.toLowerCase();
  const texturesAt = lower.indexOf("textures/");
  if (texturesAt >= 0) {
    return lower.slice(texturesAt);
  }
  return lower;
}

export type CliArgs = {
  positionals: string[];
  flags: Record<string, string | boolean>;
};

export function parseCliArgs(argv: string[]): CliArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (key.includes("=")) {
        const [name, value] = key.split("=");
        flags[name!] = value ?? true;
      } else if (next && !next.startsWith("--")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }

  return { positionals, flags };
}

export function logLine(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function failWith(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
