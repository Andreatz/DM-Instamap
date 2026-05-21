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
  const resolved = inputIsAbsolute ? path.resolve(raw) : path.resolve(workspaceRoot, raw);
  const insideWorkspace = isPathInside(resolved, workspaceRoot);

  if (!inputIsAbsolute && !insideWorkspace) {
    throw new LocalPathValidationError(`${label} must stay inside the DM-Instamap workspace.`);
  }

  if (inputIsAbsolute && !insideWorkspace && !options.allowAbsoluteOutsideWorkspace) {
    throw new LocalPathValidationError(`${label} must stay inside the DM-Instamap workspace.`);
  }

  if (isBroadOrSystemPath(resolved)) {
    throw new LocalPathValidationError(`${label} points to a broad or system folder. Choose a specific local asset/reference folder.`);
  }

  if (options.mustExist && !existsSync(resolved)) {
    throw new LocalPathValidationError(`${label} does not exist: ${options.inputPath}`);
  }

  return resolved;
}

export function isPathInside(targetPath: string, rootPath: string): boolean {
  const relative = path.relative(path.resolve(rootPath), path.resolve(targetPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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
    return parts.includes("windows") || parts.includes("program files") || parts.includes("program files (x86)");
  }

  const systemPrefixes = ["/bin", "/boot", "/dev", "/etc", "/proc", "/sbin", "/sys"].map((prefix) =>
    path.resolve(prefix)
  );
  return systemPrefixes.some((prefix) => resolved === prefix || isPathInside(resolved, prefix));
}
