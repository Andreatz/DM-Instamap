import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { computeDocumentContentHash } from "@dm-instamap/core/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDataBackup,
  restoreDataBackup,
  verifyDataBackup
} from "./data-archive";
import { LocalPathValidationError } from "./local-paths";
import { createProject, readProject } from "./projects";

const tempDirs: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { force: true, recursive: true });
    }
  }
});

async function seedProject(workspace: string) {
  return createProject(
    {
      heightCells: 12,
      name: "Backup Roundtrip",
      roomCount: 3,
      theme: "test",
      widthCells: 16
    },
    { outputRoot: workspace }
  );
}

describe("data backup and restore", () => {
  it("round-trips a project identically by content hash", async () => {
    const workspace = tempDir("dm-ws-");
    const backupParent = tempDir("dm-bk-");
    const project = await seedProject(workspace);
    const originalHash = computeDocumentContentHash(project.document);

    const backup = await createDataBackup({
      destination: backupParent,
      outputRoot: workspace
    });
    expect(backup.fileCount).toBeGreaterThan(0);

    // Wipe local project data, then restore from the backup.
    rmSync(path.join(workspace, "data", "projects"), {
      force: true,
      recursive: true
    });

    const result = await restoreDataBackup({
      backupDir: backup.backupDir,
      outputRoot: workspace
    });
    expect(result.restored.length).toBeGreaterThan(0);
    expect(result.conflicts).toEqual([]);

    const restored = await readProject(project.id, { outputRoot: workspace });
    expect(computeDocumentContentHash(restored.document)).toBe(originalHash);
  });

  it("verifies backup integrity and detects tampering", async () => {
    const workspace = tempDir("dm-ws-");
    const backupParent = tempDir("dm-bk-");
    await seedProject(workspace);
    const backup = await createDataBackup({
      destination: backupParent,
      outputRoot: workspace
    });

    const clean = await verifyDataBackup(backup.backupDir);
    expect(clean.ok).toBe(true);

    const [firstFile] = backup.manifest.files;
    expect(firstFile).toBeDefined();
    if (!firstFile) {
      throw new Error("expected at least one backed-up file");
    }
    const tamperTarget = path.join(backup.backupDir, firstFile.path);
    writeFileSync(tamperTarget, "tampered", "utf8");
    const tampered = await verifyDataBackup(backup.backupDir);
    expect(tampered.ok).toBe(false);
    expect(tampered.mismatched.length).toBeGreaterThan(0);
  });

  it("does not write anything in dry-run mode", async () => {
    const workspace = tempDir("dm-ws-");
    const backupParent = tempDir("dm-bk-");
    const project = await seedProject(workspace);
    const backup = await createDataBackup({
      destination: backupParent,
      outputRoot: workspace
    });

    rmSync(path.join(workspace, "data", "projects"), {
      force: true,
      recursive: true
    });

    const result = await restoreDataBackup({
      backupDir: backup.backupDir,
      dryRun: true,
      outputRoot: workspace
    });
    expect(result.restored.length).toBeGreaterThan(0);
    expect(
      existsSync(path.join(workspace, "data", "projects", project.id))
    ).toBe(false);
  });

  it("reports conflicts and does not overwrite without --force", async () => {
    const workspace = tempDir("dm-ws-");
    const backupParent = tempDir("dm-bk-");
    await seedProject(workspace);
    const backup = await createDataBackup({
      destination: backupParent,
      outputRoot: workspace
    });

    // Restore over existing files without force.
    const result = await restoreDataBackup({
      backupDir: backup.backupDir,
      outputRoot: workspace
    });
    expect(result.restored).toEqual([]);
    expect(result.conflicts.length).toBeGreaterThan(0);

    const forced = await restoreDataBackup({
      backupDir: backup.backupDir,
      force: true,
      outputRoot: workspace
    });
    expect(forced.restored.length).toBeGreaterThan(0);
    expect(forced.conflicts).toEqual([]);
  });

  it("rejects a broad or system backup destination", async () => {
    const workspace = tempDir("dm-ws-");
    await seedProject(workspace);

    await expect(
      createDataBackup({ destination: os.homedir(), outputRoot: workspace })
    ).rejects.toBeInstanceOf(LocalPathValidationError);
  });
});
