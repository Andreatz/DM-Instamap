import {
  createMapSnapshot,
  diffSnapshots,
  readSnapshotFromDirectory
} from "@dm-instamap/core/snapshots";
import { findWorkspaceRoot } from "@/lib/assets-manifest";
import { InvalidProjectIdError, ProjectNotFoundError, readProject } from "@/lib/projects";

type RouteContext = {
  params: Promise<{
    contentHash: string;
    projectId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { contentHash, projectId } = await context.params;
    const project = await readProject(projectId);
    const outputRoot = await findWorkspaceRoot(process.cwd());
    const baseRecord = await readSnapshotFromDirectory(contentHash, { outputRoot, projectId });

    if (!baseRecord) {
      return Response.json({ error: "Snapshot not found.", ok: false }, { status: 404 });
    }

    const url = new URL(request.url);
    const against = url.searchParams.get("against") ?? "current";
    const compareRecord =
      against === "current"
        ? createMapSnapshot({
            document: project.document,
            label: "current",
            projectId
          })
        : await readSnapshotFromDirectory(against, { outputRoot, projectId });

    if (!compareRecord) {
      return Response.json({ error: "Comparison snapshot not found.", ok: false }, { status: 404 });
    }

    const diff = diffSnapshots(baseRecord, compareRecord);

    return Response.json({
      against,
      diff,
      ok: true
    });
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return Response.json({ error: error.message, ok: false }, { status: 404 });
    }

    if (error instanceof InvalidProjectIdError) {
      return Response.json({ error: error.message, ok: false }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Snapshot diff failed.";
    return Response.json({ error: message, ok: false }, { status: 500 });
  }
}


