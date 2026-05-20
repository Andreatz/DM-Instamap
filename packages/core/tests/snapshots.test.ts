import { mkdtemp, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeDocumentContentHash,
  createMapDocument,
  createMapSnapshot,
  diffSnapshots,
  listSnapshotsInDirectory,
  readSnapshotFromDirectory,
  restoreSnapshotFromDirectory,
  writeSnapshotToDirectory
} from "../src";

function buildDocument(overrides: { id?: string; name?: string; width?: number } = {}) {
  return createMapDocument({
    height: 4,
    id: overrides.id ?? "doc-test",
    name: overrides.name ?? "Test",
    tiles: Array.from({ length: 16 }, (_, index) => ({
      id: `tile-${index}`,
      kind: index === 0 ? "wall" : "floor",
      x: index % 4,
      y: Math.floor(index / 4)
    })),
    width: overrides.width ?? 4
  });
}

describe("computeDocumentContentHash", () => {
  it("returns the same hash for identical documents", () => {
    const a = buildDocument();
    const b = buildDocument();

    expect(computeDocumentContentHash(a)).toBe(computeDocumentContentHash(b));
  });

  it("returns a different hash when content changes", () => {
    const a = buildDocument();
    const b = buildDocument({ name: "Different" });

    expect(computeDocumentContentHash(a)).not.toBe(computeDocumentContentHash(b));
  });
});

describe("createMapSnapshot", () => {
  it("packages a document with metadata and content hash", () => {
    const document = buildDocument();
    const snapshot = createMapSnapshot({
      document,
      label: "before-edit",
      now: () => "2026-05-20T12:00:00.000Z",
      projectId: "project-a"
    });

    expect(snapshot.contentHash).toHaveLength(16);
    expect(snapshot.label).toBe("before-edit");
    expect(snapshot.projectId).toBe("project-a");
    expect(snapshot.createdAt).toBe("2026-05-20T12:00:00.000Z");
    expect(snapshot.document.id).toBe(document.id);
  });
});

describe("diffSnapshots", () => {
  it("returns identical=true for the same content hash", () => {
    const document = buildDocument();
    const snapshot = createMapSnapshot({
      document,
      now: () => "2026-05-20T12:00:00.000Z",
      projectId: "p"
    });

    expect(diffSnapshots(snapshot, snapshot).identical).toBe(true);
  });

  it("flags the name field as changed when only the name differs", () => {
    const baseDocument = buildDocument();
    const left = createMapSnapshot({
      document: baseDocument,
      now: () => "2026-05-20T12:00:00.000Z",
      projectId: "p"
    });
    const right = createMapSnapshot({
      document: buildDocument({ name: "Renamed" }),
      now: () => "2026-05-20T12:00:01.000Z",
      projectId: "p"
    });
    const diff = diffSnapshots(left, right);

    expect(diff.identical).toBe(false);
    expect(diff.changedFields).toContain("name");
  });
});

describe("snapshot directory IO", () => {
  it("writes, lists, reads, and restores snapshots, deduping by content hash", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "dm-snapshots-"));
    const snapshot = createMapSnapshot({
      document: buildDocument(),
      label: "v1",
      now: () => "2026-05-20T12:00:00.000Z",
      projectId: "project-a"
    });

    const first = await writeSnapshotToDirectory(snapshot, { outputRoot, projectId: snapshot.projectId });
    const second = await writeSnapshotToDirectory(snapshot, { outputRoot, projectId: snapshot.projectId });

    expect(first.written).toBe(true);
    expect(second.written).toBe(false);
    expect(first.filePath).toBe(second.filePath);

    const list = await listSnapshotsInDirectory({ outputRoot, projectId: "project-a" });
    expect(list).toHaveLength(1);
    expect(list[0]?.contentHash).toBe(snapshot.contentHash);

    const read = await readSnapshotFromDirectory(snapshot.contentHash, { outputRoot, projectId: "project-a" });
    expect(read?.document.id).toBe("doc-test");

    const restored = await restoreSnapshotFromDirectory(snapshot.contentHash, { outputRoot, projectId: "project-a" });
    expect(restored?.name).toBe("Test");

    const directoryEntries = await readdir(path.join(outputRoot, "data", "projects", "project-a", "snapshots"));
    expect(directoryEntries).toHaveLength(1);
  });
});
