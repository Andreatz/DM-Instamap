import {
  readSnapshotFromDirectory
} from "@dm-instamap/core/snapshots";
import { findWorkspaceRoot } from "@/lib/assets-manifest";
import { InvalidProjectIdError, ProjectNotFoundError, readProject, updateProject } from "@/lib/projects";

type RouteContext = {
  params: Promise<{
    contentHash: string;
    projectId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { contentHash, projectId } = await context.params;
    await readProject(projectId);
    const outputRoot = await findWorkspaceRoot(process.cwd());
    const record = await readSnapshotFromDirectory(contentHash, { outputRoot, projectId });

    if (!record) {
      return Response.json({ error: "Snapshot not found.", ok: false }, { status: 404 });
    }

    return Response.json({
      ok: true,
      snapshot: {
        contentHash: record.contentHash,
        createdAt: record.createdAt,
        document: record.document,
        label: record.label
      }
    });
  } catch (error) {
    return snapshotErrorResponse(error);
  }
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { contentHash, projectId } = await context.params;
    await readProject(projectId);
    const outputRoot = await findWorkspaceRoot(process.cwd());
    const record = await readSnapshotFromDirectory(contentHash, { outputRoot, projectId });

    if (!record) {
      return Response.json({ error: "Snapshot not found.", ok: false }, { status: 404 });
    }

    const updated = await updateProject(projectId, { document: record.document });

    return Response.json({
      ok: true,
      project: updated,
      restoredFrom: {
        contentHash: record.contentHash,
        createdAt: record.createdAt,
        label: record.label
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

  const message = error instanceof Error ? error.message : "Snapshot restore failed.";
  return Response.json({ error: message, ok: false }, { status: 500 });
}
