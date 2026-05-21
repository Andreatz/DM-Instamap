import {
  createMapSnapshot,
  listSnapshotsInDirectory,
  writeSnapshotToDirectory
} from "@dm-instamap/core/snapshots";
import { findWorkspaceRoot } from "@/lib/assets-manifest";
import { InvalidProjectIdError, ProjectNotFoundError, readProject } from "@/lib/projects";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

type CreateSnapshotBody = {
  label?: unknown;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    await readProject(projectId);
    const outputRoot = await findWorkspaceRoot(process.cwd());
    const snapshots = await listSnapshotsInDirectory({ outputRoot, projectId });

    return Response.json({
      ok: true,
      snapshots: snapshots.map((snapshot) => ({
        contentHash: snapshot.contentHash,
        createdAt: snapshot.createdAt,
        fileName: snapshot.fileName,
        label: snapshot.label
      }))
    });
  } catch (error) {
    return snapshotErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const project = await readProject(projectId);
    const body = (await request.json().catch(() => ({}))) as CreateSnapshotBody;
    const label = typeof body.label === "string" && body.label.trim().length > 0 ? body.label.trim() : "manual";
    const outputRoot = await findWorkspaceRoot(process.cwd());
    const snapshot = createMapSnapshot({
      document: project.document,
      label,
      projectId
    });
    const persisted = await writeSnapshotToDirectory(snapshot, { outputRoot, projectId });

    return Response.json({
      ok: true,
      snapshot: {
        contentHash: snapshot.contentHash,
        createdAt: snapshot.createdAt,
        fileName: persisted.filePath.split(/[/\\]/u).pop(),
        label: snapshot.label,
        written: persisted.written
      }
    });
  } catch (error) {
    return snapshotErrorResponse(error);
  }
}

function snapshotErrorResponse(error: unknown): Response {
  if (error instanceof ProjectNotFoundError) {
    return Response.json({ error: error.message, ok: false }, { status: 404 });
  }

  if (error instanceof InvalidProjectIdError) {
    return Response.json({ error: error.message, ok: false }, { status: 400 });
  }

  const message = error instanceof Error ? error.message : "Snapshot operation failed.";
  return Response.json({ error: message, ok: false }, { status: 500 });
}
