import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { findWorkspaceRoot } from "./assets-manifest";
import { parseJsonFileContent } from "./json-file";
import {
  mergeReferenceOverride,
  normalizeReferenceOverridesFile,
  type ReferenceCorrection,
  type ReferenceOverridesFile
} from "./reference-review";

export async function loadReferenceOverrides(): Promise<ReferenceOverridesFile> {
  const overridesPath = await getReferenceOverridesPath();

  try {
    const raw = await readFile(overridesPath, "utf8");
    return normalizeReferenceOverridesFile(parseJsonFileContent(raw));
  } catch (error) {
    if (isMissingFileError(error)) {
      return { overrides: {} };
    }

    throw error;
  }
}

export async function saveReferenceOverride(input: {
  correction: ReferenceCorrection;
  referenceId: string;
  referencePath: string;
}): Promise<ReferenceOverridesFile> {
  const overridesPath = await getReferenceOverridesPath();
  const current = await loadReferenceOverrides();
  const next = mergeReferenceOverride(
    current,
    {
      id: input.referenceId,
      path: input.referencePath
    },
    input.correction
  );

  await mkdir(path.dirname(overridesPath), { recursive: true });
  await writeFile(overridesPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  return next;
}

async function getReferenceOverridesPath(): Promise<string> {
  const workspaceRoot = await findWorkspaceRoot(process.cwd());
  return path.join(workspaceRoot, "data", "indexes", "reference-overrides.json");
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
