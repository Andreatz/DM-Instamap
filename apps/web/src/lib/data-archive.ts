import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { findWorkspaceRoot } from "./assets-manifest";
import {
  LocalPathValidationError,
  resolveWithinWorkspace,
  validateLocalPath
} from "./local-paths";

export const BACKUP_VERSION = 1;
export const BACKUP_MANIFEST_FILE = "backup-manifest.json";
const DATA_DIRECTORY = "data";
const REQUIRED_SECTIONS = ["projects", "campaigns"] as const;
const OPTIONAL_SECTIONS = ["indexes"] as const;

export type BackupFileEntry = {
  bytes: number;
  path: string;
  sha256: string;
};

export type BackupManifest = {
  createdAt: string;
  files: BackupFileEntry[];
  sections: string[];
  version: number;
};

export type CreateBackupOptions = {
  destination: string;
  includeIndexes?: boolean;
  now?: Date;
  outputRoot?: string;
};

export type CreateBackupResult = {
  backupDir: string;
  fileCount: number;
  manifest: BackupManifest;
};

export type RestoreBackupOptions = {
  backupDir: string;
  dryRun?: boolean;
  force?: boolean;
  outputRoot?: string;
};

export type RestoreBackupResult = {
  conflicts: string[];
  dryRun: boolean;
  missing: string[];
  restored: string[];
};

async function resolveWorkspaceRoot(outputRoot?: string): Promise<string> {
  return outputRoot
    ? path.resolve(outputRoot)
    : await findWorkspaceRoot(process.cwd());
}

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function listFilesRecursive(
  root: string,
  relativeBase = ""
): Promise<string[]> {
  const entries = await readdir(path.join(root, relativeBase), {
    withFileTypes: true
  });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = relativeBase
      ? `${relativeBase}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(root, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

function backupName(now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/gu, "-").slice(0, 19);
  return `dm-instamap-backup-${stamp}`;
}

/**
 * Crea un backup versionato di data/projects, data/campaigns (e opzionalmente
 * data/indexes) in una cartella con manifest e checksum sha256 per file.
 */
export async function createDataBackup(
  options: CreateBackupOptions
): Promise<CreateBackupResult> {
  const workspaceRoot = await resolveWorkspaceRoot(options.outputRoot);
  const dataRoot = path.join(workspaceRoot, DATA_DIRECTORY);
  const destinationRoot = validateLocalPath({
    allowAbsoluteOutsideWorkspace: true,
    inputPath: options.destination,
    label: "destination",
    workspaceRoot
  });
  const now = options.now ?? new Date();
  const backupDir = path.join(destinationRoot, backupName(now));
  const sections = [
    ...REQUIRED_SECTIONS,
    ...(options.includeIndexes ? OPTIONAL_SECTIONS : [])
  ];
  const files: BackupFileEntry[] = [];

  for (const section of sections) {
    const sectionRoot = path.join(dataRoot, section);

    if (!existsSync(sectionRoot)) {
      continue;
    }

    const sectionFiles = await listFilesRecursive(sectionRoot);

    for (const relativePath of sectionFiles.sort()) {
      const sourcePath = path.join(sectionRoot, relativePath);
      const archivePath = `${section}/${relativePath}`;
      const targetPath = path.join(backupDir, archivePath);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
      const buffer = await readFile(sourcePath);
      files.push({
        bytes: buffer.byteLength,
        path: archivePath,
        sha256: createHash("sha256").update(buffer).digest("hex")
      });
    }
  }

  const manifest: BackupManifest = {
    createdAt: now.toISOString(),
    files,
    sections: [...sections],
    version: BACKUP_VERSION
  };
  await mkdir(backupDir, { recursive: true });
  await writeFile(
    path.join(backupDir, BACKUP_MANIFEST_FILE),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  return { backupDir, fileCount: files.length, manifest };
}

async function readBackupManifest(backupDir: string): Promise<BackupManifest> {
  const manifestPath = path.join(backupDir, BACKUP_MANIFEST_FILE);

  if (!existsSync(manifestPath)) {
    throw new LocalPathValidationError(
      `Backup manifest not found in ${backupDir}.`
    );
  }

  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8")
  ) as BackupManifest;

  if (manifest.version !== BACKUP_VERSION) {
    throw new LocalPathValidationError(
      `Unsupported backup version: ${manifest.version}.`
    );
  }

  return manifest;
}

/**
 * Verifica integrita del backup: file mancanti o checksum non corrispondenti.
 */
export async function verifyDataBackup(backupDir: string): Promise<{
  manifest: BackupManifest;
  mismatched: string[];
  missing: string[];
  ok: boolean;
}> {
  const resolvedBackup = validateLocalPath({
    allowAbsoluteOutsideWorkspace: true,
    inputPath: backupDir,
    label: "backupDir",
    mustExist: true,
    workspaceRoot: process.cwd()
  });
  const manifest = await readBackupManifest(resolvedBackup);
  const missing: string[] = [];
  const mismatched: string[] = [];

  for (const entry of manifest.files) {
    const filePath = resolveWithinWorkspace(resolvedBackup, entry.path);

    if (!existsSync(filePath)) {
      missing.push(entry.path);
      continue;
    }

    if ((await sha256(filePath)) !== entry.sha256) {
      mismatched.push(entry.path);
    }
  }

  return {
    manifest,
    mismatched,
    missing,
    ok: missing.length === 0 && mismatched.length === 0
  };
}

/**
 * Ripristina un backup verificato sotto data/. In --dry-run non scrive nulla;
 * senza --force non sovrascrive file esistenti (li riporta come conflitti).
 */
export async function restoreDataBackup(
  options: RestoreBackupOptions
): Promise<RestoreBackupResult> {
  const workspaceRoot = await resolveWorkspaceRoot(options.outputRoot);
  const dataRoot = path.join(workspaceRoot, DATA_DIRECTORY);
  const resolvedBackup = validateLocalPath({
    allowAbsoluteOutsideWorkspace: true,
    inputPath: options.backupDir,
    label: "backupDir",
    mustExist: true,
    workspaceRoot
  });
  const verification = await verifyDataBackup(resolvedBackup);

  if (!verification.ok) {
    throw new LocalPathValidationError(
      `Backup integrity check failed (missing: ${verification.missing.length}, mismatched: ${verification.mismatched.length}). Restore aborted.`
    );
  }

  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const restored: string[] = [];
  const conflicts: string[] = [];

  for (const entry of verification.manifest.files) {
    const sourcePath = resolveWithinWorkspace(resolvedBackup, entry.path);
    const targetPath = resolveWithinWorkspace(dataRoot, entry.path);

    if (existsSync(targetPath) && !force) {
      conflicts.push(entry.path);
      continue;
    }

    if (!dryRun) {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }

    restored.push(entry.path);
  }

  return {
    conflicts,
    dryRun,
    missing: verification.missing,
    restored
  };
}
