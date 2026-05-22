import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadAssetManifest } from "@/lib/assets-manifest";
import {
  assertSafeWorkspaceId,
  resolveWithinWorkspace
} from "@/lib/local-paths";

export const dynamic = "force-dynamic";

type PreviewRouteContext = {
  params: Promise<{
    assetId: string;
  }>;
};

export async function GET(_request: Request, context: PreviewRouteContext) {
  const { assetId } = await context.params;
  const manifest = await loadAssetManifest();
  const asset = manifest.assets.find((candidate) => candidate.id === assetId);

  if (!asset) {
    return new Response("Asset preview not found.", { status: 404 });
  }

  const workspaceRoot = path.resolve(manifest.manifestPath, "..", "..", "..");
  const previewPath = resolveWithinWorkspace(
    workspaceRoot,
    "data",
    "previews",
    "assets",
    `${assertSafeWorkspaceId(asset.id, "assetId")}.webp`
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
    return new Response("Asset preview file is missing.", { status: 404 });
  }
}
