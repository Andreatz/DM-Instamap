import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertSafeWorkspaceId,
  resolveWithinWorkspace
} from "@/lib/local-paths";
import { loadReferenceMaps } from "@/lib/references";

export const dynamic = "force-dynamic";

type PreviewRouteContext = {
  params: Promise<{
    referenceId: string;
  }>;
};

export async function GET(_request: Request, context: PreviewRouteContext) {
  const { referenceId } = await context.params;
  const manifest = await loadReferenceMaps();
  const reference = manifest.references.find(
    (candidate) => candidate.id === referenceId
  );

  if (!reference) {
    return new Response("Reference preview not found.", { status: 404 });
  }

  const workspaceRoot = path.resolve(manifest.manifestPath, "..", "..", "..");
  const previewPath = resolveWithinWorkspace(
    workspaceRoot,
    "data",
    "previews",
    "references",
    `${assertSafeWorkspaceId(reference.id, "referenceId")}.webp`
  );

  try {
    const preview = await readFile(previewPath);

    return new Response(preview, {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Content-Type": "image/webp"
      }
    });
  } catch {
    return new Response("Reference preview file is missing.", { status: 404 });
  }
}
