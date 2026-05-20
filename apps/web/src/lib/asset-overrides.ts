import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  mergeAssetOverride,
  normalizeOverridesFile,
  type AssetCorrection,
  type AssetOverridesFile
} from "./asset-review";
import { findWorkspaceRoot } from "./assets-manifest";
import { parseJsonFileContent } from "./json-file";

export async function loadAssetOverrides(): Promise<AssetOverridesFile> {
  const overridesPath = await getAssetOverridesPath();

  try {
    const raw = await readFile(overridesPath, "utf8");
    return normalizeOverridesFile(parseJsonFileContent(raw));
  } catch (error) {
    if (isMissingFileError(error)) {
      return { overrides: {} };
    }

    throw error;
  }
}

export async function saveAssetOverride(input: {
  assetId: string;
  correction: AssetCorrection;
  relativePath: string;
}): Promise<AssetOverridesFile> {
  const overridesPath = await getAssetOverridesPath();
  const current = await loadAssetOverrides();
  const next = mergeAssetOverride(
    current,
    {
      id: input.assetId,
      relativePath: input.relativePath
    },
    input.correction
  );

  await mkdir(path.dirname(overridesPath), { recursive: true });
  await writeFile(overridesPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  return next;
}

export async function saveAssetOverrides(
  corrections: Array<{
    assetId: string;
    correction: AssetCorrection;
    relativePath: string;
  }>
): Promise<AssetOverridesFile> {
  const overridesPath = await getAssetOverridesPath();
  let next = await loadAssetOverrides();

  for (const input of corrections) {
    next = mergeAssetOverride(
      next,
      {
        id: input.assetId,
        relativePath: input.relativePath
      },
      input.correction
    );
  }

  await mkdir(path.dirname(overridesPath), { recursive: true });
  await writeFile(overridesPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  return next;
}

async function getAssetOverridesPath(): Promise<string> {
  const workspaceRoot = await findWorkspaceRoot(process.cwd());
  return path.join(workspaceRoot, "data", "indexes", "asset-overrides.json");
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
