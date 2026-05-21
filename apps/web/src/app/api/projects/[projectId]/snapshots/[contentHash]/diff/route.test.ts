import {
  describe,
  expect,
  it,
  vi,
  beforeEach } from "vitest";

vi.mock("@dm-instamap/core/server",
  () => ({
  createMapSnapshot: vi.fn(),
  diffSnapshots: vi.fn(),
  readSnapshotFromDirectory: vi.fn()
}));

vi.mock("@/lib/assets-manifest",
  () => ({
  findWorkspaceRoot: vi.fn().mockResolvedValue("/tmp/workspace")
}));

vi.mock("@/lib/projects",
  () => {
  class FakeProjectNotFoundError extends Error {}
  class FakeInvalidProjectIdError extends Error {}
  return {
    InvalidProjectIdError: FakeInvalidProjectIdError,
  ProjectNotFoundError: FakeProjectNotFoundError,
  readProject: vi.fn()
  };
});

import { GET } from "./route";
import { createMapSnapshot
} from "@dm-instamap/core/server";
import {
  diffSnapshots,
  readSnapshotFromDirectory
} from "@dm-instamap/core/server";
import { readProject } from "@/lib/projects";

const readProjectMock = readProject as unknown as ReturnType<typeof vi.fn>;
const readSnapshotMock = readSnapshotFromDirectory as unknown as ReturnType<typeof vi.fn>;
const createMapSnapshotMock = createMapSnapshot as unknown as ReturnType<typeof vi.fn>;
const diffSnapshotsMock = diffSnapshots as unknown as ReturnType<typeof vi.fn>;

function context(projectId: string, contentHash: string) {
  return { params: Promise.resolve({ contentHash, projectId }) };
}

const fakeDocument = { id: "crypt", name: "Crypt" };
const fakeBaseRecord = {
  contentHash: "aaaa1111",
  createdAt: "2026-05-21T00:00:00.000Z",
  document: fakeDocument,
  documentId: "crypt",
  label: "before",
  projectId: "crypt"
};
const fakeCurrentSnapshot = {
  ...fakeBaseRecord,
  contentHash: "ffff9999",
  label: "current"
};

describe("GET /api/projects/[id]/snapshots/[hash]/diff", () => {
  beforeEach(() => {
    readProjectMock.mockReset();
    readSnapshotMock.mockReset();
    createMapSnapshotMock.mockReset();
    diffSnapshotsMock.mockReset();
  });

  it("computes the diff against the current document by default", async () => {
    readProjectMock.mockResolvedValue({ document: fakeDocument });
    readSnapshotMock.mockResolvedValueOnce(fakeBaseRecord);
    createMapSnapshotMock.mockReturnValue(fakeCurrentSnapshot);
    diffSnapshotsMock.mockReturnValue({
      changedFields: ["rooms", "gmNotes"],
      fromHash: "aaaa1111",
      identical: false,
      toHash: "ffff9999"
    });

    const response = await GET(
      new Request("http://test/api/projects/crypt/snapshots/aaaa1111/diff"),
      context("crypt", "aaaa1111")
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      against: string;
      ok: boolean;
      diff: { changedFields: string[]; identical: boolean };
    };
    expect(body.ok).toBe(true);
    expect(body.against).toBe("current");
    expect(body.diff.changedFields).toEqual(["rooms", "gmNotes"]);
    expect(createMapSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({ document: fakeDocument, label: "current", projectId: "crypt" })
    );
    expect(diffSnapshotsMock).toHaveBeenCalledWith(fakeBaseRecord, fakeCurrentSnapshot);
  });

  it("computes the diff against another snapshot when against=<hash>", async () => {
    readProjectMock.mockResolvedValue({ document: fakeDocument });
    const otherSnapshot = { ...fakeBaseRecord, contentHash: "bbbb2222", label: "other" };
    readSnapshotMock.mockResolvedValueOnce(fakeBaseRecord).mockResolvedValueOnce(otherSnapshot);
    diffSnapshotsMock.mockReturnValue({
      changedFields: ["lights"],
      fromHash: "aaaa1111",
      identical: false,
      toHash: "bbbb2222"
    });

    const response = await GET(
      new Request("http://test/api/projects/crypt/snapshots/aaaa1111/diff?against=bbbb2222"),
      context("crypt", "aaaa1111")
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { against: string; diff: { changedFields: string[] } };
    expect(body.against).toBe("bbbb2222");
    expect(body.diff.changedFields).toEqual(["lights"]);
    expect(createMapSnapshotMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the base snapshot is missing", async () => {
    readProjectMock.mockResolvedValue({ document: fakeDocument });
    readSnapshotMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://test/api/projects/crypt/snapshots/missing/diff"),
      context("crypt", "missing")
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/Snapshot not found/);
  });
});


