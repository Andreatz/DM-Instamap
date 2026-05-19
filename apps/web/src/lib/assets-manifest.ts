import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeManifestAssets, type AssetBrowserEntry } from "./asset-browser";
import { parseJsonFileContent } from "./json-file";

type AssetManifestFile = {
  assets?: unknown;
  generatedAt?: unknown;
  sourceRoot?: unknown;
};

export type LoadedAssetManifest = {
  assets: AssetBrowserEntry[];
  generatedAt: string | null;
  manifestPath: string;
  missing: boolean;
  sourceRoot: string | null;
};

export async function loadAssetManifest(): Promise<LoadedAssetManifest> {
  const workspaceRoot = await findWorkspaceRoot(process.cwd());
  const manifestPath = path.join(workspaceRoot, "data", "indexes", "assets.manifest.json");

  try {
    const raw = await readFile(manifestPath, "utf8");
    const manifest = parseJsonFileContent(raw) as AssetManifestFile;
    const assets = Array.isArray(manifest.assets) ? normalizeManifestAssets(manifest.assets) : [];

    return {
      assets,
      generatedAt: typeof manifest.generatedAt === "string" ? manifest.generatedAt : null,
      manifestPath,
      missing: false,
      sourceRoot: typeof manifest.sourceRoot === "string" ? manifest.sourceRoot : null
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        assets: [],
        generatedAt: null,
        manifestPath,
        missing: true,
        sourceRoot: null
      };
    }

    throw error;
  }
}

export async function findWorkspaceRoot(start: string): Promise<string> {
  let current = path.resolve(start);

  while (true) {
    try {
      await readFile(path.join(current, "pnpm-workspace.yaml"), "utf8");
      return current;
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return path.resolve(start);
    }

    current = parent;
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
