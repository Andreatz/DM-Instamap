import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export type ValidateLocalPathOptions = {
  allowAbsoluteOutsideWorkspace?: boolean;
  inputPath: string;
  label?: string;
  mustExist?: boolean;
  workspaceRoot: string;
};

export class LocalPathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalPathValidationError";
  }
}

export function validateLocalPath(options: ValidateLocalPathOptions): string {
  const label = options.label ?? "Path";
  const raw = options.inputPath.trim();

  if (!raw) {
    throw new LocalPathValidationError(`${label} is required.`);
  }

  const workspaceRoot = path.resolve(options.workspaceRoot);
  const inputIsAbsolute = path.isAbsolute(raw);
  const resolved = inputIsAbsolute
    ? path.resolve(raw)
    : path.resolve(workspaceRoot, raw);
  const insideWorkspace = isPathInside(resolved, workspaceRoot);

  if (!inputIsAbsolute && !insideWorkspace) {
    throw new LocalPathValidationError(
      `${label} must stay inside the DM-Instamap workspace.`
    );
  }

  if (
    inputIsAbsolute &&
    !insideWorkspace &&
    !options.allowAbsoluteOutsideWorkspace
  ) {
    throw new LocalPathValidationError(
      `${label} must stay inside the DM-Instamap workspace.`
    );
  }

  if (isBroadOrSystemPath(resolved)) {
    throw new LocalPathValidationError(
      `${label} points to a broad or system folder. Choose a specific local asset/reference folder.`
    );
  }

  if (options.mustExist && !existsSync(resolved)) {
    throw new LocalPathValidationError(
      `${label} does not exist: ${options.inputPath}`
    );
  }

  return resolved;
}

/**
 * Shared policy for workspace-relative identifiers (project ids, campaign ids,
 * asset/reference ids used as path segments). Rejects anything that could break
 * out of a single path segment: separators, parent-dir traversal, leading dots,
 * null bytes. Domain validators (project/campaign slugs) layer stricter rules
 * on top of this guarantee.
 */
const SAFE_WORKSPACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

export function assertSafeWorkspaceId(id: string, label = "id"): string {
  if (
    typeof id !== "string" ||
    !SAFE_WORKSPACE_ID_PATTERN.test(id) ||
    id.includes("..")
  ) {
    throw new LocalPathValidationError(`${label} has an unsafe value: ${id}`);
  }

  return id;
}

/**
 * Joins trusted path segments under a workspace root and guarantees the result
 * stays inside it. Defense in depth for internal paths built from ids/manifest
 * values: even if a segment contained traversal, the resolved path cannot
 * escape the workspace.
 */
export function resolveWithinWorkspace(
  workspaceRoot: string,
  ...segments: string[]
): string {
  const root = path.resolve(workspaceRoot);
  const resolved = path.resolve(root, ...segments);

  if (!isPathInside(resolved, root)) {
    throw new LocalPathValidationError(
      `Resolved path escapes the workspace: ${resolved}`
    );
  }

  return resolved;
}

export function isPathInside(targetPath: string, rootPath: string): boolean {
  const relative = path.relative(
    path.resolve(rootPath),
    path.resolve(targetPath)
  );
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function isBroadOrSystemPath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const parsed = path.parse(resolved);
  const home = path.resolve(os.homedir());

  if (resolved === parsed.root || resolved === home) {
    return true;
  }

  if (process.platform === "win32") {
    const parts = resolved.toLowerCase().split(/[\\/]+/u);
    return (
      parts.includes("windows") ||
      parts.includes("program files") ||
      parts.includes("program files (x86)")
    );
  }

  const systemPrefixes = [
    "/bin",
    "/boot",
    "/dev",
    "/etc",
    "/proc",
    "/sbin",
    "/sys"
  ].map((prefix) => path.resolve(prefix));
  return systemPrefixes.some(
    (prefix) => resolved === prefix || isPathInside(resolved, prefix)
  );
}
