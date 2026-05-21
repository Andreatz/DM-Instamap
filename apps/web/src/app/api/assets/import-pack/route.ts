import path from "node:path";
import { importAssetPack, PACK_PRESETS, type PackPreset } from "@dm-instamap/assets/pack-importer";
import { findWorkspaceRoot } from "@/lib/assets-manifest";

type ImportPackBody = {
  assetRoot?: unknown;
  defaultTags?: unknown;
  preset?: unknown;
};

const PRESET_SET = new Set<PackPreset>(PACK_PRESETS);

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ImportPackBody;
    const assetRoot = typeof body.assetRoot === "string" ? body.assetRoot.trim() : "";
    const preset = typeof body.preset === "string" ? body.preset.trim() : "";

    if (!assetRoot) {
      return Response.json({ error: "assetRoot is required.", ok: false }, { status: 400 });
    }

    if (!PRESET_SET.has(preset as PackPreset)) {
      return Response.json(
        {
          error: `preset must be one of: ${PACK_PRESETS.join(", ")}.`,
          ok: false
        },
        { status: 400 }
      );
    }

    const defaultTags = Array.isArray(body.defaultTags)
      ? body.defaultTags.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    const workspaceRoot = await findWorkspaceRoot(process.cwd());
    const resolvedAssetRoot = path.isAbsolute(assetRoot) ? assetRoot : path.resolve(workspaceRoot, assetRoot);
    const result = await importAssetPack({
      assetRoot: resolvedAssetRoot,
      defaultTags,
      outputRoot: workspaceRoot,
      preset: preset as PackPreset
    });

    return Response.json({
      ok: true,
      summary: {
        assetCount: result.added.length,
        manifestErrors: result.manifest.errors.length,
        preset: result.preset,
        presetTagsApplied: result.presetTagsApplied,
        reclassifiedCount: result.reclassifiedCount,
        sourceRoot: result.manifest.sourceRoot
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not import asset pack.";
    return Response.json({ error: message, ok: false }, { status: 500 });
  }
}
