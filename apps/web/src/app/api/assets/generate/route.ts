import { readFile } from "node:fs/promises";
import {
  createImageGenerationProviderFromEnv,
  importGeneratedAssetToLibrary
} from "@dm-instamap/assets/image-generation";
import {
  appendAssetToManifest,
  scanSingleAsset,
  type AssetManifestEntry
} from "@dm-instamap/assets/scanner";
import { findWorkspaceRoot } from "@/lib/assets-manifest";
import { resolveWithinWorkspace } from "@/lib/local-paths";

type ExistingManifest = {
  sourceRoot?: unknown;
};

type GenerateBody = {
  classification?: unknown;
  fileNameHint?: unknown;
  negativePrompt?: unknown;
  prompt?: unknown;
  seed?: unknown;
  steps?: unknown;
  styleTags?: unknown;
};

export async function GET() {
  const provider = createImageGenerationProviderFromEnv(process.env);

  return Response.json({
    ok: true,
    provider: provider
      ? {
          configured: true,
          id: provider.id,
          vendor: provider.vendor
        }
      : {
          configured: false,
          reason:
            "Image generation provider not configured. Set IMAGE_GEN_PROVIDER=replicate|automatic1111 and related env vars."
        }
  });
}

export async function POST(request: Request) {
  try {
    const provider = createImageGenerationProviderFromEnv(process.env);

    if (!provider) {
      return Response.json(
        {
          error: "Image generation provider not configured.",
          ok: false
        },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as GenerateBody;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return Response.json(
        { error: "prompt is required.", ok: false },
        { status: 400 }
      );
    }

    const negativePrompt =
      typeof body.negativePrompt === "string" ? body.negativePrompt : undefined;
    const seed = typeof body.seed === "number" ? body.seed : undefined;
    const steps = typeof body.steps === "number" ? body.steps : undefined;
    const styleTags = Array.isArray(body.styleTags)
      ? body.styleTags.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0
        )
      : [];
    const classification =
      typeof body.classification === "string" ? body.classification : "prop";
    const fileNameHint =
      typeof body.fileNameHint === "string" ? body.fileNameHint : undefined;
    const workspaceRoot = await findWorkspaceRoot(process.cwd());
    const result = await provider.generate({
      negativePrompt,
      prompt,
      seed,
      steps,
      styleTags
    });
    const metadata = await importGeneratedAssetToLibrary(provider, {
      classification,
      fileNameHint,
      outputRoot: workspaceRoot,
      request: { negativePrompt, prompt, seed, steps, styleTags },
      result
    });

    const rescan = await tryAppendToManifest({
      generatedAbsolutePath: metadata.path,
      workspaceRoot
    });

    return Response.json({
      asset: metadata,
      manifestEntry: rescan?.entry ?? null,
      manifestUpdate: rescan
        ? {
            appended: rescan.result.appended,
            replaced: rescan.result.replaced,
            totalAssets: rescan.result.manifest.assets.length
          }
        : null,
      ok: true
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image generation failed.";
    return Response.json({ error: message, ok: false }, { status: 500 });
  }
}

async function tryAppendToManifest(input: {
  generatedAbsolutePath: string;
  workspaceRoot: string;
}): Promise<{
  entry: AssetManifestEntry;
  result: Awaited<ReturnType<typeof appendAssetToManifest>>;
} | null> {
  try {
    const manifestPath = resolveWithinWorkspace(
      input.workspaceRoot,
      "data",
      "indexes",
      "assets.manifest.json"
    );
    let sourceRoot = resolveWithinWorkspace(
      input.workspaceRoot,
      "data",
      "assets",
      "generated"
    );

    try {
      const raw = await readFile(manifestPath, "utf8");
      const parsed = JSON.parse(raw) as ExistingManifest;
      if (
        typeof parsed.sourceRoot === "string" &&
        parsed.sourceRoot.trim().length > 0
      ) {
        sourceRoot = parsed.sourceRoot;
      }
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      ) {
        throw error;
      }
    }

    const entry = await scanSingleAsset(input.generatedAbsolutePath, {
      outputRoot: input.workspaceRoot,
      sourceRoot
    });
    const result = await appendAssetToManifest(entry, {
      outputRoot: input.workspaceRoot
    });

    return { entry, result };
  } catch {
    return null;
  }
}
